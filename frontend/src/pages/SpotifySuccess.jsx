import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music2, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { authAPI, spotifyAPI } from '../services/api'
import { logClientEvent } from '../services/observability'

function safeSessionFlag(key, value) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Ignore session storage failures in privacy-restricted contexts.
  }
}

function unwrapApiData(payload) {
  if (payload?.data && typeof payload.data === 'object') return payload.data
  return payload
}

/**
 * Landing page after Spotify OAuth redirect.
 * URL format: /spotify-success?auth_code=...&expires_in=3600
 *             /spotify-success?error=access_denied
 */
export default function SpotifySuccess() {
  const navigate = useNavigate()
  const setSpotifyConnected = useStore((s) => s.setSpotifyConnected)
  const setSpotifyProfile = useStore((s) => s.setSpotifyProfile)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const authCode = params.get('auth_code')
    const error = params.get('error')
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const redirectHome = (delay = 900) => window.setTimeout(() => {
      if (!cancelled) {
        navigate('/', { replace: true, state: { justLoggedIn: true } })
      }
    }, delay)

    if (error) {
      const detail = params.get('detail') || ''
      logClientEvent('spotify_auth_failed', { error, detail }, 'warn')
      setStatus('error')
      setMessage(
        error === 'access_denied'
          ? 'You denied access to Spotify.'
          : `Spotify error: ${error}${detail ? ` -- ${detail}` : ''}`,
      )
      const timeoutId = redirectHome(3000)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    if (!authCode) {
      logClientEvent('spotify_auth_missing_code', {}, 'warn')
      setStatus('error')
      setMessage('No secure exchange code received from Spotify.')
      const timeoutId = redirectHome(3000)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    let timeoutId
    authAPI.exchangeSpotify(authCode)
      .then(({ data }) => {
        if (cancelled) return
        const payload = unwrapApiData(data)
        if (!payload?.connected) {
          throw new Error('Spotify secure exchange failed.')
        }
        setSpotifyConnected({ connected: true })
        safeSessionFlag('post_login_bootstrap', 'spotify')
        return spotifyAPI.getProfile()
      })
      .then(({ data }) => {
        if (cancelled) return
        const profile = unwrapApiData(data)
        if (profile && typeof profile === 'object') {
          setSpotifyProfile(profile)
          setSpotifyConnected({ connected: true, profile })
        }
        setStatus('success')
        timeoutId = redirectHome(900)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err?.response?.data?.error?.message || err?.message || 'Spotify token exchange failed.'
        logClientEvent('spotify_auth_exchange_failed', { message }, 'warn')
        setStatus('error')
        setMessage(message)
        timeoutId = redirectHome(3000)
      })

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [navigate, setSpotifyConnected, setSpotifyProfile])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-2">
          <Music2 className="w-8 h-8 text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-gray-300">Connecting your Spotify account...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Spotify Connected!</h2>
            <p className="text-gray-400 text-sm">Your orbit is waking up now.</p>
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
