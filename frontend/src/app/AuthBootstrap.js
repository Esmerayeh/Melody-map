import { useEffect } from 'react'
import useStore from '../store/useStore'
import { authAPI } from '../services/api'

export function useAuthBootstrap() {
  const setSpotifyConnected = useStore((s) => s.setSpotifyConnected)
  const setLastfmConnected = useStore((s) => s.setLastfmConnected)
  const disconnectSpotify = useStore((s) => s.disconnectSpotify)
  const disconnectLastfm = useStore((s) => s.disconnectLastfm)
  const clearSession = useStore((s) => s.clearSession)
  const setSessionToken = useStore((s) => s.setSessionToken)

  useEffect(() => {
    const onSessionExpired = () => {
      clearSession()
      setSessionToken(null)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('melodymap:session-expired', onSessionExpired)
    }

    try {
      const sessionToken = window.localStorage.getItem('token')
      setSessionToken(sessionToken)
    } catch {
      setSessionToken(null)
    }

    authAPI.getProviderStatus()
      .then(({ data }) => {
        const payload = data?.data && typeof data.data === 'object' ? data.data : data
        if (payload?.spotify?.connected) {
          setSpotifyConnected({ connected: true })
        } else {
          disconnectSpotify()
        }

        if (payload?.lastfm?.connected) {
          setLastfmConnected({ connected: true, username: payload?.lastfm?.username || null })
        } else {
          disconnectLastfm()
        }
      })
      .catch(() => {
        disconnectSpotify()
        disconnectLastfm()
      })

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('melodymap:session-expired', onSessionExpired)
      }
    }
  }, [clearSession, disconnectLastfm, disconnectSpotify, setLastfmConnected, setSessionToken, setSpotifyConnected])
}
