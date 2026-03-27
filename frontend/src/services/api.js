import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''
const isProduction = import.meta.env.PROD

if (!BASE_URL && isProduction) {
  console.error('VITE_API_URL is missing in production; API requests may fail.')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function buildRequestId() {
  return `mm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeError(err) {
  const status = err?.response?.status || 0
  const data = err?.response?.data || {}
  const message = data?.error || data?.message || err.message || 'Request failed'
  return {
    status,
    message,
    code: data?.code || null,
    requestId: err?.response?.headers?.['x-request-id'] || err?.config?.headers?.['X-Request-ID'] || null,
    raw: err,
  }
}

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' }
})

async function attachRequestMetadata(config, client) {
  const nextConfig = { ...config }
  nextConfig.headers = nextConfig.headers || {}
  nextConfig.headers['X-Request-ID'] = nextConfig.headers['X-Request-ID'] || buildRequestId()
  nextConfig._retryClient = client
  return nextConfig
}

async function withRetry(err) {
  const config = err?.config
  const status = err?.response?.status
  const method = (config?.method || 'get').toLowerCase()
  const canRetry = status === 429 && ['get', 'head'].includes(method) && !(config?._retried)

  if (canRetry) {
    config._retried = true
    const retryAfterHeader = Number(err?.response?.headers?.['retry-after'])
    const retryDelayMs = Number.isFinite(retryAfterHeader) ? retryAfterHeader * 1000 : 750
    await sleep(retryDelayMs)
    return (config?._retryClient || api)(config)
  }

  const normalized = normalizeError(err)
  err.normalized = normalized

  if (status === 401 && !config?.meta?.suppressAuthRedirect) {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  return Promise.reject(err)
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return attachRequestMetadata(config, api)
})

api.interceptors.response.use(
  (res) => res,
  withRetry
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
const spotifyApi = axios.create({ baseURL: `${BASE_URL}/api` })
spotifyApi.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('spotify_token')
  if (token) config.headers['X-Spotify-Token'] = token
  return attachRequestMetadata(config, spotifyApi)
})
spotifyApi.interceptors.response.use((res) => res, withRetry)

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
const lastfmApi = axios.create({ baseURL: `${BASE_URL}/api` })
lastfmApi.interceptors.request.use(async (config) => {
  const session  = localStorage.getItem('lastfm_session')
  const username = localStorage.getItem('lastfm_username')
  if (session)  config.headers['X-Lastfm-Session']  = session
  if (username) config.headers['X-Lastfm-User']     = username
  return attachRequestMetadata(config, lastfmApi)
})
lastfmApi.interceptors.response.use((res) => res, withRetry)

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
  getMyProfile:()        => api.get('/soulmate/profile/me', { meta: { suppressAuthRedirect: true } }),
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

export const auralithAPI = {
  generatePlaylist: (data) => api.post('/auralith/generate-playlist', data),
  analyzeTaste: (data) => api.post('/auralith/analyze-taste', data),
  explainSong: (data) => api.post('/auralith/explain-song', data),
  critiquePlaylist: (data) => api.post('/auralith/critique-playlist', data),
  conceptPlaylist: (data) => api.post('/auralith/concept-playlist', data),
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
