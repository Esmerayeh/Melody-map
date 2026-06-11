import { create } from 'zustand'
import { writeHadSession } from '../app/shellEntry'

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
    // Evidence flag for cold-load entry: the backend has CONFIRMED session
    // state, so record it. This is what lets a returning user open straight
    // into the shell next time, even if the backend is cold-starting.
    writeHadSession(payload?.auth_state !== 'no_session')
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
          : 'session_ready',
      bootMessage: '',
      user: payload?.user || null,
      sessionToken: payload?.auth_state === 'authenticated' ? 'cookie-session' : null,
    })
  },

  clearSession: () => {
    writeHadSession(false)
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
