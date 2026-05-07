import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music2, CheckCircle, XCircle, Loader2, RadioTower } from 'lucide-react'
import useStore from '../store/useStore'
import useAuthStore from '../store/useAuthStore'
import { authAPI, sessionAPI, spotifyAPI } from '../services/api'

function unwrapApiData(payload) {
  if (payload?.data && typeof payload.data === 'object') return payload.data
  return payload
}

export default function SpotifySuccess() {
  const navigate = useNavigate()
  const setProviderState = useStore((s) => s.setProviderState)
  const setSpotifyProfile = useStore((s) => s.setSpotifyProfile)
  const applyBootstrap = useAuthStore((s) => s.applyBootstrap)
  const setBootState = useAuthStore((s) => s.setBootState)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const authCode = params.get('auth_code')
    const error = params.get('error')
    window.history.replaceState({}, document.title, '/spotify-success')

    const redirectHome = (delay = 1200) => window.setTimeout(() => {
      if (!cancelled) navigate('/', { replace: true, state: { justLoggedIn: true } })
    }, delay)

    if (error) {
      setStatus('error')
      setMessage(error === 'access_denied' ? 'You denied access to Spotify.' : `Spotify error: ${error}`)
      const timeoutId = redirectHome(2800)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    if (!authCode) {
      setStatus('error')
      setMessage('No auth code received from Spotify.')
      const timeoutId = redirectHome(2800)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    setBootState('oauth_exchanging', 'Exchanging the Spotify callback for a secure session.')

    let timeoutId
    authAPI.exchangeSpotify(authCode)
      .then(() => sessionAPI.bootstrap())
      .then(({ data }) => {
        if (cancelled) return
        const payload = unwrapApiData(data)
        applyBootstrap(payload)
        setProviderState({
          spotifyConnected: Boolean(payload?.providers?.spotify?.connected),
          lastfmConnected: Boolean(payload?.providers?.lastfm?.connected),
          lastfmUsername: payload?.providers?.lastfm?.username || null,
          musicProvider: payload?.music_provider || 'spotify',
          sessionId: payload?.sessionId || null,
        })
        setBootState('profile_hydrating', 'Spotify session restored. Hydrating the first profile layer.')
        return spotifyAPI.getProfile()
      })
      .then(({ data }) => {
        if (cancelled || !data) return
        const profile = unwrapApiData(data)
        if (profile && typeof profile === 'object') {
          setSpotifyProfile(profile)
        }
        setStatus('success')
        timeoutId = redirectHome(1000)
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setMessage(err?.response?.data?.error?.message || err?.message || 'Spotify session bootstrap failed.')
        timeoutId = redirectHome(3000)
      })

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [applyBootstrap, navigate, setBootState, setProviderState, setSpotifyProfile])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,16,37,0.82),rgba(10,9,24,0.9))] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.46)]">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B7CFF] via-[#B994FF] to-[#EAE6FF] mb-4">
          <Music2 className="w-8 h-8 text-[#0B0B17]" />
        </div>
        <p className="page-header-kicker mb-2">Spotify callback</p>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <h2 className="mt-4 text-xl font-bold text-white">Restoring your listening session</h2>
            <p className="mt-2 text-gray-400 text-sm">We are exchanging the callback, restoring the cookie-backed session, and hydrating the first profile layer before navigating.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-[#B994FF] mx-auto" />
            <h2 className="mt-4 text-xl font-bold text-white">Spotify connected</h2>
            <p className="mt-2 text-gray-400 text-sm">Your orbit is restored through the backend bootstrap path, not a browser token handoff.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className="mt-4 text-xl font-bold text-white">Connection failed</h2>
            <p className="mt-2 text-gray-400 text-sm">{message}</p>
            <p className="mt-3 text-gray-500 text-xs">Redirecting back to a recoverable auth state...</p>
          </>
        )}

        <div className="mt-6 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-left">
          <div className="flex items-start gap-3">
            <RadioTower className="w-4 h-4 text-brand-purple mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">What happens next</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Melody Map now restores provider state through a server-owned bootstrap flow so the app can open with a deterministic shell instead of racing a browser token into local storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
