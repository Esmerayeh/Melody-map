import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import useAuthStore from '../store/useAuthStore'
import { authAPI, sessionAPI } from '../services/api'

function unwrapApiData(payload) {
  if (payload?.data && typeof payload.data === 'object') return payload.data
  return payload
}

export default function LastfmSuccess() {
  const navigate = useNavigate()
  const setProviderState = useStore((s) => s.setProviderState)
  const applyBootstrap = useAuthStore((s) => s.applyBootstrap)
  const setBootState = useAuthStore((s) => s.setBootState)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const authCode = params.get('auth_code')
    const error = params.get('error')
    window.history.replaceState({}, document.title, '/lastfm-success')

    const redirectHome = (delay = 1400) => window.setTimeout(() => {
      if (!cancelled) navigate('/', { replace: true, state: { justLoggedIn: true } })
    }, delay)

    if (error) {
      setStatus('error')
      setMessage(decodeURIComponent(error))
      const timeoutId = redirectHome(3000)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    if (!authCode) {
      setStatus('error')
      setMessage('No auth code received from Last.fm.')
      const timeoutId = redirectHome(3000)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    setBootState('oauth_exchanging', 'Exchanging the Last.fm callback for a secure session.')

    let timeoutId
    authAPI.exchangeLastfm(authCode)
      .then(() => sessionAPI.bootstrap())
      .then(({ data }) => {
        if (cancelled) return
        const payload = unwrapApiData(data)
        applyBootstrap(payload)
        setProviderState({
          spotifyConnected: Boolean(payload?.providers?.spotify?.connected),
          lastfmConnected: Boolean(payload?.providers?.lastfm?.connected),
          lastfmUsername: payload?.providers?.lastfm?.username || null,
          musicProvider: payload?.music_provider || 'lastfm',
          sessionId: payload?.sessionId || null,
        })
        setStatus('success')
        timeoutId = redirectHome(1200)
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setMessage(err?.response?.data?.error?.message || err?.message || 'Last.fm session bootstrap failed.')
        timeoutId = redirectHome(3000)
      })

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [applyBootstrap, navigate, setBootState, setProviderState])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-[#de83b4] mb-2 shadow-lg shadow-red-500/30">
          <Flame className="w-8 h-8 text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-red-400 animate-spin mx-auto" />
            <p className="text-gray-300">Restoring your Last.fm session through the backend bootstrap flow...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-[#ac6294] mx-auto" />
            <h2 className="text-xl font-bold text-white">Last.fm Connected!</h2>
            <p className="text-gray-400 text-sm">The shell can recover deterministically now because the provider session lives on the backend, not in the URL.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Connection Failed</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <p className="text-gray-500 text-xs">Redirecting back...</p>
          </>
        )}
      </div>
    </div>
  )
}
