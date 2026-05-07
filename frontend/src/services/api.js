import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''
const isProduction = import.meta.env.PROD

if (!BASE_URL && isProduction) {
  console.error('VITE_API_URL is missing in production; API requests may fail.')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function buildRequestId() {
  return `mm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function readCookie(name) {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : null
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

const rootApi = axios.create({
  baseURL: BASE_URL || '/',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

async function attachRequestMetadata(config, client) {
  const nextConfig = { ...config }
  nextConfig.headers = nextConfig.headers || {}
  nextConfig.headers['X-Request-ID'] = nextConfig.headers['X-Request-ID'] || buildRequestId()
  const method = (nextConfig.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = readCookie('mm_csrf')
    if (csrf) nextConfig.headers['X-CSRF-Token'] = nextConfig.headers['X-CSRF-Token'] || csrf
  }
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
    window.dispatchEvent(new CustomEvent('melodymap:session-expired', { detail: normalized }))
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  return Promise.reject(err)
}

api.interceptors.request.use(async (config) => {
  return attachRequestMetadata(config, api)
})

api.interceptors.response.use(
  (res) => res,
  withRetry
)

rootApi.interceptors.request.use(async (config) => {
  return attachRequestMetadata(config, rootApi)
})
rootApi.interceptors.response.use(
  (res) => res,
  withRetry
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  exchangeSpotify: (code) => rootApi.post('/auth/spotify/exchange', { code }),
  exchangeLastfm: (code) => rootApi.post('/auth/lastfm/exchange', { code }),
  refreshSpotify: () => rootApi.post('/auth/spotify/refresh', {}),
  logout: () => api.post('/auth/logout', {}, { meta: { suppressAuthRedirect: true } }),
  logoutSpotify: () => rootApi.post('/auth/spotify/logout', {}, { meta: { suppressAuthRedirect: true } }),
  logoutLastfm: () => rootApi.post('/auth/lastfm/logout', {}, { meta: { suppressAuthRedirect: true } }),
}

export const sessionAPI = {
  bootstrap: () => api.get('/session/bootstrap', { meta: { suppressAuthRedirect: true } }),
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
  getCandidates: (topK = 100) => api.get(`/recommendations/candidates?top_k=${topK}`),
  getRanked: (topK = 100) => api.get(`/recommendations/ranked?top_k=${topK}`),
}

// Spotify API -- provider cookies are attached automatically.
const spotifyApi = axios.create({ baseURL: `${BASE_URL}/api`, withCredentials: true })
spotifyApi.interceptors.request.use(async (config) => {
  config.meta = { ...(config.meta || {}), suppressAuthRedirect: true }
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

// Last.fm API -- provider cookies are attached automatically.
const lastfmApi = axios.create({ baseURL: `${BASE_URL}/api`, withCredentials: true })
lastfmApi.interceptors.request.use(async (config) => {
  config.meta = { ...(config.meta || {}), suppressAuthRedirect: true }
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
  syncProfile: (data)    => api.post('/soulmate/profile', data, { meta: { suppressAuthRedirect: true } }),
  getMyProfile:()        => api.get('/soulmate/profile/me', { meta: { suppressAuthRedirect: true } }),
  getMatches:  ()        => api.get('/soulmate/matches', { meta: { suppressAuthRedirect: true } }),
  compare:     (uid_b)   => api.get(`/soulmate/compare/${uid_b}`, { meta: { suppressAuthRedirect: true } }),
  comparePublic: (slug)  => api.get(`/soulmate/compare-public/${encodeURIComponent(slug)}`, { meta: { suppressAuthRedirect: true } }),
  updatePrivacy: (data)  => api.post('/soulmate/privacy', data, { meta: { suppressAuthRedirect: true } }),
  getNetwork: ()         => api.get('/soulmate/network', { meta: { suppressAuthRedirect: true } }),
  createCoCurate: (data) => api.post('/soulmate/co-curate', data, { meta: { suppressAuthRedirect: true } }),
  listCoCurate: ()       => api.get('/soulmate/co-curate', { meta: { suppressAuthRedirect: true } }),
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
  agentTurn: (data) => api.post('/auralith/agent-turn', data),
  rag: (data) => api.post('/auralith/rag', data),
  threads: (limit = 8) => api.get(`/auralith/threads?limit=${limit}`),
}

export const eventsAPI = {
  ingestListening: (data) => api.post('/events/listening', data, { headers: { 'Idempotency-Key': buildRequestId() } }),
  getRecentListening: (limit = 12) => api.get(`/events/listening?limit=${limit}`),
  getLiveSignal: (limit = 20) => api.get(`/events/live-signal?limit=${limit}`),
  trainEmbeddings: () => api.post('/ml/train-embeddings'),
}

export const recommendationEventsAPI = {
  impression: (data) => api.post('/recommendations/impression', data),
  click: (data) => api.post('/recommendations/click', data),
  save: (data) => api.post('/recommendations/save', data),
  skip: (data) => api.post('/recommendations/skip', data),
  replay: (data) => api.post('/recommendations/replay', data),
  dwell: (data) => api.post('/recommendations/dwell', data),
  abandon: (data) => api.post('/recommendations/abandon', data),
}

export const socialAPI = {
  getPublicProfile: (userId) => api.get(`/social/public-profile/${encodeURIComponent(userId)}`),
  updatePublicProfile: (data) => api.post('/social/public-profile', data),
  searchSoulmates: (data) => api.post('/social/soulmate/search', data),
  compareSoulmate: (data) => api.post('/social/soulmate/compare', data),
  listRequests: (status = '') => api.get(`/social/soulmate/requests${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  requestSoulmate: (data) => api.post('/social/soulmate/request', data),
  acceptSoulmate: (data) => api.post('/social/soulmate/accept', data),
}

export const identityAPI = {
  getDrift: (range = 'all') => api.get(`/identity/drift?range=${encodeURIComponent(range)}`),
}

export const shareAPI = {
  identityCard: (data) => api.post('/share/identity-card', data),
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
