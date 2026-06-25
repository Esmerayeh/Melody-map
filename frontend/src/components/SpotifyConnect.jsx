import React, { useEffect } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import { spotifyAPI } from '../services/api'
import useBackendWake from '../hooks/useBackendWake'

// Spotify green brand color
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

export default function SpotifyConnect({ variant = 'button' }) {
  const { spotifyConnected, spotifyProfile, setSpotifyProfile, disconnectSpotify } = useStore()
  const { waking, wake } = useBackendWake()

  // Load profile once connected
  useEffect(() => {
    if (spotifyConnected && !spotifyProfile) {
      spotifyAPI.getProfile()
        .then(({ data }) => setSpotifyProfile(data))
        .catch(() => {})
    }
  }, [spotifyConnected, spotifyProfile, setSpotifyProfile])

  const handleConnect = () => {
    wake(`${import.meta.env.VITE_API_URL || ''}/auth/spotify/login`)
  }

  const handleDisconnect = () => {
    disconnectSpotify()
    toast.success('Spotify disconnected')
  }

  if (spotifyConnected && spotifyProfile) {
    return (
      <div className="flex items-center gap-2">
        {spotifyProfile.image && (
          <img src={spotifyProfile.image} alt={spotifyProfile.name}
            className="w-7 h-7 rounded-full object-cover border border-[#ac6294]/40" />
        )}
        <div className="hidden sm:block">
          <p className="text-xs font-medium text-[#ac6294] leading-none">{spotifyProfile.name}</p>
          <p className="text-xs text-gray-500 leading-none mt-0.5">Spotify Connected</p>
        </div>
        <CheckCircle className="w-4 h-4 text-[#ac6294]" />
        <button onClick={handleDisconnect}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1">
          ×
        </button>
      </div>
    )
  }

  if (spotifyConnected) {
    return (
      <div className="flex items-center gap-1.5 text-[#ac6294] text-sm">
        <CheckCircle className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Connected</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={waking}
      className="flex items-center gap-2 px-3 py-1.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 hover:border-[#1DB954]/60 rounded-lg text-[#1DB954] text-sm font-medium transition-all disabled:opacity-70"
    >
      {waking ? <Loader2 className="w-4 h-4 animate-spin" /> : <SpotifyIcon />}
      <span className="hidden sm:inline">{waking ? 'Connecting...' : 'Connect Spotify'}</span>
    </button>
  )
}
