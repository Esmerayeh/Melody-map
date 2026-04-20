import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { authAPI } from '../services/api'
import useStore from '../store/useStore'

/**
 * Landing page after Last.fm OAuth redirect.
 * URL: /lastfm-success?auth_code=EXCHANGE_CODE
 *      /lastfm-success?error=...
 */
export default function LastfmSuccess() {
  const navigate = useNavigate()
  const setLastfmConnected = useStore((s) => s.setLastfmConnected)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    let timeoutId
    const params = new URLSearchParams(window.location.search)
    const authCode = params.get('auth_code')
    const error = params.get('error')
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (error) {
      setStatus('error')
      setMessage(decodeURIComponent(error))
      timeoutId = window.setTimeout(() => navigate('/'), 3000)
      return () => window.clearTimeout(timeoutId)
    }

    if (!authCode) {
      setStatus('error')
      setMessage('No secure exchange code received from Last.fm.')
      timeoutId = window.setTimeout(() => navigate('/'), 3000)
      return () => window.clearTimeout(timeoutId)
    }

    authAPI.exchangeLastfm(authCode)
      .then(({ data }) => {
        if (cancelled) return
        const payload = data?.data && typeof data.data === 'object' ? data.data : data
        const username = payload?.username
        if (!payload?.connected || !username) {
          throw new Error('No session received from Last.fm.')
        }
        setLastfmConnected({ connected: true, username })
        setStatus('success')
        timeoutId = window.setTimeout(() => navigate('/'), 1500)
      })
      .catch((err) => {
        if (cancelled) return
        const nextMessage =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Last.fm token exchange failed.'
        setStatus('error')
        setMessage(nextMessage)
        timeoutId = window.setTimeout(() => navigate('/'), 3000)
      })

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [navigate, setLastfmConnected])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 mb-2 shadow-lg shadow-red-500/30">
          <Flame className="w-8 h-8 text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-red-400 animate-spin mx-auto" />
            <p className="text-gray-300">Connecting your Last.fm account...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Last.fm Connected!</h2>
            <p className="text-gray-400 text-sm">Redirecting to your music universe...</p>
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
