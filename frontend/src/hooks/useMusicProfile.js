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
import { computePersonalityDetails, computeMBTIDetails } from '../utils/personalityEngine'

const PROFILE_SCHEMA_VERSION = '2026-03-profile-v2'

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

function validateProfilePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'Profile payload was empty or malformed.' }
  }

  const arrayKeys = ['topArtists', 'topTracks', 'genres']
  const badArrayKey = arrayKeys.find((key) => raw[key] != null && !Array.isArray(raw[key]))
  if (badArrayKey) {
    return { ok: false, reason: `Profile field "${badArrayKey}" was not an array.` }
  }

  if (raw.audioFeatures != null && typeof raw.audioFeatures !== 'object') {
    return { ok: false, reason: 'Profile audioFeatures field was malformed.' }
  }

  return { ok: true }
}

function unwrapProfileResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

function deriveConfidence(dataQuality = {}, profile = {}, backendConfidence = null) {
  const audioCoverage = Number(dataQuality.audioCoverage || 0)
  const topArtistsCount = Number(dataQuality.topArtistsCount || profile.topArtists?.length || 0)
  const topTracksCount = Number(dataQuality.topTracksCount || profile.topTracks?.length || 0)
  const genresCount = Number(dataQuality.genresCount || profile.genres?.length || 0)
  const hasAudioProfile = dataQuality.hasAudioProfile !== false && audioCoverage > 0

  const analytics = hasAudioProfile ? Math.min(1, (audioCoverage * 0.75) + (topTracksCount / 50) * 0.25) : 0
  const identity = hasAudioProfile
    ? Math.min(1, (audioCoverage * 0.7) + (genresCount / 12) * 0.2 + (topArtistsCount / 50) * 0.1)
    : Math.min(0.45, (genresCount / 12) * 0.35 + (topArtistsCount / 50) * 0.1)
  const galaxy = Math.min(1, (topArtistsCount / 50) * 0.65 + (genresCount / 12) * 0.35)
  const soulmate = Math.min(1, (topArtistsCount / 50) * 0.5 + (genresCount / 12) * 0.2 + (hasAudioProfile ? audioCoverage * 0.3 : 0))
  const overall = Math.max(analytics, identity, galaxy) * 0.5 + Math.min(analytics, identity, galaxy) * 0.5

  const labelFor = (score) => (score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : score > 0 ? 'low' : 'unavailable')

  const derived = {
    overall: Number(overall.toFixed(3)),
    analytics: Number(analytics.toFixed(3)),
    identity: Number(identity.toFixed(3)),
    galaxy: Number(galaxy.toFixed(3)),
    soulmate: Number(soulmate.toFixed(3)),
  }

  const normalizedBackend = backendConfidence && typeof backendConfidence === 'object'
    ? Object.fromEntries(
        ['overall', 'analytics', 'identity', 'galaxy', 'soulmate']
          .filter((key) => backendConfidence[key] != null)
          .map((key) => {
            const raw = backendConfidence[key]
            const score = typeof raw === 'number' ? raw : raw?.score
            return [key, Number(Math.max(0, Math.min(1, score || 0)).toFixed(3))]
          })
      )
    : {}

  const merged = {
    ...derived,
    ...normalizedBackend,
  }
  if (merged.overall == null) {
    merged.overall = Number((((merged.analytics + merged.identity + merged.galaxy) / 3) || 0).toFixed(3))
  }

  return {
    ...merged,
    labels: {
      overall: labelFor(merged.overall),
      analytics: labelFor(merged.analytics),
      identity: labelFor(merged.identity),
      galaxy: labelFor(merged.galaxy),
      soulmate: labelFor(merged.soulmate),
    },
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

function normalizeProfile(raw, provider) {
  if (!raw) return null

  const fallbackArtists = raw.topArtists || raw.artists || []
  const fallbackGenres = Array.isArray(raw.genres) && raw.genres.length
    ? raw.genres
    : buildGenreList(fallbackArtists)

  const normalized = {
    ...raw,
    topArtists: fallbackArtists,
    topTracks: raw.topTracks || raw.tracks || [],
    savedTracks: raw.savedTracks || [],
    recentlyPlayed: raw.recentlyPlayed || [],
    genres: fallbackGenres,
    audioFeatures: raw.audioFeatures || {},
    analyticsMetrics: raw.analyticsMetrics || null,
    galaxyNodes: raw.galaxyNodes || [],
    aestheticTags: raw.aestheticTags || [],
    userProfile: raw.userProfile || null,
    timeRange: raw.timeRange || 'medium_term',
    provider: raw.provider || provider || raw.dataQuality?.provider || 'spotify',
    dataQuality: raw.dataQuality || null,
    profileSchemaVersion: raw.profileSchemaVersion || PROFILE_SCHEMA_VERSION,
  }

  if (normalized.dataQuality && normalized.dataQuality.hasAudioProfile === false) {
    normalized.analyticsMetrics = null
  }

  const backendPersonalityMeta = raw.personalityMeta && typeof raw.personalityMeta === 'object' ? raw.personalityMeta : null
  const backendMbtiMeta = raw.mbtiMeta && typeof raw.mbtiMeta === 'object' ? raw.mbtiMeta : null
  const personalityDetails = backendPersonalityMeta || computePersonalityDetails({
    audioFeatures: normalized.audioFeatures || {},
    genres: normalized.genres || [],
  })
  const mbtiDetails = backendMbtiMeta || (
    normalized.dataQuality?.hasAudioProfile === false
      ? { value: null, confidence: 0, missingInputs: ['audioFeatures'], inputsUsed: [], methodology: 'music-mbti-v1' }
      : computeMBTIDetails(normalized)
  )

  normalized.personality = raw.personality ?? personalityDetails.traits
  normalized.mbti = raw.mbti ?? mbtiDetails.value
  normalized.confidence = deriveConfidence(normalized.dataQuality || {}, normalized, raw.confidence)
  const identityConfidence = Math.min(
    normalized.confidence.identity ?? 0,
    personalityDetails.confidence ?? normalized.confidence.identity ?? 0,
  )
  normalized.confidence.identity = Number(identityConfidence.toFixed(3))
  normalized.confidence.labels.identity = normalized.confidence.identity >= 0.8
    ? 'high'
    : normalized.confidence.identity >= 0.5
      ? 'medium'
      : normalized.confidence.identity > 0
        ? 'low'
        : 'unavailable'
  normalized.personalityMeta = {
    ...personalityDetails,
    confidence: normalized.confidence.identity,
  }
  normalized.mbtiMeta = {
    ...mbtiDetails,
    confidence: Math.min(
      normalized.confidence.identity,
      mbtiDetails.confidence ?? normalized.confidence.identity,
    ),
  }
  normalized.isDegraded = Boolean(
    normalized.dataQuality?.hasAudioProfile === false
    || (normalized.dataQuality?.degradedReasons || []).length
    || normalized.confidence.analytics < 0.5
    || normalized.confidence.identity < 0.5
  )
  const fallbackCanComputeIdentity = Boolean(normalized.personality?.length) && normalized.confidence.identity >= 0.2
  const fallbackCanComputeAnalytics = Boolean(normalized.analyticsMetrics) && normalized.confidence.analytics >= 0.35
  normalized.identityReadiness = raw.identityReadiness || {
    ready: fallbackCanComputeIdentity,
    confidence: normalized.confidence.identity,
    reasons: fallbackCanComputeIdentity ? [] : ['insufficient_identity_inputs'],
  }
  normalized.analyticsReadiness = raw.analyticsReadiness || {
    ready: fallbackCanComputeAnalytics,
    confidence: normalized.confidence.analytics,
    reasons: fallbackCanComputeAnalytics ? [] : ['insufficient_audio_feature_coverage'],
  }
  normalized.soulmateReadiness = {
    ...(raw.soulmateReadiness || {}),
    ready: raw.soulmateReadiness?.ready ?? (normalized.confidence.soulmate >= 0.35 && normalized.topArtists.length >= 10),
    confidence: raw.soulmateReadiness?.confidence || normalized.confidence.soulmate,
    mode: normalized.dataQuality?.hasAudioProfile === false ? 'degraded' : 'full',
    degradedReasons: normalized.dataQuality?.degradedReasons || raw.soulmateReadiness?.reasons || [],
  }
  normalized.canComputeAnalytics = Boolean(normalized.analyticsReadiness?.ready) && Boolean(normalized.analyticsMetrics)
  normalized.canComputeIdentity = Boolean(normalized.identityReadiness?.ready) && Boolean(normalized.personality?.length)
  normalized.canRenderGalaxy = Boolean(normalized.topArtists?.length || normalized.galaxyNodes?.length)
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
    const truthProvider = spotifyConnected
      ? 'spotify'
      : (musicProvider || musicService.getTruthProvider())

    if (!spotifyConnected && !lastfmConnected) return
    const cachedProvider = musicProfile?.provider || null
    const shouldRefetchForProvider = Boolean(truthProvider && cachedProvider && cachedProvider !== truthProvider)
    if (musicProfile && !force && !shouldRefetchForProvider) return
    if (fetchingRef.current) return

    fetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      let rawProfile
      if (truthProvider === 'lastfm') {
        rawProfile = await buildLastfmProfile(timeRange)
      } else {
        const res = await musicProfileAPI.get({ time_range: timeRange, limit: 50 })
        rawProfile = unwrapProfileResponse(res.data)
      }

      const validation = validateProfilePayload(rawProfile)
      if (!validation.ok) {
        throw new Error(validation.reason)
      }

      const profile = normalizeProfile(rawProfile, truthProvider)
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
    isDegraded: Boolean(musicProfile?.isDegraded),
    canComputeIdentity: Boolean(musicProfile?.canComputeIdentity),
    canComputeAnalytics: Boolean(musicProfile?.canComputeAnalytics),
    canRenderGalaxy: Boolean(musicProfile?.canRenderGalaxy),
    confidence: musicProfile?.confidence || null,
    dataQuality: musicProfile?.dataQuality || null,
  }
}
