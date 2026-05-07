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
  isAuthenticated: false,

  spotifyToken: null,
  spotifyProfile: null,
  spotifyConnected: false,

  lastfmSession: null,
  lastfmUsername: null,
  lastfmConnected: false,

  musicProvider: null,
  sessionId: null,

  selectedSong: null,

  cinemaMode: false,
  setCinemaMode: (val) => set({ cinemaMode: val }),

  setUser: (user) => set({ user, isAuthenticated: Boolean(user), }),

  logout: () => {
    ;[
      'music_profile_time_range',
      'music_profile_cache_v1',
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
      sessionId: null,
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
    set({
      spotifyToken: token || null,
      spotifyConnected: Boolean(token),
      musicProvider: token ? 'spotify' : null,
    })
  },

  setSpotifyProfile: (profile) => set({ spotifyProfile: profile }),

  disconnectSpotify: () => {
    set({ spotifyToken: null, spotifyProfile: null, spotifyConnected: false, musicProvider: null })
  },

  setLastfm: (session, username) => {
    set({
      lastfmSession: session || null,
      lastfmUsername: username || null,
      lastfmConnected: Boolean(session && username),
      musicProvider: session ? 'lastfm' : null,
    })
  },

  disconnectLastfm: () => {
    set({ lastfmSession: null, lastfmUsername: null, lastfmConnected: false, musicProvider: null })
  },

  setProviderState: (state) => set((current) => ({
    spotifyConnected: Boolean(state?.spotifyConnected),
    lastfmConnected: Boolean(state?.lastfmConnected),
    musicProvider: state?.musicProvider || null,
    lastfmUsername: state?.lastfmUsername ?? current.lastfmUsername,
    spotifyProfile: state?.spotifyProfile ?? current.spotifyProfile,
    sessionId: state?.sessionId ?? current.sessionId,
  })),

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
