import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Sparkles, Wand2, AudioLines, Brain, FileSearch, Compass, HeartHandshake,
  ArrowRight, Loader2, RotateCcw, Disc3, Waves, Radio, History, Eraser, Clock3,
} from 'lucide-react'
import useMusicProfile from '../hooks/useMusicProfile'
import { usePlaylists } from '../hooks/useMusicData'
import useStore from '../store/useStore'
import { auralithAPI } from '../services/api'
import ProfileBootPanel from '../components/ProfileBootPanel'
import DeferredSoulOrb from '../components/DeferredSoulOrb'
import AuralithShareCard from '../components/AuralithShareCard'
import { BrandBackdrop, BrandConstellation, BrandMark, BrandWatermark } from '../components/brand/BrandSystem'
import { useRouteReadiness } from '../hooks/useRouteReadiness'

const DEFAULT_INPUTS = {
  playlist: 'dreamy shoegaze winter night',
  taste: 'Frank Ocean\nBeach House\nRadiohead',
  explainer: 'Nights - Frank Ocean',
  critic: 'Space Song - Beach House\nK. - Cigarettes After Sex\nTeardrop - Massive Attack',
  concept: 'what 3am feels like after heartbreak',
}

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

const MODULE_THEME = {
  playlist: { primary: '#b691ff', accent: '#ff7dd1', energy: 0.66, valence: 0.58, danceability: 0.56 },
  taste: { primary: '#7cc9ff', accent: '#a78bfa', energy: 0.48, valence: 0.44, danceability: 0.38 },
  explainer: { primary: '#ffd38a', accent: '#ff8cc6', energy: 0.4, valence: 0.46, danceability: 0.28 },
  critic: { primary: '#ff8fa5', accent: '#8fd0ff', energy: 0.54, valence: 0.36, danceability: 0.34 },
  concept: { primary: '#9ef7e4', accent: '#b691ff', energy: 0.44, valence: 0.52, danceability: 0.42 },
}

function buildAuralithResonance({ module, prompt, loading, result, error, sessionCount }) {
  const theme = MODULE_THEME[module.id] || MODULE_THEME.playlist
  const intensity = Math.min(1, (prompt.trim().length || 0) / 180)

  if (loading) {
    return {
      kind: 'edge',
      label: `${module.label} listening`,
      subtitle: 'holding your prompt and profile in one field',
      mode: 'focused',
      strength: 0.9,
      colors: {
        primary: theme.primary,
        secondary: theme.accent,
        accent: '#ffffff',
      },
      features: {
        energy: theme.energy + 0.16,
        valence: theme.valence + 0.08,
        danceability: theme.danceability + 0.16,
        acousticness: 0.18,
        speechiness: 0.38,
      },
      metrics: {
        centrality: 0.76,
        bridgeScore: 0.92,
        discoveryScore: Math.min(0.88, 0.34 + sessionCount * 0.04),
      },
      influence: {
        pulseSpeed: 0.32,
        pulseAmplitude: 0.24,
        breatheAmplitude: 0.16,
        distort: 0.24,
        rotationSpeed: 0.22,
        rotationWobble: 0.18,
        glowIntensity: 0.34,
        ringWarp: 0.3,
        shellBonus: 1,
        satelliteBonus: 2,
      },
      evidence: ['Prompt in motion', 'Profile signal engaged'],
      explanation: 'Auralith is actively braiding your words with your listening identity, so the orb sharpens and threads itself into a brighter bridge state.',
    }
  }

  if (error) {
    return {
      kind: 'region',
      label: 'interrupted signal',
      subtitle: 'static moving across the chamber',
      mode: 'ambient',
      strength: 0.3,
      colors: {
        primary: '#8b6b9d',
        secondary: '#5e78a3',
        accent: '#f38ab6',
      },
      features: {
        energy: 0.24,
        valence: 0.18,
        danceability: 0.16,
        acousticness: 0.44,
        speechiness: 0.12,
      },
      metrics: {
        centrality: 0.22,
        bridgeScore: 0.18,
        discoveryScore: 0.08,
      },
      influence: {
        pulseSpeed: -0.04,
        pulseAmplitude: -0.06,
        breatheAmplitude: 0.04,
        distort: -0.02,
        rotationSpeed: -0.03,
        rotationWobble: 0.02,
        glowIntensity: -0.06,
        ringWarp: -0.04,
        shellBonus: 0,
        satelliteBonus: 0,
      },
      evidence: ['Signal disrupted'],
      explanation: 'The reading paused before it could settle, so the orb dims slightly and holds a softer, more cautious shape.',
    }
  }

  if (result) {
    return {
      kind: 'region',
      label: `${module.label} resolved`,
      subtitle: 'the response has settled into memory',
      mode: 'focused',
      strength: 0.7,
      colors: {
        primary: theme.primary,
        secondary: theme.accent,
        accent: '#f8dd86',
      },
      features: {
        energy: theme.energy,
        valence: theme.valence + 0.12,
        danceability: theme.danceability + 0.06,
        acousticness: 0.24,
        speechiness: 0.2,
      },
      metrics: {
        centrality: 0.68,
        bridgeScore: 0.42,
        discoveryScore: Math.min(0.8, 0.24 + sessionCount * 0.04),
      },
      influence: {
        pulseSpeed: 0.14,
        pulseAmplitude: 0.08,
        breatheAmplitude: 0.12,
        distort: 0.06,
        rotationSpeed: 0.09,
        rotationWobble: 0.08,
        glowIntensity: 0.18,
        ringWarp: 0.12,
        shellBonus: 1,
        satelliteBonus: 1,
      },
      evidence: ['Response anchored', 'Memory retained'],
      explanation: 'The response has landed, so the orb steadies into a calmer halo that feels more like held understanding than active search.',
    }
  }

  if (prompt.trim()) {
    return {
      kind: 'artist',
      label: 'composing a prompt',
      subtitle: 'your words are tuning the listening entity',
      mode: 'live',
      strength: Math.max(0.38, intensity * 0.8),
      colors: {
        primary: theme.primary,
        secondary: theme.accent,
        accent: '#e8d8ff',
      },
      features: {
        energy: theme.energy + intensity * 0.06,
        valence: theme.valence + intensity * 0.04,
        danceability: theme.danceability + intensity * 0.08,
        acousticness: 0.2,
        speechiness: Math.min(0.62, 0.18 + intensity * 0.32),
      },
      metrics: {
        centrality: 0.4 + intensity * 0.22,
        bridgeScore: 0.24 + intensity * 0.26,
        discoveryScore: 0.16 + intensity * 0.2,
      },
      influence: {
        pulseSpeed: 0.12 + intensity * 0.1,
        pulseAmplitude: 0.06 + intensity * 0.08,
        breatheAmplitude: 0.04 + intensity * 0.06,
        distort: 0.05 + intensity * 0.07,
        rotationSpeed: 0.07 + intensity * 0.08,
        rotationWobble: 0.04 + intensity * 0.06,
        glowIntensity: 0.12 + intensity * 0.14,
        ringWarp: 0.08 + intensity * 0.08,
        shellBonus: intensity > 0.5 ? 1 : 0,
        satelliteBonus: intensity > 0.7 ? 1 : 0,
      },
      evidence: ['Prompt shaping in real time'],
      explanation: 'As you type, the orb leans toward your language and starts pre-shaping the interpretation before the answer is even generated.',
    }
  }

  return {
    kind: 'core',
    label: module.label,
    subtitle: 'waiting for the next emotional clue',
    mode: 'ambient',
    strength: 0.34,
    colors: {
      primary: theme.primary,
      secondary: theme.accent,
      accent: '#c6d9ff',
    },
    features: {
      energy: theme.energy * 0.76,
      valence: theme.valence,
      danceability: theme.danceability * 0.78,
      acousticness: 0.3,
      speechiness: 0.12,
    },
    metrics: {
      centrality: 0.34,
      bridgeScore: 0.12,
      discoveryScore: Math.min(0.72, 0.12 + sessionCount * 0.03),
    },
    influence: {
      pulseSpeed: 0.04,
      pulseAmplitude: 0.03,
      breatheAmplitude: 0.03,
      distort: 0.03,
      rotationSpeed: 0.04,
      rotationWobble: 0.03,
      glowIntensity: 0.08,
      ringWarp: 0.06,
      shellBonus: 0,
      satelliteBonus: 0,
    },
    evidence: ['Chamber ready'],
    explanation: 'Auralith is idle but attentive, holding the module’s emotional shape until you give it a new signal.',
  }
}

function createSessionSummary(result) {
  return result?.vibe_summary
    || result?.emotional_signature
    || result?.why_it_works
    || result?.overall_assessment
    || result?.interpretation
    || 'Auralith saved this reading for later.'
}

function createSessionTitle(module, prompt, result) {
  return result?.playlist_title
    || result?.taste_profile
    || result?.core_feeling
    || result?.overall_assessment
    || result?.interpretation
    || `${module.label}: ${prompt.trim().slice(0, 42)}${prompt.trim().length > 42 ? '…' : ''}`
}

function formatSessionTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

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
            {connected ? 'Your listening context is present' : 'Prompt-first drift'}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mt-2">
            {hasDeepContext
              ? `Auralith is holding your top artists, songs, recent listening, atmospheres, and ${playlistCount} saved playlists while it answers.`
              : 'Auralith can still begin from a feeling alone, and it will fold in Melody Map context the moment your profile is ready.'}
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
            <span>listening-aware</span>
          </div>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={module.placeholder}
            rows={7}
            className="orb-input w-full bg-transparent text-white placeholder:text-slate-600 px-5 py-5 outline-none resize-y min-h-[210px]"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-t border-white/6">
            <span className="text-sm text-slate-500">{module.helper}</span>
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="orb-button inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-70 btn-glow"
              style={{ background: 'linear-gradient(135deg, #7C6FFF, #FF5DA2)' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Listening closely...' : 'Send into Auralith'}
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
            <p className="text-sm text-slate-500">Holding the prompt, your profile, and the emotional pacing between them.</p>
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
        {module.id === 'playlist' ? 'Auralith is ready to score a listening moment.' : `${module.label} is ready to open.`}
      </h3>
      <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
        {profilePayload
          ? 'Your Melody Map profile is present, so the response can bend toward your real habits instead of staying at surface level.'
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
      <h3 className="text-2xl font-black text-white mb-3">something slipped through the static</h3>
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

function RecentSessions({ sessions, activeSessionId, onOpen, onClear }) {
  if (!sessions?.length) {
    return (
      <div className="rounded-[24px] p-4 border border-white/6 bg-white/[0.03]">
        <div className="flex items-start gap-3">
          <History className="w-4 h-4 text-brand-purple mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">Session memory is ready</p>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              Once you generate a reading, it will stay here so you can reopen it instead of losing the thread.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[24px] p-4 border border-white/6 bg-white/[0.03]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="section-label mb-1">Recent sessions</p>
          <p className="text-xs text-slate-500">Auralith keeps your last readings warm.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-400 hover:bg-white/[0.06] hover:text-white transition-all"
        >
          <Eraser className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      <div className="space-y-2">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onOpen(session)}
              className={`w-full rounded-[22px] border p-3 text-left transition-all ${isActive ? 'bg-white/[0.08] border-brand-purple/30 shadow-[0_0_24px_rgba(124,111,255,0.12)]' : 'bg-white/[0.02] border-white/6 hover:bg-white/[0.05] hover:border-white/12'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{session.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{session.moduleLabel}</p>
                </div>
                <span className="pill shrink-0">{session.result?.used_model || 'saved'}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400 line-clamp-3">{session.summary}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <Clock3 className="w-3.5 h-3.5" />
                <span>{formatSessionTime(session.createdAt)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResultPanel({ module, result, loading, error, onRetry, profilePayload, session, profileName }) {
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
          <p className="section-label mb-2" style={{ color: '#FBBF24' }}>Why it feels true</p>
          <p className="text-sm text-slate-300 leading-relaxed">{result.why_this_fits_your_taste}</p>
        </div>
      ) : null}

      {result.listener_alignment ? (
        <div className="mt-5 p-4 rounded-[24px] border border-white/6 bg-white/[0.03]">
          <p className="section-label mb-2" style={{ color: '#A78BFA' }}>Where it meets you</p>
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
          <p className="section-label mb-2" style={{ color: '#00D1FF' }}>Prompt-led reading</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Melody Map listening data is limited right now, so Auralith leaned more heavily on your words than on the deeper profile signal.
          </p>
        </div>
      ) : null}

      {session ? (
        <div className="mt-6">
          <AuralithShareCard session={session} profileName={profileName} />
        </div>
      ) : null}
    </section>
  )
}

export default function Auralith() {
  const [searchParams] = useSearchParams()
  const { profile, phase, readiness, tier } = useMusicProfile()
  const { data: playlistsData } = usePlaylists()
  const activeProfile = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'your listening world')
  const storedAuralithSessions = useStore((s) => s.auralithSessions)
  const storedAuralithDrafts = useStore((s) => s.auralithDrafts)
  const storedAuralithModuleId = useStore((s) => s.auralithActiveModuleId)
  const setAuralithActiveModuleId = useStore((s) => s.setAuralithActiveModuleId)
  const setAuralithDraft = useStore((s) => s.setAuralithDraft)
  const saveAuralithSession = useStore((s) => s.saveAuralithSession)
  const clearAuralithSessions = useStore((s) => s.clearAuralithSessions)
  const profilePayload = useMemo(() => normalizeProfile(profile, playlistsData), [profile, playlistsData])
  const [activeModuleId, setActiveModuleId] = useState(() => (
    MODULES.some((module) => module.id === storedAuralithModuleId) ? storedAuralithModuleId : MODULES[0].id
  ))
  const [inputs, setInputs] = useState(() => ({
    ...DEFAULT_INPUTS,
    ...(storedAuralithDrafts || {}),
  }))
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSessionId, setActiveSessionId] = useState(null)

  const boot = useRouteReadiness({
    phase,
    profile,
    readiness,
    tier,
    require: { profile: true },
    copy: {
      loading: {
        title: 'Auralith is gathering your signal.',
        subtitle: 'We are tuning into your listening history before the interpreter settles.',
        detail: 'Hold steady.',
      },
      empty: {
        title: 'Connect a music source to awaken Auralith.',
        subtitle: 'The interpreter needs a listening signal to speak with precision.',
        detail: 'No signal is present yet.',
      },
      error: {
        title: 'Auralith could not reach your signal.',
        subtitle: 'The listening data is unavailable right now.',
        detail: 'Refresh once and the interpreter should return.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'Auralith will keep the responses lighter while your profile deepens.',
        detail: 'This is intentional, not an error.',
      },
    },
  })
  const activeModule = MODULES.find((module) => module.id === activeModuleId) || MODULES[0]
  const ActiveIcon = activeModule.icon
  const activePrompt = inputs[activeModule.id] || ''
  const recentSessions = useMemo(() => (storedAuralithSessions || []).slice(0, 6), [storedAuralithSessions])
  const activeSession = useMemo(
    () => (storedAuralithSessions || []).find((session) => session.id === activeSessionId) || null,
    [activeSessionId, storedAuralithSessions],
  )
  const orbResonance = useMemo(
    () => buildAuralithResonance({
      module: activeModule,
      prompt: activePrompt,
      loading,
      result,
      error,
      sessionCount: storedAuralithSessions?.length || 0,
    }),
    [activeModule, activePrompt, error, loading, result, storedAuralithSessions],
  )

  const updateDraft = (moduleId, value) => {
    setInputs((current) => ({ ...current, [moduleId]: value }))
    setAuralithDraft(moduleId, value)
  }

  const resetCurrentReading = () => {
    setResult(null)
    setError('')
    setActiveSessionId(null)
  }

  const switchModule = (moduleId) => {
    setActiveModuleId(moduleId)
    setAuralithActiveModuleId(moduleId)
    resetCurrentReading()
  }

  useEffect(() => {
    const requestedModule = searchParams.get('mode')
    const requestedPrompt = searchParams.get('prompt')
    const normalizedModule = requestedModule && MODULES.some((module) => module.id === requestedModule)
      ? requestedModule
      : activeModuleId

    if (requestedModule && MODULES.some((module) => module.id === requestedModule) && requestedModule !== activeModuleId) {
      setActiveModuleId(requestedModule)
      setAuralithActiveModuleId(requestedModule)
      setActiveSessionId(null)
      setResult(null)
      setError('')
    }
    if (requestedPrompt && inputs[normalizedModule] !== requestedPrompt) {
      updateDraft(normalizedModule, requestedPrompt)
    }
  }, [activeModuleId, inputs, searchParams, setAuralithActiveModuleId])

  if (boot.blocked) {
    return (
      <ProfileBootPanel
        variant={boot.variant}
        title={boot.title}
        subtitle={boot.subtitle}
        detail={boot.detail}
        actionLabel={boot.variant === 'error' ? 'Reload Auralith' : undefined}
        onAction={boot.variant === 'error' ? () => window.location.reload() : undefined}
      />
    )
  }

  const runModule = async () => {
    const value = inputs[activeModule.id]?.trim()
    if (!value) {
      setError('Give Auralith a scene, sequence, or listening clue to work with.')
      setResult(null)
      return
    }

    setLoading(true)
    setError('')
    setActiveSessionId(null)
    try {
      const payload = activeModule.buildPayload(value, profilePayload)
      const data = await auralithAPI[activeModule.endpoint](payload)
      const nextResult = data.data
      const nextSession = {
        id: `auralith-${Date.now()}`,
        moduleId: activeModule.id,
        moduleLabel: activeModule.label,
        prompt: value,
        result: nextResult,
        title: createSessionTitle(activeModule, value, nextResult),
        summary: createSessionSummary(nextResult),
        createdAt: new Date().toISOString(),
      }
      saveAuralithSession(nextSession)
      setActiveSessionId(nextSession.id)
      setResult(nextResult)
    } catch (submissionError) {
      setError(submissionError.response?.data?.error || submissionError.message)
      setActiveSessionId(null)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const reopenSession = (session) => {
    setActiveModuleId(session.moduleId)
    setAuralithActiveModuleId(session.moduleId)
    updateDraft(session.moduleId, session.prompt || '')
    setActiveSessionId(session.id)
    setLoading(false)
    setResult(session.result || null)
    setError('')
  }

  return (
    <div className="cosmic-page space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="brand-panel living-grid overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, rgba(143,117,255,0.12), rgba(242,141,223,0.06) 45%, rgba(159,208,255,0.05) 100%)',
        }}
      >
        <BrandBackdrop opacity={0.22} />
        <BrandConstellation className="opacity-60" />
        <BrandWatermark className="absolute right-[-4%] top-[-12%] w-[28rem]" opacity={0.08} rotate={10} />
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3">
                <BrandMark size={42} muted />
                <p className="section-label" style={{ color: '#FBBF24' }}>Melody Map Intelligence</p>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-white leading-[0.95]">
                Auralith reads the emotional meaning inside <span className="text-gradient-aurora">{activeProfile}</span>.
              </h1>
              <p className="text-slate-400 text-sm lg:text-base mt-4 max-w-2xl leading-relaxed">
                Built into Melody Map as its quiet interpreter: prompt-aware, profile-aware, and shaped to turn musical context into responses that still feel human.
              </p>
            </div>

            <div className="flex w-full flex-col gap-4 lg:w-[420px]">
              <div className="flex items-center gap-4 rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur-2xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeModule.id}-${loading}-${Boolean(result)}-${Boolean(error)}`}
                    initial={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(14px)' }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <DeferredSoulOrb
                      size={118}
                      personality={profile?.personality}
                      personalityMeta={profile?.personalityMeta}
                      mbti={profile?.mbti}
                      mbtiMeta={profile?.mbtiMeta}
                      audioFeatures={profile?.audioFeatures}
                      analyticsMetrics={profile?.analyticsMetrics}
                      confidence={profile?.confidence}
                      dataQuality={profile?.dataQuality}
                      genres={profile?.genres}
                      topArtists={profile?.topArtists}
                      resonance={orbResonance}
                      lowPower={tier === 'sparse' || tier === 'limited'}
                      showLabels={false}
                    />
                  </motion.div>
                </AnimatePresence>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/45">
                    <BrandMark size={16} muted />
                    Living interpreter
                  </div>
                  <p className="text-sm font-semibold text-white">The orb is Auralith’s active listening state.</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    It brightens while you type, threads itself during active readings, and settles completed responses into memory.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <HeroMeter label="Active mode" value={activeModule.label} color="#c4b5fd" />
                <HeroMeter label="Tone" value="soft / cinematic" color="#f9a8d4" />
                <HeroMeter label="Context" value={profilePayload ? 'Profile-held' : 'Prompt-first'} color="#67e8f9" />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Link
          to="/discover"
          className="rounded-[24px] p-4 glass-hover"
          style={{ background: 'rgba(0,209,255,0.08)', border: '1px solid rgba(0,209,255,0.16)' }}
        >
          <p className="section-label mb-2" style={{ color: '#00D1FF' }}>Need a fresh signal?</p>
          <p className="text-sm font-semibold text-white">Drift through Discover first</p>
          <p className="mt-1 text-xs text-slate-500">Let a few new sequences arrive before you ask for a deeper reading.</p>
        </Link>
        <Link
          to="/galaxy?mode=artist"
          className="rounded-[24px] p-4 glass-hover"
          style={{ background: 'rgba(124,111,255,0.08)', border: '1px solid rgba(124,111,255,0.16)' }}
        >
          <p className="section-label mb-2">Coming from the galaxy</p>
          <p className="text-sm font-semibold text-white">Bring a star back with you</p>
          <p className="mt-1 text-xs text-slate-500">Touch a region or artist in the field, then return here and let Auralith translate it.</p>
        </Link>
        <Link
          to="/identity"
          className="rounded-[24px] p-4 glass-hover"
          style={{ background: 'rgba(242,141,223,0.08)', border: '1px solid rgba(242,141,223,0.16)' }}
        >
          <p className="section-label mb-2" style={{ color: '#F28DDF' }}>Inner reading</p>
          <p className="text-sm font-semibold text-white">Hold your music self nearby</p>
          <p className="mt-1 text-xs text-slate-500">The stronger your identity reading becomes, the more nuanced these responses can feel.</p>
        </Link>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
        <aside className="glass-card rounded-[32px] p-4 h-fit">
          <p className="section-label mb-4">Ways of listening</p>
          <div className="space-y-2">
            {MODULES.map((module) => {
              const Icon = module.icon
              const isActive = module.id === activeModule.id
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => switchModule(module.id)}
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
            <RecentSessions
              sessions={recentSessions}
              activeSessionId={activeSessionId}
              onOpen={reopenSession}
              onClear={() => {
                clearAuralithSessions()
                setActiveSessionId(null)
                setResult(null)
              }}
            />

            <div className="rounded-[24px] p-4 border border-white/6 bg-white/[0.03]">
              <div className="flex items-start gap-3">
                <Waves className="w-4 h-4 text-brand-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Response shape</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">
                    Every module returns something shaped for reading, so the intelligence feels like part of the product rather than a pasted transcript.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <div className="orb-button w-11 h-11 rounded-2xl flex items-center justify-center">
              <ActiveIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="section-label">Now listening</p>
              <p className="text-white font-semibold">{activeModule.eyebrow}</p>
            </div>
            {activeModule.id === 'playlist' ? (
              <span className="pill">
                <Radio className="w-3 h-3 mr-1" />
                Flagship experience
              </span>
            ) : null}
            <button
              type="button"
              onClick={resetCurrentReading}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New reading
            </button>
          </div>

          <Composer
            module={activeModule}
            value={inputs[activeModule.id]}
            onChange={(value) => updateDraft(activeModule.id, value)}
            onExample={(value) => updateDraft(activeModule.id, value)}
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
                session={activeSession}
                profileName={activeProfile}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
