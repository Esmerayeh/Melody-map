import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()

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

  // A 401 on a data route no longer force-logs-out. Instead the API layer asks
  // us to re-validate: refetch the session bootstrap (the single source of
  // truth). If the session is genuinely gone, applyBootstrap will flip
  // auth_state to no_session and routing moves to /login; if it is still valid
  // (e.g. the failure was a transient/expired-token blip the refresh recovered),
  // nothing is wiped and the user keeps working mid-session.
  useEffect(() => {
    const onSessionSuspect = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionBootstrap })
    }

    window.addEventListener('melodymap:session-suspect', onSessionSuspect)
    return () => window.removeEventListener('melodymap:session-suspect', onSessionSuspect)
  }, [queryClient])

  // Hard clear only when the bootstrap itself confirms there is no session and
  // no connected provider — the authoritative logout signal.
  useEffect(() => {
    if (!query.data) return
    if (query.data.auth_state === 'no_session' && !query.data.music_provider && !sessionToken) {
      clearSession()
      setProviderState({
        spotifyConnected: false,
        lastfmConnected: false,
        lastfmUsername: null,
        musicProvider: null,
        spotifyProfile: null,
        sessionId: null,
      })
    }
  }, [clearSession, query.data, sessionToken, setProviderState])

  return null
}
