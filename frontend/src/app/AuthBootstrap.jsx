import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/useAuthStore'
import useProfileStore from '../store/useProfileStore'
import useStore from '../store/useStore'
import { sessionAPI } from '../services/api'
import { queryKeys } from '../lib/queryKeys'

function unwrap(payload) {
  if (payload?.data && typeof payload.data === 'object') return payload.data
  return payload
}

export default function AuthBootstrap() {
  const sessionToken = useAuthStore((s) => s.sessionToken)
  const applyBootstrap = useAuthStore((s) => s.applyBootstrap)
  const setBootState = useAuthStore((s) => s.setBootState)
  const clearSession = useAuthStore((s) => s.clearSession)
  const setProviderState = useStore((s) => s.setProviderState)
  const clearProfile = useProfileStore((s) => s.clearProfile)

  const query = useQuery({
    queryKey: [...queryKeys.sessionBootstrap, Boolean(sessionToken)],
    retry: 1,
    staleTime: 20_000,
    queryFn: async () => {
      const response = await sessionAPI.bootstrap()
      return unwrap(response.data)
    },
  })

  useEffect(() => {
    if (query.isLoading) {
      setBootState('probing_session', 'Checking session and provider state.')
      return
    }

    if (query.error) {
      setBootState('error', query.error.message || 'Session bootstrap failed.')
      return
    }

    if (query.data) {
      applyBootstrap(query.data)
      setProviderState({
        spotifyConnected: Boolean(query.data.providers?.spotify?.connected),
        lastfmConnected: Boolean(query.data.providers?.lastfm?.connected),
        lastfmUsername: query.data.providers?.lastfm?.username || null,
        musicProvider: query.data.music_provider || null,
        sessionId: query.data.sessionId || null,
      })

      if (query.data.auth_state === 'no_session' && !query.data.music_provider && !sessionToken) {
        clearProfile()
      }
    }
  }, [applyBootstrap, clearProfile, query.data, query.error, query.isLoading, sessionToken, setBootState, setProviderState])

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession()
      clearProfile()
      setProviderState({
        spotifyConnected: false,
        lastfmConnected: false,
        lastfmUsername: null,
        musicProvider: null,
        spotifyProfile: null,
        sessionId: null,
      })
    }

    window.addEventListener('melodymap:session-expired', onUnauthorized)
    return () => window.removeEventListener('melodymap:session-expired', onUnauthorized)
  }, [clearProfile, clearSession, setProviderState])

  return null
}
