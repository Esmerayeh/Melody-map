/**
 * useMusicProfile -- central data hook
 *
 * Spotify uses the backend canonical /api/music-profile contract.
 * Last.fm builds the same contract client-side so the rest of the app
 * can stay provider-agnostic.
 */
import { useEffect, useCallback, useRef } from 'react'
import { musicProfileAPI } from '../services/api'
import { musicService } from '../services/musicService'
import useStore from '../store/useStore'
import { buildGenreList, PROFILE_SCHEMA_VERSION } from '../services/profileAdapters.js'
import { normalizeProfileResponse } from '../services/dataAdapters'
import { logClientEvent } from '../services/observability'
import { buildDemoProfile } from '../services/demoProfile'

function mapLastfmPeriod(timeRange) {
  if (timeRange === 'short_term') return '1month'
  if (timeRange === 'long_term') return 'overall'
  return '6month'
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
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
    provider: 'lastfm',
    generatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    userProfile,
    topArtists,
    topTracks: topTracksRaw,
    recentlyPlayed: [],
    savedTracks: [],
    audioFeatures: {},
    audioFeaturesList: [],
    galaxyNodes: [],
    aestheticTags: genres.slice(0, 8).map((item) => item.genre),
    analyticsMetrics: null,
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
      degradedReasons: ['spotify_audio_features_unavailable_for_lastfm_profile'],
      sampleSizes: {},
      featureCoverageByMetric: {},
    },
    confidence: {
      analytics: { score: 0, label: 'unavailable' },
      identity: { score: Math.min(0.45, Number((genres.length / 12).toFixed(3))), label: genres.length >= 6 ? 'low' : 'unavailable' },
      galaxy: { score: Math.min(1, Number((((topArtists.length / 50) * 0.7) + (genres.length / 12) * 0.3).toFixed(3))), label: topArtists.length >= 15 ? 'medium' : 'low' },
      soulmate: { score: Math.min(0.45, Number((((topArtists.length / 50) * 0.25) + (genres.length / 12) * 0.2).toFixed(3))), label: topArtists.length >= 15 ? 'low' : 'unavailable' },
    },
    analyticsReadiness: {
      ready: false,
      confidence: { score: 0, label: 'unavailable' },
      reasons: ['spotify_audio_features_unavailable_for_lastfm_profile'],
    },
    identityReadiness: {
      ready: genres.length > 0,
      confidence: { score: Math.min(0.45, Number((genres.length / 12).toFixed(3))), label: genres.length >= 6 ? 'low' : 'unavailable' },
      mbtiReady: false,
      reasons: genres.length > 0 ? [] : ['insufficient_identity_inputs'],
    },
    soulmateReadiness: {
      ready: false,
      confidence: { score: Math.min(0.45, Number((((topArtists.length / 50) * 0.25) + (genres.length / 12) * 0.2).toFixed(3))), label: topArtists.length >= 15 ? 'low' : 'unavailable' },
      mode: 'degraded',
      reasons: ['spotify_audio_features_unavailable_for_lastfm_profile'],
    },
  }
}

export default function useMusicProfile({ autoFetch = true } = {}) {
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected = useStore((s) => s.lastfmConnected)
  const musicProvider = useStore((s) => s.musicProvider)
  const musicProfile = useStore((s) => s.musicProfile)
  const musicProfileLoading = useStore((s) => s.musicProfileLoading)
  const musicProfileError = useStore((s) => s.musicProfileError)
  const timeRange = useStore((s) => s.musicProfileTimeRange)
  const demoModeEnabled = useStore((s) => s.demoModeEnabled)
  const setMusicProfile = useStore((s) => s.setMusicProfile)
  const setLoading = useStore((s) => s.setMusicProfileLoading)
  const setError = useStore((s) => s.setMusicProfileError)
  const setVibeFeatures = useStore((s) => s.setVibeFeatures)
  const setSonicIdentity = useStore((s) => s.setSonicIdentity)
  const clearMusicProfile = useStore((s) => s.clearMusicProfile)

  const fetchingRef = useRef(false)
  const requestIdRef = useRef(0)

  const doFetch = useCallback(async (force = false) => {
    const truthProvider = spotifyConnected
      ? 'spotify'
      : (musicProvider || musicService.getTruthProvider())

    if (!spotifyConnected && !lastfmConnected && !demoModeEnabled) return
    const cachedProvider = musicProfile?.provider || null
    const shouldRefetchForProvider = Boolean(truthProvider && cachedProvider && cachedProvider !== truthProvider)
    if (musicProfile && !force && !shouldRefetchForProvider) return
    if (fetchingRef.current) return

    fetchingRef.current = true
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      let rawProfile
      if (!spotifyConnected && !lastfmConnected && demoModeEnabled) {
        rawProfile = buildDemoProfile()
      } else if (truthProvider === 'lastfm') {
        rawProfile = await buildLastfmProfile(timeRange)
      } else {
        const res = await musicProfileAPI.get({ time_range: timeRange, limit: 50 })
        rawProfile = res.data
      }
      const normalized = normalizeProfileResponse(rawProfile, truthProvider)
      if (normalized.status === 'failed' || !normalized.data) {
        throw new Error(normalized.warnings?.[0] || 'Failed to load music profile')
      }
      const profile = normalized.data
      if (requestId !== requestIdRef.current) return
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
      logClientEvent('profile_boot_failed', {
        message: msg,
        provider: truthProvider,
        timeRange,
      }, 'warn')
      if (requestId === requestIdRef.current) {
        setError(msg)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        fetchingRef.current = false
      }
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
    clearMusicProfile,
    demoModeEnabled,
  ])

  useEffect(() => {
    if (spotifyConnected || lastfmConnected || demoModeEnabled) return
    if (musicProfile?.provider === 'demo') {
      clearMusicProfile()
      setError(null)
      setLoading(false)
    }
  }, [spotifyConnected, lastfmConnected, demoModeEnabled, musicProfile, clearMusicProfile, setError, setLoading])

  useEffect(() => {
    if (autoFetch) doFetch()
  }, [autoFetch, doFetch])

  return {
    profile: musicProfile,
    loading: musicProfileLoading,
    error: musicProfileError,
    refetch: () => doFetch(true),
    timeRange,
    isDegraded: Boolean(musicProfile?.isDegraded),
    canComputeIdentity: Boolean(musicProfile?.canComputeIdentity),
    canComputeAnalytics: Boolean(musicProfile?.canComputeAnalytics),
    canRenderGalaxy: Boolean(musicProfile?.canRenderGalaxy),
    confidence: musicProfile?.confidence || null,
    dataQuality: musicProfile?.dataQuality || null,
    phase: (() => {
      if (musicProfileLoading && !musicProfile) return 'loading'
      if (musicProfileError && !musicProfile) return 'error'
      if (!musicProfile) return 'empty'
      if (musicProfile?.isDegraded) return 'partial'
      return 'ready'
    })(),
    tier: (() => {
      if (musicProfileError && !musicProfile) return 'failed'
      if (!musicProfile) return 'limited'
      const overall = musicProfile?.confidence?.overall ?? 0
      if (overall >= 0.78) return 'rich'
      if (overall >= 0.55) return 'medium'
      if (overall >= 0.35) return 'sparse'
      return 'limited'
    })(),
    readiness: {
      analytics: Boolean(musicProfile?.analyticsReadiness?.ready),
      identity: Boolean(musicProfile?.identityReadiness?.ready),
      soulmate: Boolean(musicProfile?.soulmateReadiness?.ready),
      galaxy: Boolean(musicProfile?.canRenderGalaxy),
    },
  }
}
