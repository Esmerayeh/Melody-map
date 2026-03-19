import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music2, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { spotifyAPI } from '../services/api'

/**
 * Landing page after Spotify OAuth redirect.
 * URL format: /spotify-success?token=...&refresh_token=...&expires_in=3600
 *             /spotify-success?error=access_denied
 */
export default function SpotifySuccess() {
  const navigate = useNavigate()
  const setSpotifyToken   = useStore((s) => s.setSpotifyToken)
  const setSpotifyProfile = useStore((s) => s.setSpotifyProfile)
  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token        = params.get('token')
    const refreshToken = params.get('refresh_token')
    const error        = params.get('error')

    if (error) {
      const detail = params.get('detail') || ''
      setStatus('error')
      setMessage(error === 'access_denied'
        ? 'You denied access to Spotify.'
        : `Spotify error: ${error}${detail ? ` — ${detail}` : ''}`)
      setTimeout(() => navigate('/'), 3000)
      return
    }

    if (!token) {
      setStatus('error')
      setMessage('No token received from Spotify.')
      setTimeout(() => navigate('/'), 3000)
      return
    }

    // Persist token and update store
    setSpotifyToken(token, refreshToken)

    // Store expiry time
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10)
    localStorage.setItem('spotify_token_expiry', Date.now() + expiresIn * 1000)

    // Fetch and store Spotify profile so TopBar avatar works immediately
    spotifyAPI.getProfile().then(({ data }) => {
      setSpotifyProfile(data)
    }).catch(() => {})

    setStatus('success')
    setTimeout(() => navigate('/'), 1500)
  }, [navigate, setSpotifyToken])

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
