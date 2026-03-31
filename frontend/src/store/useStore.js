import { create } from 'zustand'

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getStoredValue(key, fallback = null) {
  const storage = getStorage()
  if (!storage) return fallback

  try {
    const value = storage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

function setStoredValue(key, value) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(key, value)
  } catch {
    // Ignore storage write failures so the app can still render.
  }
}

function removeStoredValue(key) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(key)
  } catch {
    // Ignore storage cleanup failures so the app can still render.
  }
}

function getStoredJson(key, fallback = null) {
  const raw = getStoredValue(key, null)
  if (raw == null) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    removeStoredValue(key)
    return fallback
  }
}

const useStore = create((set) => ({
  user: null,
  isAuthenticated: !!(
    getStoredValue('token') ||
    getStoredValue('spotify_token') ||
    getStoredValue('lastfm_session')
  ),

  spotifyToken: getStoredValue('spotify_token') || null,
  spotifyProfile: null,
  spotifyConnected: !!getStoredValue('spotify_token'),

  lastfmSession: getStoredValue('lastfm_session') || null,
  lastfmUsername: getStoredValue('lastfm_username') || null,
  lastfmConnected: !!getStoredValue('lastfm_session'),

  musicProvider: getStoredValue('music_provider') || null,

  selectedSong: null,

  cinemaMode: false,
  setCinemaMode: (val) => set({ cinemaMode: val }),

  setUser: (user) => set({ user, isAuthenticated: true }),

  logout: () => {
    ;[
      'token',
      'userId',
      'spotify_token',
      'spotify_refresh_token',
      'spotify_token_expiry',
      'lastfm_session',
      'lastfm_username',
      'music_provider',
      'music_profile_time_range',
      'vibe_features',
      'sonic_identity',
      'aesthetic_state',
      'emotional_cluster',
    ].forEach(removeStoredValue)

    set({
      user: null,
      isAuthenticated: false,
      spotifyToken: null,
      spotifyProfile: null,
      spotifyConnected: false,
      lastfmSession: null,
      lastfmUsername: null,
      lastfmConnected: false,
      musicProvider: null,
      musicProfile: null,
      musicProfileLoading: false,
      musicProfileError: null,
      vibeFeatures: null,
      sonicIdentity: null,
      aestheticState: null,
      emotionalCluster: null,
    })
  },

  setSpotifyToken: (token, refreshToken) => {
    setStoredValue('spotify_token', token)
    setStoredValue('music_provider', 'spotify')
    if (refreshToken) setStoredValue('spotify_refresh_token', refreshToken)
    set({ spotifyToken: token, spotifyConnected: true, musicProvider: 'spotify', isAuthenticated: true })
  },

  setSpotifyProfile: (profile) => set({ spotifyProfile: profile }),

  disconnectSpotify: () => {
    removeStoredValue('spotify_token')
    removeStoredValue('spotify_refresh_token')
    const provider = getStoredValue('music_provider')
    if (provider === 'spotify') {
      removeStoredValue('music_provider')
      set({ spotifyToken: null, spotifyProfile: null, spotifyConnected: false, musicProvider: null })
    } else {
      set({ spotifyToken: null, spotifyProfile: null, spotifyConnected: false })
    }
  },

  setLastfm: (session, username) => {
    setStoredValue('lastfm_session', session)
    setStoredValue('lastfm_username', username)
    setStoredValue('music_provider', 'lastfm')
    set({
      lastfmSession: session,
      lastfmUsername: username,
      lastfmConnected: true,
      musicProvider: 'lastfm',
      isAuthenticated: true,
    })
  },

  disconnectLastfm: () => {
    removeStoredValue('lastfm_session')
    removeStoredValue('lastfm_username')
    const provider = getStoredValue('music_provider')
    if (provider === 'lastfm') {
      removeStoredValue('music_provider')
      set({ lastfmSession: null, lastfmUsername: null, lastfmConnected: false, musicProvider: null })
    } else {
      set({ lastfmSession: null, lastfmUsername: null, lastfmConnected: false })
    }
  },

  setSelectedSong: (song) => set({ selectedSong: song }),

  aestheticState: getStoredJson('aesthetic_state', null),
  setAestheticState: (state) => {
    if (state) setStoredValue('aesthetic_state', JSON.stringify(state))
    else removeStoredValue('aesthetic_state')
    set({ aestheticState: state })
  },

  vibeFeatures: getStoredJson('vibe_features', null),
  setVibeFeatures: (features) => {
    if (features) setStoredValue('vibe_features', JSON.stringify(features))
    else removeStoredValue('vibe_features')
    set({ vibeFeatures: features })
  },

  sonicIdentity: getStoredJson('sonic_identity', null),
  setSonicIdentity: (identity) => {
    if (identity) setStoredValue('sonic_identity', JSON.stringify(identity))
    else removeStoredValue('sonic_identity')
    set({ sonicIdentity: identity })
  },

  emotionalCluster: getStoredValue('emotional_cluster') || null,
  setEmotionalCluster: (cluster) => {
    if (cluster) setStoredValue('emotional_cluster', cluster)
    else removeStoredValue('emotional_cluster')
    set({ emotionalCluster: cluster })
  },

  musicProfile: null,
  musicProfileLoading: false,
  musicProfileError: null,
  musicProfileTimeRange: getStoredValue('music_profile_time_range') || 'medium_term',

  setMusicProfile: (profile) => set({ musicProfile: profile, musicProfileError: null }),
  setMusicProfileLoading: (loading) => set({ musicProfileLoading: loading }),
  setMusicProfileError: (error) => set({ musicProfileError: error }),
  setMusicProfileTimeRange: (range) => {
    setStoredValue('music_profile_time_range', range)
    set({ musicProfileTimeRange: range, musicProfile: null })
  },
  clearMusicProfile: () => set({ musicProfile: null, musicProfileError: null }),
}))

export default useStore
