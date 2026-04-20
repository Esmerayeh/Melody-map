import axios from 'axios'
import { logClientEvent } from './observability'

const RAW_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''
const BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, '') : ''
const isProduction = import.meta.env.PROD

if (!BASE_URL && isProduction) {
  logClientEvent('api_base_url_missing', { level: 'error', message: 'VITE_API_URL is missing in production.' }, 'error')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function buildRequestId() {
  return `mm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeError(err) {
  const status = err?.response?.status || 0
  const data = err?.response?.data || {}
  const message =
    data?.error?.message ||
    data?.error ||
    data?.message ||
    err.message ||
    'Request failed'
  return {
    status,
    message,
    code: data?.error?.code || data?.code || null,
    requestId: err?.response?.headers?.['x-request-id'] || err?.config?.headers?.['X-Request-ID'] || null,
    raw: err,
  }
}

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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
  logClientEvent('api_request_failed', {
    url: err?.config?.url,
    method: err?.config?.method,
    status: normalized.status,
    message: normalized.message,
    requestId: normalized.requestId,
  }, 'warn')

  if (status === 401 && !config?.meta?.suppressAuthRedirect) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('melodymap:session-expired'))
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
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
  withRetry,
)

function unwrapEnvelope(response) {
  const payload = response?.data
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    response.data = payload.data
  }
  return response
}

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  exchangeSpotify: (code) => api.post('/auth/spotify/exchange', { code }),
  refreshSpotify: () => api.post('/auth/spotify/refresh'),
  exchangeLastfm: (code) => api.post('/auth/lastfm/exchange', { code }),
  getProviderStatus: () => api.get('/auth/providers/status'),
  disconnectSpotify: () => api.post('/auth/spotify/logout'),
  disconnectLastfm: () => api.post('/auth/lastfm/logout'),
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

const spotifyApi = axios.create({ baseURL: `${BASE_URL}/api`, withCredentials: true })
spotifyApi.interceptors.request.use(async (config) => {
  config.meta = { ...(config.meta || {}), suppressAuthRedirect: true }
  return attachRequestMetadata(config, spotifyApi)
})
spotifyApi.interceptors.response.use(unwrapEnvelope, withRetry)

export const spotifyAPI = {
  getProfile: () => spotifyApi.get('/spotify/me'),
  getTopTracks: (params) => spotifyApi.get('/spotify/top-tracks', { params }),
  getTopArtists: (params) => spotifyApi.get('/spotify/top-artists', { params }),
  getPlaylists: () => spotifyApi.get('/spotify/playlists'),
  getAudioFeatures: (track_ids) => spotifyApi.post('/spotify/audio-features', { track_ids }),
  searchTracks: (query, limit = 10) => spotifyApi.get('/spotify/search', { params: { q: query, limit } }),
  getRecentlyPlayed: (params) => spotifyApi.get('/spotify/recently-played', { params }),
  getSavedTracks: (params) => spotifyApi.get('/spotify/saved-tracks', { params }),
  getRecommendations: (params) => spotifyApi.get('/spotify/recommendations', { params }),
}

const lastfmApi = axios.create({ baseURL: `${BASE_URL}/api`, withCredentials: true })
lastfmApi.interceptors.request.use(async (config) => {
  config.meta = { ...(config.meta || {}), suppressAuthRedirect: true }
  return attachRequestMetadata(config, lastfmApi)
})
lastfmApi.interceptors.response.use(unwrapEnvelope, withRetry)

export const lastfmAPI = {
  getProfile: () => lastfmApi.get('/lastfm/me'),
  getTopTracks: (params) => lastfmApi.get('/lastfm/top-tracks', { params }),
  getTopArtists: (params) => lastfmApi.get('/lastfm/top-artists', { params }),
  getRecentTracks: (params) => lastfmApi.get('/lastfm/recent-tracks', { params }),
  getSimilarArtists: (artist) => lastfmApi.get('/lastfm/similar-artists', { params: { artist } }),
  getArtistTags: (artist) => lastfmApi.get('/lastfm/artist-tags', { params: { artist } }),
}

export const soulmateAPI = {
  syncProfile: (data) => api.post('/soulmate/profile', data, { meta: { suppressAuthRedirect: true } }),
  getMyProfile: () => api.get('/soulmate/profile/me', { meta: { suppressAuthRedirect: true } }),
  getMatches: () => api.get('/soulmate/matches', { meta: { suppressAuthRedirect: true } }),
  compare: (uid_b) => api.get(`/soulmate/compare/${uid_b}`, { meta: { suppressAuthRedirect: true } }),
  comparePublic: (slug) => api.get(`/soulmate/compare-public/${encodeURIComponent(slug)}`, { meta: { suppressAuthRedirect: true } }),
}

export const aestheticAPI = {
  get: (profile) => api.post('/aesthetic', profile),
  regenerate: (profile, seedOffset) => api.post('/aesthetic/regenerate', { ...profile, seed_offset: seedOffset }),
  personality: (profile) => api.post('/aesthetic/personality', profile),
  shared: (data) => api.post('/aesthetic/shared', data),
  vibe: (data) => api.post('/aesthetic/vibe', data),
  identity: (data) => api.post('/aesthetic/identity', data),
  paletteFromFeatures: (data) => api.post('/aesthetic/palette-from-features', data),
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

export const musicProfileAPI = {
  get: (params = {}) => spotifyApi.get('/music-profile', { params }),
}

export const publicProfileAPI = {
  get: (identifier) => api.get(`/public-profile/${encodeURIComponent(identifier)}`),
}

export const pinterestAPI = {
  getAesthetic: (data) => api.post('/pinterest-aesthetic', data),
}

export default api
