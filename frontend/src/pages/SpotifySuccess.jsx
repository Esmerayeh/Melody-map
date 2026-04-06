import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music2, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { spotifyAPI } from '../services/api'

function safeStoreValue(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures so auth success can still continue.
  }
}

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
 * URL format: /spotify-success?token=...&refresh_token=...&expires_in=3600
 *             /spotify-success?error=access_denied
 */
export default function SpotifySuccess() {
  const navigate = useNavigate()
  const setSpotifyToken = useStore((s) => s.setSpotifyToken)
  const setSpotifyProfile = useStore((s) => s.setSpotifyProfile)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const refreshToken = params.get('refresh_token')
    const error = params.get('error')

    const redirectHome = (delay = 900) => window.setTimeout(() => {
      if (!cancelled) {
        navigate('/', { replace: true, state: { justLoggedIn: true } })
      }
    }, delay)

    if (error) {
      const detail = params.get('detail') || ''
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

    if (!token) {
      setStatus('error')
      setMessage('No token received from Spotify.')
      const timeoutId = redirectHome(3000)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    setSpotifyToken(token, refreshToken)
    safeSessionFlag('post_login_bootstrap', 'spotify')

    const expiresIn = parseInt(params.get('expires_in') || '3600', 10)
    safeStoreValue('spotify_token_expiry', String(Date.now() + expiresIn * 1000))

    spotifyAPI.getProfile()
      .then(({ data }) => {
        if (cancelled) return
        const profile = unwrapApiData(data)
        if (profile && typeof profile === 'object') {
          setSpotifyProfile(profile)
        }
      })
      .catch(() => {})

    setStatus('success')
    const timeoutId = redirectHome(900)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [navigate, setSpotifyProfile, setSpotifyToken])

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
