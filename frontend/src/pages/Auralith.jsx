import { useMemo, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Compass, Loader2, Radio, Sparkles, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { auralithAPI, recommendationEventsAPI } from '../services/api'
import useMusicProfile from '../hooks/useMusicProfile'
import useStore from '../store/useStore'
import useLiveTasteSignal from '../hooks/useLiveTasteSignal'
import ProfileBootPanel from '../components/ProfileBootPanel'
import { buildRecommendationEvent } from '../lib/recommendationTracking'
import AtmosphereBackground from '../components/premium/AtmosphereBackground'
import AuraCard from '../components/premium/AuraCard'
import HaloButton from '../components/premium/HaloButton'
import ShimmerDivider from '../components/premium/ShimmerDivider'
import NebulaLoader from '../components/premium/NebulaLoader'

const MODULES = [
  { id: 'playlist', label: 'Playlist Generator', icon: Wand2, prompt: 'dreamy shoegaze winter night', mode: 'playlist' },
  { id: 'taste', label: 'Taste Analyzer', icon: Brain, prompt: 'Frank Ocean\nBeach House\nRadiohead', mode: 'analyze' },
  { id: 'explainer', label: 'Song Explainer', icon: Compass, prompt: 'Nights - Frank Ocean', mode: 'explain' },
  { id: 'concept', label: 'Concept Sequence', icon: Sparkles, prompt: 'music for disappearing into city lights', mode: 'concept' },
]

function normalizeProfile(profile) {
  if (!profile) return null
  return {
    topArtists: profile.topArtists || [],
    topTracks: profile.topTracks || [],
    genres: profile.genres || [],
    audioFeatures: profile.audioFeatures || {},
    analyticsMetrics: profile.analyticsMetrics || {},
    personality: profile.personality || [],
    mbti: profile.mbti || {},
    timeRange: profile.timeRange || 'medium_term',
  }
}

function OracleResult({ result }) {
  if (!result) return null
  return (
    <AuraCard className="p-5" accent="cyan">
      <p className="section-label mb-2 text-cyan-200">Retrieved memory</p>
      <p className="text-lg font-semibold text-white">{result.answer}</p>
      <p className="mt-3 text-sm text-slate-400">{result.explanation}</p>
      <div className="mt-5 rounded-[22px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-white">Listening memories</p>
          <p className="text-xs text-slate-500">confidence {Math.round((result.confidence?.score || 0) * 100)}%</p>
        </div>
        <div className="mt-4 space-y-3">
          {(result.retrieved_memories || []).map((memory, index) => (
            <details key={`${memory.chunk_id || memory.title}-${index}`} className="rounded-[18px] border border-white/6 bg-white/[0.03] p-3">
              <summary className="cursor-pointer text-sm font-medium text-white">
                {memory.title} <span className="ml-2 text-xs text-slate-500">[{memory.source_type}]</span>
              </summary>
              <p className="mt-3 text-sm text-slate-300">{memory.content}</p>
            </details>
          ))}
        </div>
      </div>
    </AuraCard>
  )
}

function SongSequence({ songs = [], tracking }) {
  useEffect(() => {
    if (!tracking?.sessionId || !tracking?.requestId) return undefined
    songs.forEach((song, index) => {
      recommendationEventsAPI.impression(buildRecommendationEvent({
        recommendationId: `${tracking.requestId}:${song.title}:${index}`,
        requestId: tracking.requestId,
        sessionId: tracking.sessionId,
        trackKey: `${song.title}::${song.artist}`,
        position: index,
        surface: 'auralith',
        modelVersion: tracking.modelVersion,
        candidateSource: tracking.candidateSource,
      })).catch(() => {})
    })
    return undefined
  }, [songs, tracking])

  if (!songs.length) return null
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {songs.map((song, index) => (
        <div key={`${song.title}-${song.artist}-${index}`} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">{song.title}</p>
          <p className="mt-1 text-xs text-slate-500">{song.artist}</p>
          <p className="mt-3 text-sm text-slate-300">{song.reason || song.explanation || 'Chosen for the emotional contour of this moment.'}</p>
        </div>
      ))}
    </div>
  )
}

export default function Auralith() {
  const { profile, phase } = useMusicProfile()
  const sessionId = useStore((state) => state.sessionId)
  const profilePayload = useMemo(() => normalizeProfile(profile), [profile])
  const { signal: liveSignal } = useLiveTasteSignal({ enabled: Boolean(profilePayload), pollMs: 12000 })
  const [activeModule, setActiveModule] = useState(MODULES[0])
  const [moduleInput, setModuleInput] = useState(MODULES[0].prompt)
  const [moduleResult, setModuleResult] = useState(null)
  const [oraclePrompt, setOraclePrompt] = useState('Why do I keep returning to melancholic songs?')
  const [oracleResult, setOracleResult] = useState(null)
  const [loadingModule, setLoadingModule] = useState(false)
  const [loadingOracle, setLoadingOracle] = useState(false)
  const [error, setError] = useState('')
  const [threadId] = useState(() => `auralith-${Date.now().toString(36)}`)

  if (phase === 'loading' && !profile) {
    return <ProfileBootPanel variant="loading" title="Auralith is tuning in." subtitle="The oracle is gathering your listening signal." detail="Hold steady." />
  }
  if (phase === 'empty') {
    return <ProfileBootPanel variant="empty" title="Connect a music source to wake Auralith." subtitle="The oracle needs a listening history to read." detail="No signal is present yet." />
  }
  if (phase === 'error' && !profile) {
    return <ProfileBootPanel variant="error" title="Auralith could not reach your signal." subtitle="The music memory layer is unavailable right now." detail="Refresh once and the oracle should return." onAction={() => window.location.reload()} actionLabel="Reload Auralith" />
  }

  const tracking = {
    requestId: moduleResult?.requestId || moduleResult?.thread_id || null,
    sessionId,
    modelVersion: moduleResult?.modelVersion || moduleResult?.used_model || 'auralith-rag-v2',
    candidateSource: 'auralith',
  }

  const runModule = async () => {
    setLoadingModule(true)
    setError('')
    try {
      const response = await auralithAPI.agentTurn({
        prompt: moduleInput,
        profile: profilePayload,
        mode: activeModule.mode,
        thread_id: threadId,
        limit: 8,
      })
      setModuleResult(response.data)
    } catch (submissionError) {
      setError(submissionError?.normalized?.message || submissionError.message || 'Auralith slipped through the static.')
    } finally {
      setLoadingModule(false)
    }
  }

  const runOracle = async () => {
    setLoadingOracle(true)
    setError('')
    try {
      const response = await auralithAPI.rag({
        prompt: oraclePrompt,
        profile: profilePayload,
        limit: 6,
      })
      setOracleResult(response.data)
    } catch (submissionError) {
      setError(submissionError?.normalized?.message || submissionError.message || 'The oracle could not read your stored memories.')
    } finally {
      setLoadingOracle(false)
    }
  }

  return (
    <div className="cosmic-page space-y-6">
      <section className="noire-panel relative overflow-hidden rounded-[36px] p-6 lg:p-8">
        <AtmosphereBackground variant="oracle" intensity="rich" anchored />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="premium-kicker mb-3 text-amber-300">Music Memory Oracle</p>
            <h1 className="premium-hero-title max-w-4xl">
              Auralith reads the meaning inside your listening history.
            </h1>
            <p className="premium-body mt-4 max-w-2xl">
              Calm, intelligent, and slightly mystical. Ask why certain feelings recur, how your taste has shifted, and what your history suggests for this exact moment.
            </p>
            <ShimmerDivider className="my-5 max-w-xl" />
            <p className="text-sm leading-relaxed text-slate-300 max-w-2xl">
              The response is grounded in stored listening memories, genre gravity, active sessions, and identity snapshots, so the oracle feels reflective rather than generic.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[420px]">
            <AuraCard className="p-4" accent="cyan">
              <p className="section-label mb-2">Live signal</p>
              <p className="text-sm font-semibold text-white">
                {liveSignal?.activeTracks?.[0] || 'Quiet session'}
              </p>
            </AuraCard>
            <AuraCard className="p-4" accent="lavender">
              <p className="section-label mb-2">Indexed memory</p>
              <p className="text-sm font-semibold text-white">{liveSignal?.eventCount || 0} recent listening events</p>
            </AuraCard>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <AuraCard className="p-6" accent="cyan">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
              <Brain className="h-5 w-5 text-cyan-100" />
            </div>
            <div>
              <p className="section-label">Ask the oracle</p>
              <p className="text-sm text-slate-400">Examples: Why do I keep returning to melancholic songs? How has my taste changed recently?</p>
            </div>
          </div>
          <textarea
            value={oraclePrompt}
            onChange={(event) => setOraclePrompt(event.target.value)}
            rows={5}
            className="mt-5 w-full rounded-[24px] border border-white/8 bg-white/[0.03] p-4 text-white outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              'Why do I keep returning to melancholic songs?',
              'How has my taste changed recently?',
              'What artists define my emotional pattern?',
              'What should I listen to tonight based on my history?',
            ].map((example) => (
              <button key={example} type="button" onClick={() => setOraclePrompt(example)} className="touch-target rounded-full border border-white/8 px-3 py-1.5 text-left text-xs text-slate-300">
                {example}
              </button>
            ))}
          </div>
          <HaloButton type="button" onClick={runOracle} variant="cyan" icon={loadingOracle ? Loader2 : Sparkles} className="mt-5 w-full justify-center px-5 py-3 text-sm normal-case tracking-[0.08em] sm:w-auto">
            Ask Auralith
          </HaloButton>
        </AuraCard>

        <AnimatePresence mode="wait">
          <motion.div key={Boolean(oracleResult)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {loadingOracle ? (
              <NebulaLoader label="Searching your listening memories" detail="The oracle is surfacing fragments, emotional patterns, and the strongest nearby echoes." />
            ) : error && !moduleResult ? (
              <AuraCard className="p-6 text-sm text-rose-300" accent="rose">{error}</AuraCard>
            ) : (
              <OracleResult result={oracleResult} />
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Link to="/discover" className="aura-card aura-interactive rounded-[24px] border border-white/8 p-4">
          <p className="section-label mb-2">Signal stream</p>
          <p className="text-sm font-semibold text-white">Drift into Discover first</p>
          <p className="mt-1 text-xs text-slate-500">Let a few new songs land before you ask Auralith what changed.</p>
        </Link>
        <Link to="/identity-drift" className="aura-card aura-interactive rounded-[24px] border border-white/8 p-4">
          <p className="section-label mb-2">Identity drift</p>
          <p className="text-sm font-semibold text-white">See the long arc of your taste</p>
          <p className="mt-1 text-xs text-slate-500">Move from one oracle answer into your broader timeline.</p>
        </Link>
        <Link to="/galaxy?mode=artist" className="aura-card aura-interactive rounded-[24px] border border-white/8 p-4">
          <p className="section-label mb-2">Galaxy mode</p>
          <p className="text-sm font-semibold text-white">Carry a star back into language</p>
          <p className="mt-1 text-xs text-slate-500">Touch the field, then return here and ask what it means.</p>
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <AuraCard className="p-4" accent="lavender">
          <p className="section-label mb-4">Ways of listening</p>
          <div className="space-y-2">
            {MODULES.map((module) => {
              const Icon = module.icon
              const isActive = module.id === activeModule.id
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(module)
                    setModuleInput(module.prompt)
                    setModuleResult(null)
                  }}
                  className={`w-full rounded-[24px] p-4 text-left transition-all ${isActive ? 'nav-item active' : 'nav-item'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white/[0.05] p-2">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{module.label}</p>
                      <p className="mt-1 text-xs text-slate-500">Prompt-aware and grounded in your listening signal.</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </AuraCard>

        <div className="space-y-6">
          <AuraCard className="p-6" accent="lavender">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <Radio className="h-5 w-5 text-amber-200" />
              </div>
              <div>
                <p className="section-label">Current module</p>
                <p className="text-sm text-slate-400">{activeModule.label}</p>
              </div>
            </div>
            <textarea
              value={moduleInput}
              onChange={(event) => setModuleInput(event.target.value)}
              rows={6}
              className="mt-5 w-full rounded-[24px] border border-white/8 bg-white/[0.03] p-4 text-white outline-none"
            />
            <HaloButton type="button" onClick={runModule} variant="primary" icon={loadingModule ? Loader2 : Wand2} className="mt-5 w-full justify-center px-5 py-3 text-sm normal-case tracking-[0.08em] sm:w-auto">
              Send into Auralith
            </HaloButton>
          </AuraCard>

          {moduleResult ? (
            <AuraCard className="p-6" accent="rose">
              <p className="section-label mb-2 text-amber-300">{moduleResult.mood || moduleResult.core_feeling || 'Auralith output'}</p>
              <h2 className="text-3xl font-black text-white">{moduleResult.playlist_title || moduleResult.taste_profile || moduleResult.core_feeling || moduleResult.interpretation || 'Auralith answer'}</h2>
              <p className="mt-3 text-sm text-slate-400">{moduleResult.vibe_summary || moduleResult.emotional_signature || moduleResult.why_it_works || moduleResult.overall_assessment || moduleResult.narrative}</p>
              {moduleResult.agent_trace?.steps?.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {moduleResult.agent_trace.steps.map((step) => (
                    <span key={step.id} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                      {step.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-6">
                <SongSequence songs={moduleResult.songs || []} tracking={tracking} />
              </div>
            </AuraCard>
          ) : null}
        </div>
      </section>
    </div>
  )
}
