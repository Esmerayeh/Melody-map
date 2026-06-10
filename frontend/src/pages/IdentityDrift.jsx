import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { identityAPI } from '../services/api'

const RANGE_OPTIONS = [
  { value: 'monthly', label: 'Last 4 weeks' },
  { value: 'quarterly', label: 'Last 3 months' },
  { value: 'half_year', label: 'Last 6 months' },
  { value: 'all', label: 'All time' },
]

function DriftPanel({ label, value }) {
  return (
    <div className="noire-info-card rounded-[22px] p-4">
      <p className="section-label mb-2">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

export default function IdentityDrift() {
  const [selectedRange, setSelectedRange] = useState('all')
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    identityAPI.getDrift(selectedRange)
      .then((response) => {
        if (!active) return
        setPayload(response.data?.data || response.data)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err?.normalized?.message || err.message || 'Could not read identity drift.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [selectedRange])

  const timeline = payload?.timeline || []
  const drift = payload?.drift || {}
  const summary = useMemo(() => {
    if (!drift?.genreMovement?.length) return 'Your listening self is still settling into a visible timeline.'
    return `You became more ${drift.genreMovement[0]} over time while your energy shifted by ${drift.energyValenceMovement?.energyDelta ?? 0}.`
  }, [drift])

  return (
    <div className="cosmic-page space-y-6">
      <div>
        <p className="page-header-kicker mb-2">Identity Drift</p>
        <h1 className="page-header-title">A diary of your changing music self</h1>
        <p className="page-header-copy mt-3">Track how your archetypes, moods, genres, and favorite voices have shifted over time.</p>
      </div>

      <div className="mobile-scroll-row flex gap-2 overflow-x-auto pb-1">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSelectedRange(option.value)}
            className="touch-target shrink-0 rounded-full border px-4 py-2 text-sm transition-all"
            style={selectedRange === option.value
              ? { borderColor: 'rgba(224,163,92,0.4)', background: 'rgba(224,163,92,0.16)', color: '#e9ddff' }
              : { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(203,213,225,0.8)' }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="noire-panel rounded-[28px] p-6 text-sm text-slate-400">Reading your timeline...</div>
      ) : error ? (
        <div className="noire-panel rounded-[28px] p-6 text-sm text-rose-300">{error}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DriftPanel label="Archetype change" value={drift.archetypeChange || 'Soft signal'} />
            <DriftPanel label="MBTI axis shift" value={drift.mbtiAxisShift || 'Soft signal'} />
            <DriftPanel label="Genre movement" value={(drift.genreMovement || []).join(', ') || 'Soft signal'} />
            <DriftPanel label="Energy / valence" value={`${drift.energyValenceMovement?.energyDelta ?? 0} / ${drift.energyValenceMovement?.valenceDelta ?? 0}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="noire-panel rounded-[28px] p-6">
              <p className="section-label mb-3">Timeline</p>
              <div className="space-y-4">
                {timeline.map((snapshot, index) => (
                  <motion.div
                    key={`${snapshot.range}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{snapshot.range}</p>
                        <p className="mt-1 text-xs text-slate-500">{snapshot.archetype || snapshot.aesthetic_label || 'Listening self'}</p>
                      </div>
                      <p className="text-xs text-sky-300">{snapshot.mbti?.type || snapshot.mbti || 'Soft-signal'}</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      Top artists: {(snapshot.top_artists || snapshot.topArtists || []).slice(0, 3).join(', ') || 'No strong anchors yet'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Genres: {(snapshot.top_genres || snapshot.topGenres || []).slice(0, 4).join(', ') || 'Still forming'}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="noire-panel rounded-[28px] p-6">
                <p className="section-label mb-2">You became more...</p>
                <p className="text-lg font-semibold text-white">{summary}</p>
              </div>
              <div className="noire-info-card rounded-[24px] p-5">
                <p className="section-label mb-2">New vs recurring voices</p>
                <p className="text-sm text-slate-300">New artists: {(drift.newArtists || []).join(', ') || 'No sharp emergence yet'}</p>
                <p className="mt-2 text-sm text-slate-400">Recurring artists: {(drift.recurringArtists || []).join(', ') || 'Still settling'}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
