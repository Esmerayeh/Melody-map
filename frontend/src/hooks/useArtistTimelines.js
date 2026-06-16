/**
 * useArtistTimelines
 * ------------------
 * Fetches and compares artist lists across multiple Spotify time ranges so
 * galaxy nodes can be truthfully classified as:
 *
 *   ghost-star   — artist appears in long_term but NOT in short_term
 *                  ("former orbit")
 *   surge-star   — artist appears in short_term but NOT in medium/long_term
 *                  ("newly discovered obsession")
 *   anchor-star  — artist appears across all three ranges
 *                  ("core, recurring")
 *
 * Rules (01-decision-maker):
 *   - Only fetches when Spotify is connected (Last.fm has no time_range support)
 *   - Fires a secondary API call for the "other" time range only when on a
 *     galaxy/universe page — avoids redundant requests on the dashboard
 *   - Never fabricates ghost stars for authenticated users; shows "forming"
 *     state when data is absent
 *   - Demo mode: returns classifications from demoPlanet.js seed data
 *
 * @param {{ profile, isDemo, enabled }}
 * @returns {{ ghostIds: Set, surgeIds: Set, anchorIds: Set, loading, basis }}
 */
import { useMemo, useRef }              from 'react'
import { useQuery }                     from '@tanstack/react-query'
import { spotifyAPI }                   from '../services/api'
import useStore                         from '../store/useStore'
import useAuthStore                     from '../store/useAuthStore'
export { applyTimelineClassifications } from '../features/galaxy/artistClassification'

// Demo seed — mirrors demoPlanet.js artist metrics
const DEMO_GHOST_NAMES  = ['porcelain distance']
const DEMO_SURGE_NAMES  = ['neon bruise']
const DEMO_ANCHOR_NAMES = ['velvet collapse', 'pale shore', 'glass meridian', 'hollow archive']

// Stable Set singletons for the early-return branches. These MUST be reused
// across renders: consumers (MusicMap loadData) depend on `ghostIds`/`surgeIds`
// by reference, so returning `new Set()` each render churned loadData's identity
// → setModel → re-render → infinite loop ("Maximum update depth exceeded").
const EMPTY_SET       = new Set()
const DEMO_GHOST_SET  = new Set(DEMO_GHOST_NAMES)
const DEMO_SURGE_SET  = new Set(DEMO_SURGE_NAMES)
const DEMO_ANCHOR_SET = new Set(DEMO_ANCHOR_NAMES)

// ─────────────────────────────────────────────────────────────────────────────
// Helper: normalise artist ID/name into a stable key
// ─────────────────────────────────────────────────────────────────────────────
function artistKey(artist) {
  return (artist?.id || artist?.name || '').toLowerCase().replace(/\s+/g, '-')
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchSpotifyArtists(timeRange) {
  const { data } = await spotifyAPI.getTopArtists({ time_range: timeRange, limit: 50 })
  const items = data?.items || data || []
  return items.map((a) => ({
    id:    a.id      || a.spotify_id || null,
    name:  a.name    || '',
    key:   artistKey(a),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────
export default function useArtistTimelines({ profile = null, isDemo = false, enabled = false }) {
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const providers        = useAuthStore((s) => s.providers)
  const isSpotify        = spotifyConnected || providers?.spotify?.connected

  // ── Demo mode: return seed classifications instantly ──────────────────────
  if (isDemo) {
    return {
      ghostIds:  DEMO_GHOST_SET,
      surgeIds:  DEMO_SURGE_SET,
      anchorIds: DEMO_ANCHOR_SET,
      loading:   false,
      basis:     'demo-seed',
    }
  }

  // ── Authenticated Spotify: fetch short_term + long_term in parallel ────────
  const canFetch = enabled && isSpotify

  const shortQuery = useQuery({
    queryKey:  ['artist-timeline', 'short_term'],
    enabled:   canFetch,
    staleTime: 5 * 60 * 1000,     // 5 minutes
    retry:     1,
    queryFn:   () => fetchSpotifyArtists('short_term'),
  })

  const longQuery = useQuery({
    queryKey:  ['artist-timeline', 'long_term'],
    enabled:   canFetch,
    staleTime: 10 * 60 * 1000,    // 10 minutes
    retry:     1,
    queryFn:   () => fetchSpotifyArtists('long_term'),
  })

  const loading = shortQuery.isLoading || longQuery.isLoading

  // ── Classify artists once both queries resolve ────────────────────────────
  const { ghostIds, surgeIds, anchorIds } = useMemo(() => {
    const ghost  = new Set()
    const surge  = new Set()
    const anchor = new Set()

    const shortList = shortQuery.data
    const longList  = longQuery.data

    if (!shortList || !longList) return { ghostIds: ghost, surgeIds: surge, anchorIds: anchor }

    const shortKeys = new Set(shortList.map((a) => a.key))
    const longKeys  = new Set(longList.map((a) => a.key))

    // ghost = a TOP-TIER long-term artist that's dropped out of short_term — a
    // real "former orbit" (you played them a lot, not lately). Cap to the top
    // GHOST_FROM_TOP: short_term is a shallow window (e.g. 14 vs 50 long-term),
    // so without the cap your whole long tail gets branded "former orbit" (~39
    // of 50) just for sitting outside your recent handful. Deep catalog that was
    // never top-tier isn't a dropped orbit — it stays a plain star.
    const GHOST_FROM_TOP = 25
    longList.slice(0, GHOST_FROM_TOP).forEach((a) => {
      if (!shortKeys.has(a.key)) ghost.add(a.key)
    })

    // surge = short_term only (not in long_term)
    shortList.forEach((a) => {
      if (!longKeys.has(a.key)) surge.add(a.key)
    })

    // anchor = in both
    shortList.forEach((a) => {
      if (longKeys.has(a.key)) anchor.add(a.key)
    })

    return { ghostIds: ghost, surgeIds: surge, anchorIds: anchor }
  }, [shortQuery.data, longQuery.data])

  // ── If Spotify is not connected or data unavailable: honest empty state ───
  if (!isSpotify || !enabled) {
    return {
      ghostIds:  EMPTY_SET,
      surgeIds:  EMPTY_SET,
      anchorIds: EMPTY_SET,
      loading:   false,
      basis:     'unavailable',
    }
  }

  // Both queries errored → degraded state, not a lie
  if (shortQuery.error && longQuery.error) {
    return {
      ghostIds:  EMPTY_SET,
      surgeIds:  EMPTY_SET,
      anchorIds: EMPTY_SET,
      loading:   false,
      basis:     'fetch-failed',
    }
  }

  return {
    ghostIds,
    surgeIds,
    anchorIds,
    loading,
    basis: shortQuery.data && longQuery.data
      ? `spotify-timeline-diff:short(${ghostIds.size + surgeIds.size + anchorIds.size})+long`
      : loading
        ? 'loading'
        : 'partial',
  }
}

// applyTimelineClassifications is re-exported from artistClassification.js
// (pure utility, no external deps — importable from tests without API stubs)
