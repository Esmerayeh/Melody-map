/**
 * Custom hooks that wrap TanStack Query + musicService.
 * Pages import these instead of calling APIs directly.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { musicService } from '../services/musicService'
import { songsAPI, playlistAPI, recommendAPI } from '../services/api'
import useStore from '../store/useStore'

// ── Provider-aware hooks ───────────────────────────────────────────────────────

export function useTopTracks(params = {}) {
  const musicProvider = useStore((s) => s.musicProvider)
  return useQuery({
    queryKey:  ['topTracks', musicProvider, params],
    queryFn:   () => musicService.getTopTracks(params),
    enabled:   !!musicProvider && musicService.isConnected(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTopArtists(params = {}) {
  const musicProvider = useStore((s) => s.musicProvider)
  return useQuery({
    queryKey:  ['topArtists', musicProvider, params],
    queryFn:   () => musicService.getTopArtists(params),
    enabled:   !!musicProvider && musicService.isConnected(),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePlaylists() {
  const musicProvider = useStore((s) => s.musicProvider)
  return useQuery({
    queryKey:  ['playlists', musicProvider],
    queryFn:   () => musicService.getPlaylists(),
    enabled:   !!musicProvider && musicService.isConnected(),
    staleTime: 2 * 60 * 1000,
  })
}

// ── Search ─────────────────────────────────────────────────────────────────────

export function useSearch(query) {
  return useQuery({
    queryKey:  ['search', query],
    queryFn:   () => songsAPI.search(query).then((r) => r.data),
    enabled:   query.length >= 2,
    staleTime: 60 * 1000,
  })
}

// ── Recommendations ────────────────────────────────────────────────────────────

export function useRecommendations() {
  const userId = localStorage.getItem('userId')
  return useQuery({
    queryKey:  ['recommendations', userId],
    queryFn:   () => recommendAPI.get(userId).then((r) => r.data),
    enabled:   !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Playlist generation ────────────────────────────────────────────────────────

export function useGeneratePlaylist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mood) => playlistAPI.generate(mood).then((r) => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['playlists'] }),
  })
}
