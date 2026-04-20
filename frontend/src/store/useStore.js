import { create } from 'zustand'
import { clearSpotifyStorage } from '../services/spotifySession'

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
  sessionToken: getStoredValue('token') || null,
  isAuthenticated: !!getStoredValue('token'),

  spotifyToken: null,
  spotifyProfile: null,
  spotifyConnected: false,

  lastfmSession: null,
  lastfmUsername: null,
  lastfmConnected: false,

  musicProvider: getStoredValue('music_provider') || null,
  providerConnected: false,
  demoModeEnabled: getStoredValue('melodymap_demo_mode') === 'true',
  introDismissed: getStoredValue('melodymap_intro_dismissed') === 'true',
  auralithSessions: getStoredJson('melodymap_auralith_sessions', []),
  auralithDrafts: getStoredJson('melodymap_auralith_drafts', {}),
  auralithActiveModuleId: getStoredValue('melodymap_auralith_active_module') || null,

  selectedSong: null,

  cinemaMode: false,
  setCinemaMode: (val) => set({ cinemaMode: val }),

  setUser: (user) => set({ user, isAuthenticated: !!getStoredValue('token'), sessionToken: getStoredValue('token') || null }),

  setSessionToken: (token) => {
    if (token) {
      setStoredValue('token', token)
      set({ sessionToken: token, isAuthenticated: true })
    } else {
      removeStoredValue('token')
      set({ sessionToken: null, isAuthenticated: false })
    }
  },

  clearSession: () => {
    removeStoredValue('token')
    removeStoredValue('userId')
    set({ user: null, sessionToken: null, isAuthenticated: false })
  },

  logout: () => {
    ;[
      'token',
      'userId',
      'music_provider',
      'music_profile_time_range',
      'vibe_features',
      'sonic_identity',
      'aesthetic_state',
      'emotional_cluster',
      'melodymap_auralith_sessions',
      'melodymap_auralith_drafts',
      'melodymap_auralith_active_module',
    ].forEach(removeStoredValue)

    clearSpotifyStorage()
    set({
      user: null,
      isAuthenticated: false,
      sessionToken: null,
      spotifyToken: null,
      spotifyProfile: null,
      spotifyConnected: false,
      providerConnected: false,
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
      auralithSessions: [],
      auralithDrafts: {},
      auralithActiveModuleId: null,
    })
  },

  setSpotifyConnected: ({ connected = false, profile = null } = {}) => {
    if (!connected) {
      const nextProvider = getStoredValue('music_provider') === 'spotify' ? null : getStoredValue('music_provider')
      if (!nextProvider) removeStoredValue('music_provider')
      clearSpotifyStorage()
      set({
        spotifyToken: null,
        spotifyProfile: profile,
        spotifyConnected: false,
        providerConnected: Boolean(nextProvider),
        musicProvider: nextProvider,
      })
      return
    }

    setStoredValue('music_provider', 'spotify')
    set({
      spotifyToken: null,
      spotifyProfile: profile,
      spotifyConnected: true,
      musicProvider: 'spotify',
      providerConnected: true,
    })
  },

  setSpotifyProfile: (profile) => set({ spotifyProfile: profile }),

  disconnectSpotify: () => {
    const provider = getStoredValue('music_provider')
    if (provider === 'spotify') {
      removeStoredValue('music_provider')
      set({
        spotifyToken: null,
        spotifyProfile: null,
        spotifyConnected: false,
        musicProvider: null,
        providerConnected: false,
      })
    } else {
      set({
        spotifyToken: null,
        spotifyProfile: null,
        spotifyConnected: false,
        providerConnected: Boolean(getStoredValue('music_provider')),
      })
    }
    clearSpotifyStorage()
  },

  setLastfmConnected: ({ connected = false, username = null } = {}) => {
    if (!connected) {
      const nextProvider = getStoredValue('music_provider') === 'lastfm' ? null : getStoredValue('music_provider')
      if (!nextProvider) removeStoredValue('music_provider')
      set({
        lastfmSession: null,
        lastfmUsername: username,
        lastfmConnected: false,
        musicProvider: nextProvider,
        providerConnected: Boolean(nextProvider),
      })
      return
    }

    setStoredValue('music_provider', 'lastfm')
    set({
      lastfmSession: null,
      lastfmUsername: username,
      lastfmConnected: true,
      musicProvider: 'lastfm',
      providerConnected: true,
    })
  },

  disconnectLastfm: () => {
    const provider = getStoredValue('music_provider')
    if (provider === 'lastfm') {
      removeStoredValue('music_provider')
      set({
        lastfmSession: null,
        lastfmUsername: null,
        lastfmConnected: false,
        musicProvider: null,
        providerConnected: false,
      })
    } else {
      set({
        lastfmSession: null,
        lastfmUsername: null,
        lastfmConnected: false,
        providerConnected: Boolean(getStoredValue('music_provider')),
      })
    }
  },

  setSelectedSong: (song) => set({ selectedSong: song }),

  setDemoModeEnabled: (enabled) => {
    if (enabled) setStoredValue('melodymap_demo_mode', 'true')
    else removeStoredValue('melodymap_demo_mode')
    set({ demoModeEnabled: !!enabled })
  },

  setIntroDismissed: (dismissed) => {
    if (dismissed) setStoredValue('melodymap_intro_dismissed', 'true')
    else removeStoredValue('melodymap_intro_dismissed')
    set({ introDismissed: !!dismissed })
  },

  setAuralithActiveModuleId: (moduleId) => {
    if (moduleId) setStoredValue('melodymap_auralith_active_module', moduleId)
    else removeStoredValue('melodymap_auralith_active_module')
    set({ auralithActiveModuleId: moduleId || null })
  },

  setAuralithDraft: (moduleId, value) => set((state) => {
    const nextDrafts = {
      ...(state.auralithDrafts || {}),
      [moduleId]: value,
    }
    setStoredValue('melodymap_auralith_drafts', JSON.stringify(nextDrafts))
    return { auralithDrafts: nextDrafts }
  }),

  saveAuralithSession: (session) => set((state) => {
    const previous = Array.isArray(state.auralithSessions) ? state.auralithSessions : []
    const nextSessions = [session, ...previous.filter((entry) => entry?.id !== session?.id)].slice(0, 12)
    setStoredValue('melodymap_auralith_sessions', JSON.stringify(nextSessions))
    return { auralithSessions: nextSessions }
  }),

  removeAuralithSession: (sessionId) => set((state) => {
    const nextSessions = (state.auralithSessions || []).filter((entry) => entry?.id !== sessionId)
    setStoredValue('melodymap_auralith_sessions', JSON.stringify(nextSessions))
    return { auralithSessions: nextSessions }
  }),

  clearAuralithSessions: () => {
    removeStoredValue('melodymap_auralith_sessions')
    set({ auralithSessions: [] })
  },

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
