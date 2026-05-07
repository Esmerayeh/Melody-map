/**
 * useMusicProfile -- canonical profile bootstrap via React Query, with a small
 * profile store for cross-route persistence and preferences.
 */
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { musicProfileAPI } from '../services/api'
import { musicService } from '../services/musicService'
import useStore from '../store/useStore'
import useProfileStore from '../store/useProfileStore'
import { buildGenreList, PROFILE_SCHEMA_VERSION } from '../services/profileAdapters.js'
import { normalizeProfileResponse } from '../services/dataAdapters'
import { queryKeys } from '../lib/queryKeys'

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
    }),
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
      overall: Math.min(0.48, Number((((topArtists.length / 50) * 0.45) + ((genres.length / 12) * 0.2)).toFixed(3))),
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
  const setVibeFeatures = useStore((s) => s.setVibeFeatures)
  const setSonicIdentity = useStore((s) => s.setSonicIdentity)
  const setLegacyMusicProfile = useStore((s) => s.setMusicProfile)
  const clearLegacyMusicProfile = useStore((s) => s.clearMusicProfile)
  const storedProfile = useProfileStore((s) => s.profile)
  const storedError = useProfileStore((s) => s.error)
  const timeRange = useProfileStore((s) => s.timeRange)
  const cachedProvider = useProfileStore((s) => s.cachedProvider)
  const cachedAt = useProfileStore((s) => s.cachedAt)
  const setProfile = useProfileStore((s) => s.setProfile)
  const setError = useProfileStore((s) => s.setError)
  const queryClient = useQueryClient()

  const truthProvider = spotifyConnected
    ? 'spotify'
    : (musicProvider || musicService.getTruthProvider())
  const enabled = Boolean(autoFetch && (spotifyConnected || lastfmConnected))

  const query = useQuery({
    queryKey: queryKeys.musicProfile(truthProvider, timeRange),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      let rawProfile
      if (truthProvider === 'lastfm') {
        rawProfile = await buildLastfmProfile(timeRange)
      } else {
        const res = await musicProfileAPI.get({ time_range: timeRange, limit: 50 })
        rawProfile = res.data
      }

      const normalized = normalizeProfileResponse(rawProfile, truthProvider)
      if (normalized.status === 'failed' || !normalized.data) {
        throw new Error(normalized.warnings?.[0] || 'Failed to load music profile')
      }
      return normalized.data
    },
  })

  useEffect(() => {
    if (query.data) {
      setProfile(query.data, { provider: truthProvider, timeRange })
      setLegacyMusicProfile(query.data)
      const af = query.data.audioFeatures || {}
      if (af.energy != null || af.valence != null) {
        setVibeFeatures({ energy: af.energy, valence: af.valence })
      }

      const metrics = query.data.analyticsMetrics || {}
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
    }
  }, [query.data, setLegacyMusicProfile, setProfile, setSonicIdentity, setVibeFeatures])

  useEffect(() => {
    if (query.error) {
      setError(query.error.message || 'Failed to load music profile')
    } else if (query.data) {
      setError(null)
    }
  }, [query.data, query.error, setError])

  const cachedProfileMatchesProvider = !storedProfile || !cachedProvider || cachedProvider === truthProvider
  const profile = query.data || (cachedProfileMatchesProvider ? storedProfile : null)
  const error = query.error?.message || storedError
  const loading = enabled && query.isLoading && !profile

  return {
    profile,
    loading,
    error,
    refetch: async () => {
      useProfileStore.getState().clearProfile()
      clearLegacyMusicProfile()
      await queryClient.invalidateQueries({ queryKey: ['music-profile'] })
      return query.refetch()
    },
    timeRange,
    musicProvider: truthProvider,
    isDegraded: Boolean(profile?.isDegraded),
    canComputeIdentity: Boolean(profile?.canComputeIdentity),
    canComputeAnalytics: Boolean(profile?.canComputeAnalytics),
    canRenderGalaxy: Boolean(profile?.canRenderGalaxy),
    confidence: profile?.confidence || null,
    dataQuality: profile?.dataQuality || null,
    cachedAt,
    phase: (() => {
      if (loading && !profile) return 'loading'
      if (error && !profile) return 'error'
      if (!profile) return 'empty'
      if (!query.data && profile) return 'partial'
      if (profile?.isDegraded) return 'partial'
      return 'ready'
    })(),
    tier: (() => {
      if (error && !profile) return 'failed'
      if (!profile) return 'limited'
      const overall = profile?.confidence?.overall ?? 0
      if (overall >= 0.78) return 'rich'
      if (overall >= 0.55) return 'medium'
      if (overall >= 0.35) return 'sparse'
      return 'limited'
    })(),
    readiness: {
      analytics: Boolean(profile?.analyticsReadiness?.ready),
      identity: Boolean(profile?.identityReadiness?.ready),
      soulmate: Boolean(profile?.soulmateReadiness?.ready),
      galaxy: Boolean(profile?.canRenderGalaxy),
    },
  }
}
