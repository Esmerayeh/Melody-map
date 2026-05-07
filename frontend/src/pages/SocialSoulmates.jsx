import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { HeartHandshake, Lock, Orbit, Sparkles } from 'lucide-react'
import { socialAPI } from '../services/api'

function MatchCard({ match, onCompare, onRequest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="noire-panel rounded-[28px] p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{match.displayName}</p>
          <p className="mt-1 text-xs text-slate-500">{match.summary}</p>
        </div>
        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs text-fuchsia-200">
          {Math.round(match.compatibilityScore || 0)}%
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-300">Shared artists: {(match.sharedArtists || []).join(', ') || 'No public overlap yet'}</p>
      <p className="mt-2 text-sm text-slate-400">Mood alignment: {Math.round(match.moodAlignment || 0)}%</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={() => onCompare(match.userId)} className="touch-target rounded-full border border-white/10 px-4 py-2 text-sm text-white">
          Compare
        </button>
        <button type="button" onClick={() => onRequest(match.userId)} className="touch-target rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-4 py-2 text-sm text-fuchsia-100">
          Send request
        </button>
      </div>
    </motion.div>
  )
}

export default function SocialSoulmates() {
  const [optIn, setOptIn] = useState(false)
  const [publicProfile, setPublicProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [requests, setRequests] = useState([])
  const [comparison, setComparison] = useState(null)
  const [status, setStatus] = useState('Loading your social orbit...')

  const refresh = async () => {
    try {
      let nextProfile = null
      try {
        const profileResponse = await socialAPI.getPublicProfile('me')
        nextProfile = profileResponse.data?.data || profileResponse.data
      } catch {
        const bootstrapResponse = await socialAPI.updatePublicProfile({})
        nextProfile = bootstrapResponse.data?.data?.profile || bootstrapResponse.data?.profile
      }
      setPublicProfile(nextProfile)
      setOptIn(Boolean(nextProfile?.allow_matching))
      const matchesResponse = await socialAPI.searchSoulmates({ limit: 8 })
      setMatches(matchesResponse.data?.data?.matches || [])
      const requestsResponse = await socialAPI.listRequests()
      setRequests(requestsResponse.data?.data?.requests || [])
      setStatus('Your social orbit is in view.')
    } catch (error) {
      setStatus(error?.normalized?.message || error.message || 'Could not read social soulmate data.')
    }
  }

  useEffect(() => {
    refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const requestCountLabel = useMemo(() => optIn ? 'Visible to opted-in listeners' : 'Private until you opt in', [optIn])

  const handleCompare = async (targetUserId) => {
    try {
      const response = await socialAPI.compareSoulmate({ target_user_id: targetUserId })
      setComparison(response.data?.data?.comparison || null)
    } catch (error) {
      setStatus(error?.normalized?.message || error.message || 'Could not compare profiles.')
    }
  }

  const handleRequest = async (targetUserId) => {
    try {
      await socialAPI.requestSoulmate({ target_user_id: targetUserId })
      const requestsResponse = await socialAPI.listRequests()
      setRequests(requestsResponse.data?.data?.requests || [])
      setStatus('Soulmate request sent.')
    } catch (error) {
      setStatus(error?.normalized?.message || error.message || 'Could not send request.')
    }
  }

  const handleAccept = async (requestId) => {
    try {
      await socialAPI.acceptSoulmate({ request_id: requestId })
      const requestsResponse = await socialAPI.listRequests()
      setRequests(requestsResponse.data?.data?.requests || [])
      setStatus('Soulmate request accepted.')
    } catch (error) {
      setStatus(error?.normalized?.message || error.message || 'Could not accept request.')
    }
  }

  return (
    <div className="cosmic-page space-y-6">
      <div>
        <p className="page-header-kicker mb-2">Social Soulmates</p>
        <h1 className="page-header-title">A celestial matching layer for registered listeners</h1>
        <p className="page-header-copy mt-3">Opt in when you want to be discovered. Your raw listening history stays private while your public taste constellation does the talking.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="noire-panel rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <HeartHandshake className="h-5 w-5 text-fuchsia-300" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Public taste profile</p>
              <p className="text-sm text-slate-400">{requestCountLabel}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={async () => {
                const nextOptIn = !optIn
                setOptIn(nextOptIn)
                const response = await socialAPI.updatePublicProfile({ allow_matching: nextOptIn, visibility: nextOptIn ? 'public' : 'private' })
                setPublicProfile(response.data?.data?.profile || response.data?.profile)
              }}
              className="touch-target rounded-full border border-white/10 px-4 py-2 text-sm text-white"
            >
              {optIn ? 'Opt out' : 'Opt in'}
            </button>
            <button
              type="button"
              onClick={refresh}
              className="touch-target rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100"
            >
              Refresh matches
            </button>
          </div>
          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
            <p className="section-label mb-2">Status</p>
            <p className="text-sm text-slate-300">{status}</p>
            {publicProfile?.summary ? <p className="mt-3 text-xs text-slate-500">{publicProfile.summary}</p> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="noire-info-card rounded-[24px] p-5">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-sky-300" />
              <p className="section-label">Privacy model</p>
            </div>
            <p className="mt-3 text-sm text-slate-300">Only opted-in users appear in search. Spotify tokens and raw event history never leave the backend.</p>
          </div>
          <div className="noire-info-card rounded-[24px] p-5">
            <div className="flex items-center gap-2">
              <Orbit className="h-4 w-4 text-fuchsia-300" />
              <p className="section-label">Constellation</p>
            </div>
            <p className="mt-3 text-sm text-slate-300">Shared artists, genres, and mood alignment become a public-facing compatibility sky instead of raw history.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.userId} match={match} onCompare={handleCompare} onRequest={handleRequest} />
        ))}
      </div>

      {requests.length ? (
        <div className="noire-panel rounded-[28px] p-6">
          <p className="section-label mb-4">Requests in orbit</p>
          <div className="space-y-3">
            {requests.map((item) => (
              <div key={item.request_id} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{item.source_user_id} {'->'} {item.target_user_id}</p>
                <p className="mt-1 text-xs text-slate-500">status: {item.status}</p>
                {item.status === 'pending' ? (
                  <button type="button" onClick={() => handleAccept(item.request_id)} className="touch-target mt-3 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-100">
                    Accept request
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {comparison ? (
        <div className="noire-panel rounded-[28px] p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <p className="section-label">Shared constellation</p>
          </div>
          <p className="mt-3 text-lg font-semibold text-white">{Math.round(comparison.compatibilityScore || 0)}% compatibility</p>
          <p className="mt-3 text-sm text-slate-300">Shared artists: {(comparison.sharedArtists || []).join(', ') || 'No sharp overlap yet'}</p>
          <p className="mt-2 text-sm text-slate-400">Shared genres: {(comparison.sharedGenres || []).join(', ') || 'Still subtle'}</p>
          <p className="mt-2 text-sm text-slate-400">Complementary traits: {(comparison.complementaryTasteTraits || []).join(', ') || 'Soft resonance'}</p>
        </div>
      ) : null}
    </div>
  )
}
