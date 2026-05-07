import { create } from 'zustand'

const useAuthStore = create((set, get) => ({
  user: null,
  sessionToken: null,
  bootPhase: 'booting',
  bootMessage: '',
  backendWarm: false,
  providers: {
    spotify: { connected: false, expiresAt: null },
    lastfm: { connected: false, username: null },
  },

  setSessionToken: (token) => {
    set({ sessionToken: token || null })
  },

  setUser: (user) => set({ user: user || null }),

  setBootState: (bootPhase, bootMessage = '') => set({ bootPhase, bootMessage }),

  applyBootstrap: (payload) => {
    const providers = payload?.providers || {}
    set({
      providers: {
        spotify: {
          connected: Boolean(providers?.spotify?.connected),
          expiresAt: providers?.spotify?.expires_at || null,
        },
        lastfm: {
          connected: Boolean(providers?.lastfm?.connected),
          username: providers?.lastfm?.username || null,
        },
      },
      backendWarm: Boolean(payload?.backend_warm),
      bootPhase: payload?.profile_boot_status === 'ready_to_hydrate'
        ? 'session_restoring'
        : payload?.auth_state === 'no_session'
          ? 'login_ready'
          : 'probing_session',
      bootMessage: '',
      user: payload?.user || null,
      sessionToken: payload?.auth_state === 'authenticated' ? 'cookie-session' : null,
    })
  },

  clearSession: () => {
    set({
      user: null,
      sessionToken: null,
      bootPhase: 'no_session',
    })
  },

  clearAllAuth: () => {
    get().clearSession()
    set({
      providers: {
        spotify: { connected: false, expiresAt: null },
        lastfm: { connected: false, username: null },
      },
      backendWarm: false,
      bootMessage: '',
    })
  },
}))

export default useAuthStore
