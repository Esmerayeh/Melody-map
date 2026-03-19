import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'

/**
 * Landing page after Last.fm OAuth redirect.
 * URL: /lastfm-success?session=SESSION_KEY&username=USERNAME
 *      /lastfm-success?error=...
 */
export default function LastfmSuccess() {
  const navigate    = useNavigate()
  const setLastfm   = useStore((s) => s.setLastfm)
  const [status, setStatus]   = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const session  = params.get('session')
    const username = params.get('username')
    const error    = params.get('error')

    if (error) {
      setStatus('error')
      setMessage(decodeURIComponent(error))
      setTimeout(() => navigate('/'), 3000)
      return
    }

    if (!session || !username) {
      setStatus('error')
      setMessage('No session received from Last.fm.')
      setTimeout(() => navigate('/'), 3000)
      return
    }

    setLastfm(session, username)
    setStatus('success')
    setTimeout(() => navigate('/'), 1500)
  }, [navigate, setLastfm])

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
