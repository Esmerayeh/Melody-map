import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
}

export const mapAPI = {
  getData: () => api.get('/map/data'),
  generate: () => api.post('/map/generate'),
}

export const songsAPI = {
  search: (q) => api.get(`/songs/search?q=${q}`),
  getSimilar: (id) => api.get(`/songs/${id}/similar`),
}

export const playlistAPI = {
  generate: (mood) => api.post('/playlists/generate', { mood }),
}

export const recommendAPI = {
  get: (userId) => api.get(`/recommendations/${userId}`),
}

// Spotify API — passes spotify_token via custom header
const spotifyApi = axios.create({ baseURL: '/api' })
spotifyApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('spotify_token')
  if (token) config.headers['X-Spotify-Token'] = token
  return config
})

export const spotifyAPI = {
  getProfile:          () => spotifyApi.get('/spotify/me'),
  getTopTracks:        (params) => spotifyApi.get('/spotify/top-tracks', { params }),
  getTopArtists:       (params) => spotifyApi.get('/spotify/top-artists', { params }),
  getPlaylists:        () => spotifyApi.get('/spotify/playlists'),
  getAudioFeatures:    (track_ids) => spotifyApi.post('/spotify/audio-features', { track_ids }),
  searchTracks:        (query, limit = 10) => spotifyApi.get('/spotify/search', { params: { q: query, limit } }),
  getRecentlyPlayed:   (params) => spotifyApi.get('/spotify/recently-played', { params }),
  getSavedTracks:      (params) => spotifyApi.get('/spotify/saved-tracks', { params }),
  getRecommendations:  (params) => spotifyApi.get('/spotify/recommendations', { params }),
}

// Last.fm API — passes session key + username via custom headers
const lastfmApi = axios.create({ baseURL: '/api' })
lastfmApi.interceptors.request.use((config) => {
  const session  = localStorage.getItem('lastfm_session')
  const username = localStorage.getItem('lastfm_username')
  if (session)  config.headers['X-Lastfm-Session']  = session
  if (username) config.headers['X-Lastfm-User']     = username
  return config
})

export const lastfmAPI = {
  getProfile:       () => lastfmApi.get('/lastfm/me'),
  getTopTracks:     (params) => lastfmApi.get('/lastfm/top-tracks', { params }),
  getTopArtists:    (params) => lastfmApi.get('/lastfm/top-artists', { params }),
  getRecentTracks:  (params) => lastfmApi.get('/lastfm/recent-tracks', { params }),
  getSimilarArtists:(artist)  => lastfmApi.get('/lastfm/similar-artists', { params: { artist } }),
  getArtistTags:    (artist)  => lastfmApi.get('/lastfm/artist-tags', { params: { artist } }),
}

export const soulmateAPI = {
  syncProfile: (data)    => api.post('/soulmate/profile', data),
  getMyProfile:()        => api.get('/soulmate/profile/me'),
  getMatches:  ()        => api.get('/soulmate/matches'),
  compare:     (uid_b)   => api.get(`/soulmate/compare/${uid_b}`),
}

export const aestheticAPI = {
  get:                  (profile)              => api.post('/aesthetic', profile),
  regenerate:           (profile, seedOffset)  => api.post('/aesthetic/regenerate', { ...profile, seed_offset: seedOffset }),
  personality:          (profile)              => api.post('/aesthetic/personality', profile),
  shared:               (data)                 => api.post('/aesthetic/shared', data),
  vibe:                 (data)                 => api.post('/aesthetic/vibe', data),
  identity:             (data)                 => api.post('/aesthetic/identity', data),
  paletteFromFeatures:  (data)                 => api.post('/aesthetic/palette-from-features', data),
}

export const discoverAPI = {
  playlists: (profile, opts = {}) =>
    api.post('/discover/playlists', { ...profile, ...opts }),
}

// Music Profile — single endpoint that returns the full aggregated profile
export const musicProfileAPI = {
  get: (params = {}) => spotifyApi.get('/music-profile', { params }),
}

// Public profile — no auth required, used for soulmate invite links
export const publicProfileAPI = {
  get: (identifier) => api.get(`/public-profile/${encodeURIComponent(identifier)}`),
}

// Pinterest aesthetic board
export const pinterestAPI = {
  getAesthetic: (data) => api.post('/pinterest-aesthetic', data),
}

export default api
