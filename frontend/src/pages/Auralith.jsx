import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Wand2, AudioLines, Brain, FileSearch, Compass, HeartHandshake,
  ArrowRight, Loader2, RotateCcw, Disc3, Waves, Radio,
} from 'lucide-react'
import useMusicProfile from '../hooks/useMusicProfile'
import { usePlaylists } from '../hooks/useMusicData'
import useStore from '../store/useStore'
import { auralithAPI } from '../services/api'

const MODULES = [
  {
    id: 'playlist',
    label: 'Playlist Generator',
    eyebrow: 'Flagship Sequence',
    endpoint: 'generatePlaylist',
    icon: Wand2,
    description: 'Shape a mood into a sequence that feels emotionally true to your listening history.',
    placeholder: 'A winter train ride after saying too little',
    helper: 'Describe a scene, mood, memory, or emotional weather.',
    examples: ['dreamy shoegaze winter night', 'soft-focus songs with midnight glow', 'music for walking home after missing someone'],
    buildPayload: (value, profile) => ({ prompt: value, limit: 8, profile }),
  },
  {
    id: 'taste',
    label: 'Music Taste Analyzer',
    eyebrow: 'Listening Portrait',
    endpoint: 'analyzeTaste',
    icon: Brain,
    description: 'Read the patterns behind your choices, not just the labels attached to them.',
    placeholder: 'Frank Ocean\nBeach House\nRadiohead',
    helper: 'Drop in songs or artists, one per line.',
    examples: ['Frank Ocean\nBeach House\nRadiohead', 'Mitski\nFKA twigs\nJames Blake', 'Phoebe Bridgers\nSlowdive\nBon Iver'],
    buildPayload: (value, profile) => ({ seeds: value.split('\n').map((item) => item.trim()).filter(Boolean), profile }),
  },
  {
    id: 'explainer',
    label: 'Song Explainer',
    eyebrow: 'Deep Listen',
    endpoint: 'explainSong',
    icon: FileSearch,
    description: 'Unpack why a song lands emotionally, from texture and pacing to the pressure it creates.',
    placeholder: 'Nights - Frank Ocean',
    helper: 'Use a title, or a title with artist.',
    examples: ['Nights - Frank Ocean', 'Teardrop - Massive Attack', 'Reckoner - Radiohead'],
    buildPayload: (value, profile) => ({ prompt: value, profile }),
  },
  {
    id: 'critic',
    label: 'Playlist Critic',
    eyebrow: 'Flow Review',
    endpoint: 'critiquePlaylist',
    icon: AudioLines,
    description: 'Test whether a playlist actually moves with intention or only looks cohesive on paper.',
    placeholder: 'Space Song - Beach House\nK. - Cigarettes After Sex\nTeardrop - Massive Attack',
    helper: 'Paste playlist tracks, one per line.',
    examples: ['Space Song - Beach House\nK. - Cigarettes After Sex\nTeardrop - Massive Attack', 'Nights - Frank Ocean\nRetrograde - James Blake\nCellophane - FKA twigs'],
    buildPayload: (value, profile) => ({ songs: value.split('\n').map((item) => item.trim()).filter(Boolean), profile }),
  },
  {
    id: 'concept',
    label: 'Concept-to-Playlist',
    eyebrow: 'Atmosphere Translation',
    endpoint: 'conceptPlaylist',
    icon: Compass,
    description: 'Translate an image, memory, or fragment into a world of sound with emotional contour.',
    placeholder: 'what 3am feels like after heartbreak',
    helper: 'Speak in scenes, abstractions, or fragments.',
    examples: ['what 3am feels like after heartbreak', 'the first warm night after a long winter', 'music for disappearing into city lights'],
    buildPayload: (value, profile) => ({ prompt: value, limit: 8, profile }),
  },
]

function pickNames(items = [], keys = ['name', 'title']) {
  return items.map((item) => {
    if (typeof item === 'string') return item
    for (const key of keys) {
      if (item?.[key]) return item[key]
    }
    return null
  }).filter(Boolean)
}

function normalizeProfile(profile, playlists) {
  if (!profile) return null

  const moodPreference = profile.analyticsMetrics?.mood
  const topTracks = (profile.topTracks || []).slice(0, 8)
  const recentlyPlayed = (profile.recentlyPlayed || []).slice(0, 8)
  const savedTracks = (profile.savedTracks || []).slice(0, 8)

  return {
    genres: (profile.genres || []).map((item) => item.genre || item).filter(Boolean).slice(0, 8),
    topArtists: pickNames(profile.topArtists || []),
    topTracks: pickNames(topTracks, ['title', 'name']),
    recentlyPlayed: pickNames(recentlyPlayed, ['title', 'name']),
    likedSongs: pickNames(savedTracks.length ? savedTracks : topTracks.slice(0, 5), ['title', 'name']),
    savedPlaylists: pickNames((playlists || []).slice(0, 6)),
    favoriteArtists: pickNames((profile.topArtists || []).slice(0, 5)),
    moodPreferences: [moodPreference, ...(profile.aestheticTags || []).slice(0, 3)].filter(Boolean),
    aestheticTags: (profile.aestheticTags || []).slice(0, 8),
    audioFeatures: profile.audioFeatures || {},
    analyticsMetrics: profile.analyticsMetrics || {},
    personality: profile.personality || '',
    mbti: profile.mbti || '',
    userProfile: profile.userProfile || null,
    timeRange: profile.timeRange || 'medium_term',
  }
}

function HeroMeter({ label, value, color }) {
  return (
    <div className="rounded-[24px] p-4 glass-card">
      <p className="section-label mb-2">{label}</p>
      <p className="text-sm font-semibold text-white" style={{ color }}>{value}</p>
    </div>
  )
}

function ContextBanner({ profilePayload, playlistCount }) {
  const connected = Boolean(profilePayload)
  const hasDeepContext = Boolean(
    profilePayload?.topArtists?.length ||
    profilePayload?.topTracks?.length ||
    profilePayload?.recentlyPlayed?.length ||
    profilePayload?.savedPlaylists?.length
  )

  return (
    <div className="rounded-[24px] p-4 border border-white/8 bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <HeartHandshake className="w-4 h-4 text-brand-pink mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            {connected ? 'Listening context is active' : 'Prompt-first mode'}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mt-2">
            {hasDeepContext
              ? `Auralith is reading your top artists, tracks, recent listening, genre profile, and ${playlistCount} saved playlists to personalize every module.`
              : 'Auralith can still work beautifully from prompts alone, and it will fold in Melody Map data wherever your profile is available.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function Composer({ module, value, onChange, onExample, onSubmit, loading }) {
  return (
    <section className="glass-card rounded-[32px] p-6 lg:p-7 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top right, rgba(124,111,255,0.14), transparent 40%), radial-gradient(ellipse at bottom left, rgba(255,93,162,0.08), transparent 42%)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="section-label mb-2" style={{ color: '#FBBF24' }}>{module.eyebrow}</p>
            <h2 className="text-3xl lg:text-[2rem] font-black text-white">{module.label}</h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">{module.description}</p>
          </div>
          <span className="pill">{loading ? 'Listening' : 'Ready'}</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          {module.examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onExample(example)}
              className="px-3 py-1.5 rounded-full text-xs text-slate-300 bg-white/5 border border-white/8 hover:border-brand-purple/30 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-[26px] border border-white/8 bg-white/[0.03] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 text-[11px] uppercase tracking-[0.22em] text-slate-500">
            <span>Composer</span>
            <span>Melody Map context aware</span>
          </div>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={module.placeholder}
            rows={7}
            className="w-full bg-transparent text-white placeholder:text-slate-600 px-5 py-5 outline-none resize-y min-h-[210px]"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-t border-white/6">
            <span className="text-sm text-slate-500">{module.helper}</span>
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-70 btn-glow"
              style={{ background: 'linear-gradient(135deg, #7C6FFF, #FF5DA2)' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Shaping the response...' : 'Open Auralith'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SongCard({ song, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-[24px] p-4 glass-hover"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: 'rgba(124,111,255,0.16)', color: '#c4b5fd' }}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white truncate">{song.title}</h4>
          <p className="text-xs text-slate-500 truncate mt-1">{song.artist}</p>
        </div>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{song.reason}</p>
    </motion.article>
  )
}

function TagList({ title, items, color = '#A78BFA' }) {
  if (!items?.length) return null
  return (
    <div className="mt-5">
      <p className="section-label mb-3" style={{ color }}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="px-3 py-1.5 rounded-full text-xs border"
            style={{ borderColor: `${color}33`, color, background: `${color}14` }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function MetricGrid({ metrics }) {
  if (!metrics) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
      {Object.entries(metrics).map(([key, value]) => (
        <div key={key} className="rounded-[22px] p-4 bg-white/[0.03] border border-white/6">
          <p className="section-label mb-2">{key.replaceAll('_', ' ')}</p>
          <p className="text-sm text-white font-medium">{value}</p>
        </div>
      ))}
    </div>
  )
}

function LoadingPanel() {
  return (
    <section className="glass-card rounded-[32px] p-6 min-h-[560px] overflow-hidden relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top right, rgba(124,111,255,0.1), transparent 38%)' }}
      />
      <div className="relative z-10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-glow-pulse" style={{ background: 'rgba(124,111,255,0.16)' }}>
            <Disc3 className="w-5 h-5 text-brand-purple animate-spin" style={{ animationDuration: '5s' }} />
          </div>
          <div>
            <p className="text-white font-semibold">Auralith is listening</p>
            <p className="text-sm text-slate-500">Reading the prompt, profile, and emotional pacing inside Melody Map.</p>
          </div>
        </div>
        <div className="skeleton h-7 w-2/5" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-3/5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pt-3">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-36" />)}
        </div>
      </div>
    </section>
  )
}

function EmptyPanel({ module, profilePayload }) {
  return (
    <section className="glass-card rounded-[32px] p-6 min-h-[560px] flex flex-col justify-center">
      <p className="section-label mb-3">Melody Map Intelligence</p>
      <h3 className="text-3xl font-black text-white mb-3">
        {module.id === 'playlist' ? 'Auralith is ready to score a listening moment.' : `${module.label} is ready.`}
      </h3>
      <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
        {profilePayload
          ? 'Your Melody Map profile is available, so the response will bend toward your actual listening habits instead of treating this like a cold prompt.'
          : 'Auralith can begin from the prompt alone and fold in Melody Map context the moment your listening profile becomes available.'}
      </p>
      <div className="mt-6 rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
        <p className="section-label mb-3" style={{ color: '#FBBF24' }}>Try this next</p>
        <div className="flex flex-wrap gap-2">
          {module.examples.map((example) => (
            <span key={example} className="px-3 py-1.5 rounded-full text-xs border border-white/8 bg-white/[0.03] text-slate-300">
              {example}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function ErrorPanel({ error, onRetry }) {
  return (
    <section className="glass-card rounded-[32px] p-6 min-h-[560px] flex flex-col justify-center">
      <p className="section-label mb-3 text-brand-pink">Auralith paused</p>
      <h3 className="text-2xl font-black text-white mb-3">Something interrupted the listening flow</h3>
      <p className="text-sm text-slate-400 max-w-xl">{error}</p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white hover:bg-white/[0.08] transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </section>
  )
}

function ResultPanel({ module, result, loading, error, onRetry, profilePayload }) {
  if (loading) return <LoadingPanel />
  if (error) return <ErrorPanel error={error} onRetry={onRetry} />
  if (!result) return <EmptyPanel module={module} profilePayload={profilePayload} />

  const title = result.playlist_title || result.taste_profile || result.core_feeling || result.overall_assessment || result.interpretation
  const summary = result.vibe_summary || result.emotional_signature || result.why_it_works || result.flow_analysis || result.emotional_arc
  const songs = result.songs || []

  return (
    <section className="glass-card rounded-[32px] p-6 lg:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="section-label mb-2" style={{ color: '#00D1FF' }}>
            {result.mood || result.core_feeling || result.emotional_signature || 'Auralith Output'}
          </p>
          <h3 className="text-3xl lg:text-[2rem] font-black text-white leading-tight">{title}</h3>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">{summary}</p>
        </div>
        <span className="pill">{result.used_model}</span>
      </div>

      <MetricGrid metrics={result.sonic_profile || result.sonic_preferences || result.sonic_breakdown} />

      {result.why_this_fits_your_taste ? (
        <div className="mt-5 p-4 rounded-[24px] border border-white/6 bg-white/[0.04]">
          <p className="section-label mb-2" style={{ color: '#FBBF24' }}>Why this fits your taste</p>
          <p className="text-sm text-slate-300 leading-relaxed">{result.why_this_fits_your_taste}</p>
        </div>
      ) : null}

      {result.listener_alignment ? (
        <div className="mt-5 p-4 rounded-[24px] border border-white/6 bg-white/[0.03]">
          <p className="section-label mb-2" style={{ color: '#A78BFA' }}>Listener alignment</p>
          <p className="text-sm text-slate-400 leading-relaxed">{result.listener_alignment}</p>
        </div>
      ) : null}

      <TagList title="Dominant Traits" items={result.dominant_traits} />
      <TagList title="Hidden Patterns" items={result.hidden_patterns} color="#00D1FF" />
      <TagList title="Exploration Suggestions" items={result.exploration_suggestions} color="#FBBF24" />
      <TagList title="Strengths" items={result.strengths} color="#34D399" />
      <TagList title="Issues" items={result.issues} color="#FF5DA2" />
      <TagList title="Improvements" items={result.improvements} color="#FBBF24" />
      <TagList title="Similar Vibe" items={result.similar_vibe} color="#A78BFA" />

      {(result.narrative || result.emotional_effect || result.closing_note || result.recommendation_direction) ? (
        <div className="mt-5 p-4 rounded-[24px] border border-white/6 bg-white/[0.03]">
          <p className="section-label mb-2" style={{ color: '#FBBF24' }}>
            {module.id === 'taste' ? 'Where to go next' : 'Narrative'}
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            {result.narrative || result.emotional_effect || result.closing_note || result.recommendation_direction}
          </p>
        </div>
      ) : null}

      {songs.length ? (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">{module.id === 'playlist' ? 'Curated sequence' : 'Sequence'}</p>
            <span className="text-xs text-slate-500">{songs.length} tracks in focus</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {songs.map((song, index) => (
              <SongCard key={`${song.title}-${song.artist}-${index}`} song={song} index={index} />
            ))}
          </div>
        </div>
      ) : null}

      {module.id === 'critic' && result.replacement_suggestions?.length ? (
        <div className="mt-6">
          <p className="section-label mb-4">Replacement Suggestions</p>
          <div className="grid gap-3">
            {result.replacement_suggestions.map((item, index) => (
              <div key={`${item.remove}-${index}`} className="rounded-[24px] p-4 bg-white/[0.03] border border-white/6">
                <div className="flex items-center gap-2 text-sm text-white font-medium">
                  <span>{item.remove}</span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="text-brand-purple">{item.replace_with}</span>
                </div>
                <p className="text-sm text-slate-400 mt-3">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!profilePayload ? (
        <div className="mt-6 rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
          <p className="section-label mb-2" style={{ color: '#00D1FF' }}>Prompt-first fallback</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Melody Map listening data is limited right now, so Auralith leaned more heavily on the prompt and local music intelligence rather than deep profile personalization.
          </p>
        </div>
      ) : null}
    </section>
  )
}

export default function Auralith() {
  const { profile } = useMusicProfile()
  const { data: playlistsData } = usePlaylists()
  const activeProfile = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'your listening world')
  const profilePayload = useMemo(() => normalizeProfile(profile, playlistsData), [profile, playlistsData])
  const [activeModuleId, setActiveModuleId] = useState(MODULES[0].id)
  const [inputs, setInputs] = useState({
    playlist: 'dreamy shoegaze winter night',
    taste: 'Frank Ocean\nBeach House\nRadiohead',
    explainer: 'Nights - Frank Ocean',
    critic: 'Space Song - Beach House\nK. - Cigarettes After Sex\nTeardrop - Massive Attack',
    concept: 'what 3am feels like after heartbreak',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeModule = MODULES.find((module) => module.id === activeModuleId) || MODULES[0]
  const ActiveIcon = activeModule.icon

  const runModule = async () => {
    const value = inputs[activeModule.id]?.trim()
    if (!value) {
      setError('Give Auralith a scene, sequence, or listening clue to work with.')
      setResult(null)
      return
    }

    setLoading(true)
    setError('')
    try {
      const payload = activeModule.buildPayload(value, profilePayload)
      const data = await auralithAPI[activeModule.endpoint](payload)
      setResult(data.data)
    } catch (submissionError) {
      setError(submissionError.response?.data?.error || submissionError.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[32px] overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, rgba(124,111,255,0.10), rgba(255,93,162,0.06) 45%, rgba(0,209,255,0.05) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 80% 20%, rgba(255,93,162,0.12), transparent 35%), radial-gradient(ellipse at 12% 88%, rgba(0,209,255,0.06), transparent 38%)',
          }}
        />
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="section-label mb-3" style={{ color: '#FBBF24' }}>Melody Map Intelligence</p>
              <h1 className="text-4xl lg:text-5xl font-black text-white leading-[0.95]">
                Auralith reads the emotional meaning inside <span className="text-gradient-aurora">{activeProfile}</span>.
              </h1>
              <p className="text-slate-400 text-sm lg:text-base mt-4 max-w-2xl leading-relaxed">
                Built into Melody Map as its listening intelligence layer: prompt-aware, profile-aware, and designed to turn musical context into curated, explainable responses.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[420px]">
              <HeroMeter label="Active mode" value={activeModule.label} color="#c4b5fd" />
              <HeroMeter label="Tone" value="Measured / cinematic" color="#f9a8d4" />
              <HeroMeter label="Context" value={profilePayload ? 'Deep profile-linked' : 'Prompt-first'} color="#67e8f9" />
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
        <aside className="glass-card rounded-[32px] p-4 h-fit">
          <p className="section-label mb-4">Listening Modes</p>
          <div className="space-y-2">
            {MODULES.map((module) => {
              const Icon = module.icon
              const isActive = module.id === activeModule.id
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => {
                    setActiveModuleId(module.id)
                    setResult(null)
                    setError('')
                  }}
                  className={`w-full text-left rounded-[24px] p-4 transition-all ${isActive ? 'nav-item active' : 'nav-item'}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={isActive
                        ? { background: 'rgba(124,111,255,0.18)', boxShadow: '0 0 14px rgba(124,111,255,0.18)' }
                        : { background: 'rgba(255,255,255,0.04)' }}
                    >
                      <Icon className="w-4 h-4" style={isActive ? { color: '#a78bfa' } : {}} />
                    </div>
                    <div>
                      <p className="section-label mb-1" style={{ color: isActive ? '#FBBF24' : undefined }}>{module.eyebrow}</p>
                      <p className="text-sm font-semibold text-white">{module.label}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{module.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-3">
            <ContextBanner profilePayload={profilePayload} playlistCount={profilePayload?.savedPlaylists?.length || 0} />

            <div className="rounded-[24px] p-4 border border-white/6 bg-white/[0.03]">
              <div className="flex items-start gap-3">
                <Waves className="w-4 h-4 text-brand-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Response design</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">
                    Every module returns structured, scan-friendly output so the intelligence feels product-grade inside Melody Map rather than like a raw assistant transcript.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.2), rgba(255,93,162,0.14))' }}
            >
              <ActiveIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="section-label">Now listening</p>
              <p className="text-white font-semibold">{activeModule.eyebrow}</p>
            </div>
            {activeModule.id === 'playlist' ? (
              <span className="pill ml-auto">
                <Radio className="w-3 h-3 mr-1" />
                Flagship experience
              </span>
            ) : null}
          </div>

          <Composer
            module={activeModule}
            value={inputs[activeModule.id]}
            onChange={(value) => setInputs((current) => ({ ...current, [activeModule.id]: value }))}
            onExample={(value) => setInputs((current) => ({ ...current, [activeModule.id]: value }))}
            onSubmit={runModule}
            loading={loading}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeModule.id}-${Boolean(result)}-${loading}-${Boolean(error)}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ResultPanel
                module={activeModule}
                result={result}
                loading={loading}
                error={error}
                onRetry={runModule}
                profilePayload={profilePayload}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
