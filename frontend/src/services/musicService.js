/**
 * Unified music data service.
 * Abstracts Spotify vs Last.fm so pages don't need to care which provider is active.
 */
import { spotifyAPI, lastfmAPI } from './api'

function getProvider() {
  return localStorage.getItem('music_provider') // 'spotify' | 'lastfm' | null
}

export const musicService = {
  /** Returns 'spotify', 'lastfm', or null */
  getProvider,

  isConnected() {
    const p = getProvider()
    if (p === 'spotify') return !!localStorage.getItem('spotify_token')
    if (p === 'lastfm')  return !!localStorage.getItem('lastfm_session')
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
