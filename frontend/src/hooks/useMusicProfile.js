/**
 * useMusicProfile — central data hook
 *
 * Spotify uses the backend canonical /api/music-profile contract.
 * Last.fm builds the same contract client-side so the rest of the app
 * can stay provider-agnostic.
 */
import { useEffect, useCallback, useRef } from 'react'
import { musicProfileAPI } from '../services/api'
import { musicService } from '../services/musicService'
import useStore from '../store/useStore'
import { computePersonality, computeMBTI } from '../utils/personalityEngine'

function mapLastfmPeriod(timeRange) {
  if (timeRange === 'short_term') return '1month'
  if (timeRange === 'long_term') return 'overall'
  return '6month'
}

function buildGenreList(artists = []) {
  const counts = new Map()
  artists.forEach((artist) => {
    ;(artist.genres || []).forEach((genre) => {
      const key = String(genre).toLowerCase().trim()
      if (!key) return
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }))
}

function buildAnalytics(audioFeatures = {}, genres = [], tracks = []) {
  const energy = audioFeatures.energy
  const valence = audioFeatures.valence
  const acousticness = audioFeatures.acousticness
  const totalGenreWeight = genres.reduce((sum, item) => sum + (item.count || 0), 0) || 1
  const entropy = genres.reduce((sum, item) => {
    const p = (item.count || 0) / totalGenreWeight
    return p > 0 ? sum - p * Math.log2(p) : sum
  }, 0)
  const maxEntropy = genres.length > 1 ? Math.log2(genres.length) : 1

  return {
    mood: energy != null && valence != null ? (
      energy > 0.7 && valence > 0.6 ? 'euphoric'
        : energy > 0.7 && valence < 0.4 ? 'intense'
        : energy > 0.7 ? 'energetic'
        : energy < 0.35 && valence < 0.35 ? 'melancholic'
        : energy < 0.35 && valence > 0.6 ? 'serene'
        : energy < 0.35 ? 'dreamy'
        : valence > 0.65 ? 'uplifting'
        : valence < 0.35 ? 'brooding'
        : 'balanced'
    ) : null,
    energyScore: energy != null ? Math.round(energy * 100) : null,
    valenceScore: valence != null ? Math.round(valence * 100) : null,
    danceabilityScore: audioFeatures.danceability != null ? Math.round(audioFeatures.danceability * 100) : null,
    acousticnessScore: acousticness != null ? Math.round(acousticness * 100) : null,
    tempoAvg: audioFeatures.tempo != null ? Math.round(audioFeatures.tempo) : null,
    speechinessScore: audioFeatures.speechiness != null ? Math.round(audioFeatures.speechiness * 100) : null,
    instrumentalScore: audioFeatures.instrumentalness != null ? Math.round(audioFeatures.instrumentalness * 100) : null,
    nostalgiaIndex: tracks.some((track) => track.release_date || track.release_year || track.year) ? 50 : null,
    diversityScore: Math.round(Math.min(1, entropy / maxEntropy) * 100),
    sonicBrightness: energy != null && valence != null && acousticness != null
      ? Math.round((valence * 0.45 + energy * 0.35 + (1 - acousticness) * 0.2) * 100)
      : null,
  }
}

async function buildLastfmProfile(timeRange) {
  const period = mapLastfmPeriod(timeRange)
  const [userProfile, topArtistsRaw, topTracksRaw] = await Promise.all([
    musicService.getProfile(),
    musicService.getTopArtists({ limit: 50, period }),
    musicService.getTopTracks({ limit: 50, period }),
  ])

  const taggedArtists = await Promise.all(
    topArtistsRaw.slice(0, 12).map(async (artist) => {
      try {
        const tags = await musicService.getArtistTags(artist.name)
        return { ...artist, genres: Array.isArray(tags) ? tags : artist.genres || [] }
      } catch {
        return { ...artist, genres: artist.genres || [] }
      }
    })
  )

  const topArtists = [
    ...taggedArtists,
    ...topArtistsRaw.slice(12).map((artist) => ({ ...artist, genres: artist.genres || [] })),
  ]
  const genres = buildGenreList(topArtists)

  return {
    provider: 'lastfm',
    userProfile,
    topArtists,
    topTracks: topTracksRaw,
    recentlyPlayed: [],
    savedTracks: [],
    audioFeatures: {},
    audioFeaturesList: [],
    galaxyNodes: [],
    aestheticTags: genres.slice(0, 8).map((item) => item.genre),
    analyticsMetrics: buildAnalytics({}, genres, topTracksRaw),
    genres,
    timeRange,
    dataQuality: {
      provider: 'lastfm',
      topArtistsCount: topArtists.length,
      topTracksCount: topTracksRaw.length,
      genresCount: genres.length,
      audioFeaturesRequested: 0,
      audioFeaturesCount: 0,
      audioCoverage: 0,
      hasAudioProfile: false,
    },
  }
}

function normalizeProfile(raw, provider) {
  if (!raw) return null

  const normalized = {
    ...raw,
    topArtists: raw.topArtists || raw.artists || [],
    topTracks: raw.topTracks || raw.tracks || [],
    savedTracks: raw.savedTracks || [],
    recentlyPlayed: raw.recentlyPlayed || [],
    genres: raw.genres || [],
    audioFeatures: raw.audioFeatures || {},
    analyticsMetrics: raw.analyticsMetrics || null,
    galaxyNodes: raw.galaxyNodes || [],
    aestheticTags: raw.aestheticTags || [],
    userProfile: raw.userProfile || null,
    timeRange: raw.timeRange || 'medium_term',
    provider: raw.provider || provider || raw.dataQuality?.provider || 'spotify',
    dataQuality: raw.dataQuality || null,
  }

  if (normalized.dataQuality && normalized.dataQuality.hasAudioProfile === false) {
    normalized.analyticsMetrics = null
  }

  normalized.personality = computePersonality(normalized)
  normalized.mbti = computeMBTI(normalized)
  return normalized
}

export default function useMusicProfile({ autoFetch = true } = {}) {
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected = useStore((s) => s.lastfmConnected)
  const musicProvider = useStore((s) => s.musicProvider)
  const musicProfile = useStore((s) => s.musicProfile)
  const musicProfileLoading = useStore((s) => s.musicProfileLoading)
  const musicProfileError = useStore((s) => s.musicProfileError)
  const timeRange = useStore((s) => s.musicProfileTimeRange)
  const setMusicProfile = useStore((s) => s.setMusicProfile)
  const setLoading = useStore((s) => s.setMusicProfileLoading)
  const setError = useStore((s) => s.setMusicProfileError)
  const setVibeFeatures = useStore((s) => s.setVibeFeatures)
  const setSonicIdentity = useStore((s) => s.setSonicIdentity)

  const fetchingRef = useRef(false)

  const doFetch = useCallback(async (force = false) => {
    if (!spotifyConnected && !lastfmConnected) return
    if (musicProfile && !force) return
    if (fetchingRef.current) return

    fetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      let rawProfile
      if (musicProvider === 'lastfm') {
        rawProfile = await buildLastfmProfile(timeRange)
      } else {
        const res = await musicProfileAPI.get({ time_range: timeRange, limit: 50 })
        rawProfile = res.data
      }

      const profile = normalizeProfile(rawProfile, musicProvider)
      setMusicProfile(profile)

      const af = profile.audioFeatures || {}
      if (af.energy != null || af.valence != null) {
        setVibeFeatures({ energy: af.energy, valence: af.valence })
      }

      const metrics = profile.analyticsMetrics || {}
      if (metrics.mood || metrics.diversityScore != null) {
        setSonicIdentity({
          mood: metrics.mood,
          energy: metrics.energyScore,
          valence: metrics.valenceScore,
          diversity: metrics.diversityScore,
          nostalgia: metrics.nostalgiaIndex,
          brightness: metrics.sonicBrightness,
        })
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to load music profile'
      setError(msg)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [
    spotifyConnected,
    lastfmConnected,
    musicProvider,
    musicProfile,
    timeRange,
    setMusicProfile,
    setLoading,
    setError,
    setVibeFeatures,
    setSonicIdentity,
  ])

  useEffect(() => {
    if (autoFetch) doFetch()
  }, [autoFetch, doFetch])

  return {
    profile: musicProfile,
    loading: musicProfileLoading,
    error: musicProfileError,
    refetch: () => doFetch(true),
    timeRange,
  }
}
