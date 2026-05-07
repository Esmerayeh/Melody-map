/**
 * Unified music data service.
 * Abstracts Spotify vs Last.fm so pages don't need to care which provider is active.
 */
import { spotifyAPI, lastfmAPI } from './api'
import useStore from '../store/useStore'

function getProvider() {
  const { musicProvider, spotifyConnected, lastfmConnected } = useStore.getState()
  if (musicProvider === 'spotify' && spotifyConnected) return 'spotify'
  if (musicProvider === 'lastfm' && lastfmConnected) return 'lastfm'
  if (spotifyConnected) return 'spotify'
  if (lastfmConnected) return 'lastfm'
  return null
}

function getTruthProvider() {
  const { spotifyConnected, lastfmConnected } = useStore.getState()
  if (spotifyConnected) return 'spotify'
  if (lastfmConnected) return 'lastfm'
  return null
}

export const musicService = {
  /** Returns 'spotify', 'lastfm', or null */
  getProvider,
  getTruthProvider,

  isConnected() {
    const p = getProvider()
    if (p === 'spotify' || p === 'lastfm') return true
    return false
  },

  async getProfile() {
    const p = getProvider()
    if (p === 'spotify') return (await spotifyAPI.getProfile()).data
    if (p === 'lastfm')  return (await lastfmAPI.getProfile()).data
    return null
  },

  async getTopTracks(params = {}) {
    const p = getProvider()
    if (p === 'spotify') {
      const { data } = await spotifyAPI.getTopTracks({ limit: 50, time_range: 'medium_term', ...params })
      return data
    }
    if (p === 'lastfm') {
      const { data } = await lastfmAPI.getTopTracks({ limit: 50, period: 'overall', ...params })
      return data
    }
    return []
  },

  async getTopArtists(params = {}) {
    const p = getProvider()
    if (p === 'spotify') {
      const { data } = await spotifyAPI.getTopArtists({ limit: 50, time_range: 'medium_term', ...params })
      return data
    }
    if (p === 'lastfm') {
      const { data } = await lastfmAPI.getTopArtists({ limit: 50, period: 'overall', ...params })
      return data
    }
    return []
  },

  async getPlaylists() {
    const p = getProvider()
    if (p === 'spotify') {
      const { data } = await spotifyAPI.getPlaylists()
      return data
    }
    // Last.fm has no playlist concept — return empty
    return []
  },

  async getRecentTracks(params = {}) {
    const p = getProvider()
    if (p === 'lastfm') {
      const { data } = await lastfmAPI.getRecentTracks({ limit: 20, ...params })
      return data
    }
    return []
  },

  /** Spotify-only: audio features for map visualization */
  async getAudioFeatures(trackIds) {
    const p = getProvider()
    if (p === 'spotify' && trackIds?.length) {
      const { data } = await spotifyAPI.getAudioFeatures(trackIds)
      return data
    }
    return []
  },

  /** Last.fm-only: similar artists for recommendations */
  async getSimilarArtists(artist) {
    const p = getProvider()
    if (p === 'lastfm' && artist) {
      const { data } = await lastfmAPI.getSimilarArtists(artist)
      return data
    }
    return []
  },

  async getArtistTags(artist) {
    const p = getProvider()
    if (p === 'lastfm' && artist) {
      const { data } = await lastfmAPI.getArtistTags(artist)
      return data
    }
    return []
  },
}

export default musicService
