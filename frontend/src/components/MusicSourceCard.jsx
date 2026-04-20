import React from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import { authAPI } from '../services/api'
import useBackendWake from '../hooks/useBackendWake'

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

const LastfmIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.584 17.21l-.88-2.392s-1.43 1.596-3.573 1.596c-1.897 0-3.244-1.65-3.244-4.296 0-3.382 1.704-4.596 3.38-4.596 2.42 0 3.19 1.57 3.85 3.574l.88 2.75c.88 2.64 2.53 4.76 7.3 4.76 3.41 0 5.72-1.045 5.72-3.795 0-2.22-1.265-3.37-3.63-3.92l-1.76-.39c-1.21-.275-1.567-.77-1.567-1.595 0-.935.74-1.485 1.95-1.485 1.32 0 2.035.495 2.145 1.65l2.75-.33c-.22-2.475-1.925-3.49-4.73-3.49-2.475 0-4.84.935-4.84 3.93 0 1.87.907 3.05 3.19 3.63l1.87.495c1.375.357 1.87.88 1.87 1.76 0 1.045-.99 1.485-2.86 1.485-2.75 0-3.905-1.43-4.565-3.38l-.907-2.75c-1.155-3.575-3.025-4.895-6.655-4.895C1.87 5.487 0 8.127 0 12.2c0 3.905 1.98 6.325 5.995 6.325 3.107 0 4.59-1.32 4.59-1.32z"/>
  </svg>
)

async function disconnectProvider(action, fallback, message) {
  try {
    await action()
  } finally {
    fallback()
    toast.success(message)
  }
}

export function ProviderBadge() {
  const { musicProvider, spotifyProfile, lastfmUsername, disconnectSpotify, disconnectLastfm } = useStore()

  if (musicProvider === 'spotify') {
    return (
      <div className="flex items-center gap-2">
        {spotifyProfile?.image && (
          <img src={spotifyProfile.image} alt={spotifyProfile.name}
            className="w-6 h-6 rounded-full object-cover border border-green-500/40" />
        )}
        <span className="hidden sm:flex items-center gap-1 text-xs text-green-400 font-medium">
          <SpotifyIcon />
          {spotifyProfile?.name || 'Spotify'}
        </span>
        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
        <button
          onClick={() => disconnectProvider(authAPI.disconnectSpotify, disconnectSpotify, 'Spotify disconnected')}
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          ×
        </button>
      </div>
    )
  }

  if (musicProvider === 'lastfm') {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:flex items-center gap-1 text-xs text-red-400 font-medium">
          <LastfmIcon />
          {lastfmUsername}
        </span>
        <CheckCircle className="w-3.5 h-3.5 text-red-400" />
        <button
          onClick={() => disconnectProvider(authAPI.disconnectLastfm, disconnectLastfm, 'Last.fm disconnected')}
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          ×
        </button>
      </div>
    )
  }

  return null
}

export default function MusicSourceCard({ compact = false }) {
  const { musicProvider, disconnectSpotify, disconnectLastfm } = useStore()
  const { waking, wake } = useBackendWake()

  const handleSpotify = () => {
    wake(`${import.meta.env.VITE_API_URL || ''}/auth/spotify/login`)
  }

  const handleLastfm = () => {
    wake(`${import.meta.env.VITE_API_URL || ''}/auth/lastfm/login`)
  }

  if (musicProvider) {
    return (
      <div className={`bg-white/3 border border-white/8 rounded-2xl ${compact ? 'p-4' : 'p-6'}`}>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Music Source</p>
        {musicProvider === 'spotify' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1DB954]/15 flex items-center justify-center text-[#1DB954]">
                <SpotifyIcon />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Spotify Connected</p>
                <p className="text-xs text-gray-500">Streaming your listening data</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <button
                onClick={() => disconnectProvider(authAPI.disconnectSpotify, disconnectSpotify, 'Spotify disconnected')}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
        {musicProvider === 'lastfm' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-red-400">
                <LastfmIcon />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Last.fm Connected</p>
                <p className="text-xs text-gray-500">Scrobbling your listening history</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <button
                onClick={() => disconnectProvider(authAPI.disconnectLastfm, disconnectLastfm, 'Last.fm disconnected')}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white/3 border border-white/8 rounded-2xl overflow-hidden ${compact ? 'p-4' : 'p-6'}`}>
      {!compact && (
        <div className="flex justify-center mb-5">
          <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <ellipse cx="80" cy="50" rx="70" ry="28" stroke="rgba(124,111,255,0.15)" strokeWidth="1" />
            <ellipse cx="80" cy="50" rx="50" ry="18" stroke="rgba(244,114,182,0.12)" strokeWidth="1" />
            {[[20, 20], [140, 18], [60, 12], [110, 80], [30, 72], [150, 60], [80, 8], [45, 88]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={1.5 + (i % 3) * 0.8} fill={i % 2 === 0 ? '#7c6fff' : '#f472b6'} opacity={0.5 + (i % 4) * 0.12} />
            ))}
            <circle cx="80" cy="50" r="12" fill="rgba(124,111,255,0.12)" />
            <circle cx="80" cy="50" r="6" fill="rgba(124,111,255,0.25)" />
            <circle cx="80" cy="50" r="2.5" fill="#7c6fff" />
            <circle cx="30" cy="50" r="3" fill="#f472b6" opacity="0.7" />
            <circle cx="130" cy="50" r="3" fill="#7c6fff" opacity="0.7" />
            <circle cx="80" cy="22" r="2.5" fill="#fbbf24" opacity="0.6" />
            <circle cx="80" cy="78" r="2.5" fill="#34d399" opacity="0.6" />
          </svg>
        </div>
      )}

      {!compact && (
        <div className="flex gap-2 mb-5 overflow-hidden">
          {['Midnight Highway Echoes', 'Velvet Afternoon Drift', 'Neon Euphoria Rush'].map((label) => (
            <div key={label} className="flex-1 min-w-0 rounded-xl p-2.5 border border-white/6 bg-white/2">
              <div className="skeleton h-2 w-full mb-2 rounded" />
              <div className="skeleton h-2 w-3/4 rounded" />
              <p className="text-[10px] text-gray-600 mt-2 truncate">{label}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Connect a Music Source</p>
      <p className="text-gray-400 text-sm mb-4">Link your account to populate your music universe with real data.</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleSpotify}
          disabled={waking}
          className="flex flex-col items-center gap-2 p-4 bg-[#1DB954]/8 hover:bg-[#1DB954]/15 border border-[#1DB954]/20 hover:border-[#1DB954]/50 rounded-xl text-[#1DB954] transition-all group disabled:opacity-70"
        >
          <div className="w-10 h-10 rounded-xl bg-[#1DB954]/15 group-hover:bg-[#1DB954]/25 flex items-center justify-center transition-all">
            {waking ? <Loader2 className="w-5 h-5 animate-spin" /> : <SpotifyIcon />}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">{waking ? 'Connecting...' : 'Spotify'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Top tracks + audio features</p>
          </div>
        </button>

        <button
          onClick={handleLastfm}
          disabled={waking}
          className="flex flex-col items-center gap-2 p-4 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/50 rounded-xl text-red-400 transition-all group disabled:opacity-70"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 group-hover:bg-red-500/25 flex items-center justify-center transition-all">
            {waking ? <Loader2 className="w-5 h-5 animate-spin" /> : <LastfmIcon />}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">{waking ? 'Connecting...' : 'Last.fm'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Scrobble history + artists</p>
          </div>
        </button>
      </div>
    </div>
  )
}
