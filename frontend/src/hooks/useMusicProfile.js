/**
 * useMusicProfile — central data hook
 *
 * Fetches /api/music-profile via musicProfileAPI (spotifyApi axios instance)
 * which automatically injects X-Spotify-Token via its request interceptor.
 * Result is cached in Zustand — all pages read from here, no direct API calls.
 */
import { useEffect, useCallback, useRef } from 'react'
import { musicProfileAPI } from '../services/api'
import useStore from '../store/useStore'
import { computePersonality, computeMBTI } from '../utils/personalityEngine'

// Normalize backend response to guarantee consistent field names.
// Also computes MBTI + personality ONCE here so every consumer reads
// profile.mbti / profile.personality — no duplicate computation anywhere.
function normalizeProfile(raw) {
  if (!raw) return null

  const normalized = {
    ...raw,
    topArtists:       raw.topArtists   || raw.artists   || [],
    topTracks:        raw.topTracks    || raw.tracks     || [],
    genres:           raw.genres       || [],
    audioFeatures:    raw.audioFeatures || {},
    analyticsMetrics: raw.analyticsMetrics || null,
    galaxyNodes:      raw.galaxyNodes  || [],
    aestheticTags:    raw.aestheticTags || [],
    userProfile:      raw.userProfile  || null,
    timeRange:        raw.timeRange    || 'medium_term',
  }

  // Only compute MBTI when we have real data — all three fields must be present
  const af      = normalized.audioFeatures
  const hasData = (
    af.energy != null &&
    normalized.topArtists.length > 0 &&
    normalized.genres.length > 0
  )

  if (hasData) {
    normalized.personality = computePersonality(af)
    normalized.mbti        = computeMBTI(normalized)
  } else {
    normalized.personality = null
    normalized.mbti        = null
  }

  return normalized
}

export default function useMusicProfile({ autoFetch = true } = {}) {
  const spotifyConnected    = useStore((s) => s.spotifyConnected)
  const musicProfile        = useStore((s) => s.musicProfile)
  const musicProfileLoading = useStore((s) => s.musicProfileLoading)
  const musicProfileError   = useStore((s) => s.musicProfileError)
  const timeRange           = useStore((s) => s.musicProfileTimeRange)
  const setMusicProfile     = useStore((s) => s.setMusicProfile)
  const setLoading          = useStore((s) => s.setMusicProfileLoading)
  const setError            = useStore((s) => s.setMusicProfileError)
  const setVibeFeatures     = useStore((s) => s.setVibeFeatures)
  const setSonicIdentity    = useStore((s) => s.setSonicIdentity)

  const fetchingRef = useRef(false)

  const doFetch = useCallback(async (force = false) => {
    if (!spotifyConnected) return
    if (musicProfile && !force) return
    if (fetchingRef.current) return

    fetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      // spotifyApi interceptor in api.js injects X-Spotify-Token automatically
      const res = await musicProfileAPI.get({ time_range: timeRange, limit: 50 })
      const profile = normalizeProfile(res.data)
      setMusicProfile(profile)

      // Hydrate side-effects into store
      const af = profile.audioFeatures || {}
      if (af.energy != null) setVibeFeatures({ energy: af.energy, valence: af.valence })

      const metrics = profile.analyticsMetrics || {}
      if (metrics.mood) {
        setSonicIdentity({
          mood:       metrics.mood,
          energy:     metrics.energyScore,
          valence:    metrics.valenceScore,
          diversity:  metrics.diversityScore,
          nostalgia:  metrics.nostalgiaIndex,
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
  }, [spotifyConnected, musicProfile, timeRange, setMusicProfile, setLoading, setError, setVibeFeatures, setSonicIdentity])

  useEffect(() => {
    if (autoFetch) doFetch()
  }, [autoFetch, doFetch])

  return {
    profile:  musicProfile,
    loading:  musicProfileLoading,
    error:    musicProfileError,
    refetch:  () => doFetch(true),
    timeRange,
  }
}
