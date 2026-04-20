import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Sparkles, RefreshCw, Download, Share2, ExternalLink,
  Palette, Wand2, User, ChevronDown, ZoomIn,
} from 'lucide-react'
import { aestheticAPI, spotifyAPI, lastfmAPI, pinterestAPI } from '../services/api'
import { normalizeAestheticResponse, normalizeListResponse } from '../services/dataAdapters'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import VibeEmitter from '../components/VibeEmitter'
import ProfileBootPanel from '../components/ProfileBootPanel'
import { useRouteReadiness } from '../hooks/useRouteReadiness'

import toast from 'react-hot-toast'

function confidenceTone(label) {
  if (label === 'high') return { text: '#86efac', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.22)' }
  if (label === 'medium') return { text: '#fcd34d', bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.22)' }
  if (label === 'low') return { text: '#f9a8d4', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.22)' }
  return { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.22)' }
}

// ── Parallax mouse tracker ─────────────────────────────────────────────────────
function useParallax() {
  const reduceMotion = useReducedMotion()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 40, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 40, damping: 20 })

  useEffect(() => {
    if (reduceMotion) {
      mouseX.set(0)
      mouseY.set(0)
      return undefined
    }
    const handler = (e) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      mouseX.set((e.clientX - cx) / cx)
      mouseY.set((e.clientY - cy) / cy)
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [mouseX, mouseY, reduceMotion])

  return { springX, springY }
}

// ── Floating particle background ──────────────────────────────────────────────
function CosmicBackground({ palette, lowPower = false }) {
  const particles = useMemo(() =>
    Array.from({ length: lowPower ? 10 : 18 }, (_, i) => ({
      id: i,
      color: palette[i % palette.length] || '#6366f1',
      x: 5 + (i * 17 + 11) % 90,
      y: 5 + (i * 23 + 7) % 90,
      size: 3 + (i % 5) * 2,
      duration: (lowPower ? 10 : 7) + (i % 6) * 2,
      delay: (i % 5) * 0.8,
      drift: 15 + (i % 4) * 10,
    })), [lowPower, palette])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Radial gradient backdrop */}
      <div
        className="absolute inset-0 opacity-30"
        style={{ background: `radial-gradient(ellipse at 30% 40%, ${palette[2] || '#7209b7'}33 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, ${palette[0] || '#1a1a2e'}66 0%, transparent 60%)` }}
      />
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}88`,
          }}
          animate={{ y: [-p.drift, p.drift, -p.drift], x: [-p.drift / 2, p.drift / 2, -p.drift / 2], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ── Floating image card (cosmic orbit layout) ─────────────────────────────────
function FloatingImageCard({ img, index, total, isCenter, springX, springY }) {
  const [loaded, setLoaded] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const reduceMotion = useReducedMotion()

  // Parallax depth — center images move less
  const depth = isCenter ? 0.02 : 0.06 + (index % 3) * 0.02
  const px = useTransform(springX, [-1, 1], [-depth * 60, depth * 60])
  const py = useTransform(springY, [-1, 1], [-depth * 40, depth * 40])

  // Slow autonomous float
  const floatY = isCenter ? [-6, 6, -6] : [-12 - (index % 4) * 3, 12 + (index % 4) * 3, -12 - (index % 4) * 3]
  const floatDuration = 6 + (index % 5) * 1.5

  const aspectRatio = img.height && img.width ? img.height / img.width : 1.3

  return (
    <>
      <motion.div
        style={{ x: px, y: py }}
        animate={reduceMotion ? undefined : { y: floatY }}
        transition={reduceMotion ? undefined : { duration: floatDuration, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
        className="relative group"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.8 }}
          transition={{ duration: 0.6, delay: index * 0.05 }}
          whileHover={reduceMotion ? undefined : { scale: 1.06, zIndex: 20 }}
          className={`relative rounded-2xl overflow-hidden cursor-pointer shadow-2xl ${
            isCenter ? 'ring-2 ring-white/20' : 'ring-1 ring-white/8'
          }`}
          style={{
            paddingBottom: `${Math.min(Math.max(aspectRatio * 100, 75), 160)}%`,
            boxShadow: isCenter ? `0 0 40px ${img._glowColor || '#6366f1'}44` : undefined,
          }}
          onClick={() => setZoomed(true)}
        >
          <img
            src={img.thumb || img.url}
            alt={img.description}
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          {/* Soft glow overlay */}
          {isCenter && (
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/30 via-transparent to-transparent" />
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <p className="text-xs text-white font-medium truncate">{img.description}</p>
            <p className="text-xs text-white/50 truncate">Photo {img.photographer}</p>
          </div>
          {/* Zoom icon */}
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-4 h-4 text-white/70" />
          </div>
          {/* Pinterest */}
          <a
            href={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(img.tag)}`}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </motion.div>

        {/* Tag label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 0.7 : 0 }}
          className="absolute -bottom-5 left-0 right-0 text-center"
        >
          <span className="text-xs text-gray-500 truncate block px-1">{img.tag}</span>
        </motion.div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={img.url} alt={img.description} className="w-full h-full object-contain" />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-sm text-white">{img.description}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-white/60">Photo {img.photographer}</p>
                  <a href={img.unsplash_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1">
                    View on Unsplash <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Cosmic moodboard (center cluster + outer orbit) ───────────────────────────
function CosmicMoodboard({ images, palette }) {
  const { springX, springY } = useParallax()
  const [showAll, setShowAll] = useState(false)

  // Assign glow colors from palette
  const tagged = images.map((img, i) => ({ ...img, _glowColor: palette[i % palette.length] }))
  const center  = tagged.slice(0, 3)
  const orbit   = tagged.slice(3, showAll ? tagged.length : 15)

  return (
    <div className="space-y-6">
      {/* Center cluster */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
          inner atmosphere
        </p>
        <div className="grid grid-cols-3 gap-4">
          {center.map((img, i) => (
            <FloatingImageCard
              key={img.id}
              img={img}
              index={i}
              total={center.length}
              isCenter
              springX={springX}
              springY={springY}
            />
          ))}
        </div>
      </div>

      {/* Outer orbit */}
      {orbit.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
            outer drift
          </p>
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
            {orbit.map((img, i) => (
              <div key={img.id} className="break-inside-avoid mb-3">
                <FloatingImageCard
                  img={img}
                  index={i + 3}
                  total={orbit.length}
                  isCenter={false}
                  springX={springX}
                  springY={springY}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!showAll && images.length > 15 && (
        <div className="flex justify-center pt-4">
          <motion.button
            onClick={() => setShowAll(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-300 text-sm font-medium transition-all"
          >
            <ChevronDown className="w-4 h-4" />
            Bring in all {images.length} frames
          </motion.button>
        </div>
      )}
    </div>
  )
}

// ── Color palette ──────────────────────────────────────────────────────────────
function ColorPalette({ palette }) {
  const [copied, setCopied] = useState(null)

  const copy = (color) => {
    navigator.clipboard.writeText(color)
    setCopied(color)
    setTimeout(() => setCopied(null), 1500)
  }

  const downloadPalette = () => {
    const lines = palette.map((c, i) => `Color ${i + 1}: ${c}`).join('\n')
    const blob  = new Blob([lines], { type: 'text/plain' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = 'melody-map-palette.txt'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Palette held close')
  }

  return (
    <div>
      <div className="flex gap-3 flex-wrap mb-3">
        {palette.map((color, i) => (
          <motion.button
            key={i}
            onClick={() => copy(color)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.12, y: -6 }}
            className="flex flex-col items-center gap-1.5 group"
            title={`Copy ${color}`}
          >
            <div
              className="w-14 h-14 rounded-2xl ring-2 ring-white/10 group-hover:ring-white/40 transition-all"
              style={{ backgroundColor: color, boxShadow: `0 0 24px ${color}66, 0 0 8px ${color}44` }}
            />
            <span className="text-xs text-gray-500 font-mono group-hover:text-white transition-colors">
              {copied === color ? 'held close' : color}
            </span>
          </motion.button>
        ))}
      </div>
      <button
        onClick={downloadPalette}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mt-1"
      >
        <Download className="w-3.5 h-3.5" /> Keep this palette
      </button>
    </div>
  )
}

// ── Aesthetic tag pills ────────────────────────────────────────────────────────
function TagPills({ tags }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <motion.a
          key={i}
          href={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(tag)}`}
          target="_blank" rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
          whileHover={{ scale: 1.06 }}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/12 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/25 hover:border-indigo-400/40 transition-all flex items-center gap-1"
        >
          {tag}
          <ExternalLink className="w-2.5 h-2.5 opacity-40" />
        </motion.a>
      ))}
    </div>
  )
}

// ── Personality card ───────────────────────────────────────────────────────────
function PersonalityCard({ personality }) {
  if (!personality) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Sonic identity</span>
      </div>
      <p className="text-xs text-purple-400 font-medium uppercase tracking-widest mb-1">what gathers here</p>
      <h3 className="text-2xl font-bold text-white mb-2">{personality.name}</h3>
      <p className="text-gray-300 text-sm leading-relaxed">{personality.description}</p>
      {personality.traits?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {personality.traits.map((t) => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onGenerate, loading }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/25 to-purple-600/25 border border-indigo-500/20 flex items-center justify-center mb-6"
      >
        <Wand2 className="w-10 h-10 text-indigo-400" />
      </motion.div>
      <h2 className="text-2xl font-bold text-white mb-2">Find the atmosphere you live in</h2>
      <p className="text-gray-400 max-w-md mb-8 text-sm leading-relaxed">
        Connect Spotify or Last.fm, then let the visual weather of your listening come into focus.
      </p>
      <motion.button
        onClick={onGenerate}
        disabled={loading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-lg shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? <><RefreshCw className="w-5 h-5 animate-spin" /> shaping the atmosphere...</>
          : <><Sparkles className="w-5 h-5" /> Reveal the atmosphere</>
        }
      </motion.button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MusicAesthetic() {
  const [aesthetic, setAesthetic]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [seedOffset, setSeedOffset] = useState(0)
  const [activeTab, setActiveTab]   = useState('board') // 'board' | 'pinterest'
  const [pinterestPins, setPinterestPins]   = useState(null)
  const [pinterestLoading, setPinterestLoading] = useState(false)
  const [aestheticStatus, setAestheticStatus] = useState('empty')
  const [aestheticWarnings, setAestheticWarnings] = useState([])
  const profileRef = useRef(null)

  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected  = useStore((s) => s.lastfmConnected)
  const setAestheticState = useStore((s) => s.setAestheticState)

  // Pull from central profile store — avoids redundant Spotify calls
  const { profile, phase, readiness, tier } = useMusicProfile({ autoFetch: true })
  const lowPower = tier === 'sparse' || tier === 'limited'
  const hasSupportingSignals = Boolean(
    aesthetic?.supportingSignals?.genreEvidence?.length
      || aesthetic?.supportingSignals?.artistEvidence?.length
      || aesthetic?.supportingSignals?.audioEvidence?.length
      || aesthetic?.supportingSignals?.discoveryEvidence?.length
      || aesthetic?.eraInfluence?.dominant?.length
  )

  const boot = useRouteReadiness({
    phase,
    profile,
    readiness,
    tier,
    require: { profile: true, aesthetic: true },
    copy: {
      loading: {
        title: 'The atmosphere is gathering.',
        subtitle: 'We are shaping your aesthetic field from the listening signal.',
        detail: 'This will settle shortly.',
      },
      empty: {
        title: 'Connect a music source to reveal your aesthetic.',
        subtitle: 'Once the listening signal arrives, the mood shrine will appear.',
        detail: 'No signal is present yet.',
      },
      error: {
        title: 'The aesthetic field could not load.',
        subtitle: 'The listening data is not reachable right now.',
        detail: 'Refresh once and the atmosphere should return.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'We are rendering a lighter shrine until the profile deepens.',
        detail: 'This is intentional, not an error.',
      },
    },
  })

  if (boot.blocked) {
    return (
      <ProfileBootPanel
        variant={boot.variant}
        title={boot.title}
        subtitle={boot.subtitle}
        detail={boot.detail}
        actionLabel={boot.variant === 'error' ? 'Reload the atmosphere' : undefined}
        onAction={boot.variant === 'error' ? () => window.location.reload() : undefined}
      />
    )
  }

  // ── Build taste profile — prefer central profile, fallback to direct fetch ──
  const buildProfile = useCallback(async () => {
    // Use pre-computed data from /api/music-profile if available
    if (profile?.topArtists?.length || profile?.topTracks?.length || profile?.genres?.length) {
      return {
        profileSchemaVersion: profile.profileSchemaVersion,
        provider: profile.provider,
        topArtists: profile.topArtists || [],
        topTracks: profile.topTracks || [],
        genres: profile.genres || [],
        audioFeatures: profile.audioFeatures || {},
        audioFeaturesList: profile.audioFeaturesList || [],
        analyticsMetrics: profile.analyticsMetrics || null,
        dataQuality: profile.dataQuality || {},
        confidence: profile.confidence || {},
      }
    }

    // Fallback: fetch directly
    let genres = [], topArtists = [], topTracks = [], audioFeatures = {}
    try {
      if (spotifyConnected) {
        const [artistsRes, tracksRes] = await Promise.all([
          spotifyAPI.getTopArtists({ limit: 50, time_range: 'medium_term' }),
          spotifyAPI.getTopTracks({ limit: 50, time_range: 'medium_term' }),
        ])
        topArtists = (artistsRes.data?.items || []).map((artist) => ({
          name: artist.name,
          popularity: artist.popularity,
          genres: artist.genres || [],
        }))
        topTracks = (tracksRes.data?.items || []).map((track) => ({
          title: track.name,
          artist: track.artists?.[0]?.name || '',
          release_date: track.album?.release_date || '',
          popularity: track.popularity,
          id: track.id,
        }))
        genres = [...new Set(topArtists.flatMap((artist) => artist.genres || []))].slice(0, 12)
        const trackIds = topTracks.map((track) => track.id).filter(Boolean)
        if (trackIds.length) {
          const feats = ((await spotifyAPI.getAudioFeatures(trackIds)).data?.audio_features || []).filter(Boolean)
          if (feats.length) {
            const avg = (key) => {
              const values = feats.map((item) => item?.[key]).filter((value) => value != null)
              return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
            }
            audioFeatures = {
              energy: avg('energy'),
              valence: avg('valence'),
              tempo: avg('tempo'),
              danceability: avg('danceability'),
              acousticness: avg('acousticness'),
              instrumentalness: avg('instrumentalness'),
              speechiness: avg('speechiness'),
            }
          }
        }
      } else if (lastfmConnected) {
        const artists = (await lastfmAPI.getTopArtists({ limit: 10 })).data?.topartists?.artist || []
        topArtists = artists.map((artist) => ({ name: artist.name, popularity: null, genres: [] }))
        const tagResults = await Promise.all(
          artists.slice(0, 5).map((a) => lastfmAPI.getArtistTags(a.name).catch(() => null))
        )
        genres = tagResults
          .flatMap((r) => r?.data?.toptags?.tag?.map((t) => t.name.toLowerCase()) || [])
          .filter((g, i, arr) => arr.indexOf(g) === i).slice(0, 8)
      }
    } catch { /* fall through with sparse fallback */ }
    return {
      topArtists,
      topTracks,
      genres: genres.map((genre) => ({ genre, count: 1 })),
      audioFeatures,
      audioFeaturesList: [],
      analyticsMetrics: null,
      dataQuality: {
        provider: spotifyConnected ? 'spotify' : 'lastfm',
        topArtistsCount: topArtists.length,
        topTracksCount: topTracks.length,
        genresCount: genres.length,
        audioCoverage: 0,
        hasAudioProfile: false,
        degradedReasons: ['direct_fallback_profile_used'],
      },
      confidence: {
        overall: 0,
        analytics: 0,
        identity: 0,
        galaxy: 0,
        soulmate: 0,
        labels: {
          overall: 'insufficient',
          analytics: 'insufficient',
          identity: 'low',
          galaxy: 'low',
          soulmate: 'low',
        },
      },
    }
  }, [profile, spotifyConnected, lastfmConnected])

  // ── Generate ─────────────────────────────────────────────────────────────────
  const generate = useCallback(async (offset = 0) => {
    setLoading(true)
    try {
      const profile = await buildProfile()
      profileRef.current = profile
      const res = offset === 0
        ? await aestheticAPI.get(profile)
        : await aestheticAPI.regenerate(profile, offset)
      const normalized = normalizeAestheticResponse(res?.data)
      if (!normalized.data) {
        throw new Error(normalized.warnings?.[0] || 'aesthetic payload missing')
      }
      setAesthetic(normalized.data)
      setAestheticStatus(normalized.status)
      setAestheticWarnings(normalized.warnings || [])
      setSeedOffset(offset)
      // Persist palette to global store for dynamic app theming
      if (normalized.data?.palette) {
        setAestheticState({ palette: normalized.data.palette, name: normalized.data.aesthetic_name })
      }
    } catch {
      toast.error('something slipped through the static. try again.')
    } finally {
      setLoading(false)
    }
  }, [buildProfile])

  const handleRegenerate = () => generate(seedOffset + 1)

  const handleShare = () => {
    if (navigator.share && aesthetic) {
      navigator.share({ title: aesthetic.aesthetic_name, text: aesthetic.vibe_description, url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link held close')
    }
  }

  // ── Fetch Pinterest board ─────────────────────────────────────────────────────
  const fetchPinterest = useCallback(async () => {
    if (pinterestPins || pinterestLoading) return
    setPinterestLoading(true)
    try {
      const genres = (profile?.genres || []).slice(0, 6).map((g) => typeof g === 'string' ? g : g.genre)
      const archetypes = (profile?.personality || []).map((t) => t.id)
      const res = await pinterestAPI.getAesthetic({ genres, archetypes })
      const normalized = normalizeListResponse(res?.data?.pins || res?.data || [], [])
      setPinterestPins(normalized.data)
    } catch {
      toast.error('the reference board drifted out of reach')
      setPinterestPins([])
    } finally {
      setPinterestLoading(false)
    }
  }, [profile, pinterestPins, pinterestLoading])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'pinterest' && !pinterestPins && !pinterestLoading) {
      fetchPinterest()
    }
  }

  return (
    <div className="relative min-h-screen bg-[#080b1a] text-white overflow-x-hidden">
      {aesthetic && <CosmicBackground palette={aesthetic.palette} lowPower={lowPower} />}

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="page-header-kicker mb-2">The Mood Shrine</p>
            <h1 className="page-header-title text-gradient-aurora">Atmosphere</h1>
            <p className="page-header-copy mt-3">Your listening, translated into color, texture, and late-night light.</p>
          </div>
          {aesthetic && (
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleRegenerate}
                disabled={loading}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Shape again
              </motion.button>
              <motion.button
                onClick={handleShare}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-all"
              >
                <Share2 className="w-4 h-4" /> Share this mood
              </motion.button>
            </div>
          )}
        </div>

        {aesthetic && aestheticStatus !== 'ready' && (
          <div className="mb-6 text-xs text-amber-300/80">
            This is a partial atmosphere reading. The shrine will deepen as more listening signal arrives.
          </div>
        )}

        {aestheticWarnings?.length > 0 && (
          <div className="mb-6 text-[11px] uppercase tracking-[0.22em] text-gray-500">
            {aestheticWarnings[0]}
          </div>
        )}

        {/* States */}
        {!aesthetic && !loading && <EmptyState onGenerate={() => generate(0)} loading={loading} />}

        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <VibeEmitter bpm={120} size={72} label="shaping your atmosphere..." />
          </div>
        )}

        {aesthetic && !loading && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

              {/* ── Aesthetic name hero ── */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-10 px-6 rounded-3xl relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${aesthetic.palette[0]}22, ${aesthetic.palette[2]}22)`,
                  border: `1px solid ${aesthetic.palette[1]}33`,
                }}
              >
                {/* Glow orb */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
                  style={{ backgroundColor: aesthetic.palette[2] || '#7209b7' }}
                />
                <p className="text-indigo-400 text-xs font-semibold uppercase tracking-[0.3em] mb-3 relative z-10">
                  your atmosphere
                </p>
                <motion.h2
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
                  className="text-5xl md:text-6xl font-black tracking-tight mb-5 relative z-10"
                  style={{
                    background: `linear-gradient(135deg, ${aesthetic.palette[3] || '#f72585'}, ${aesthetic.palette[1] || '#7209b7'}, ${aesthetic.palette[4] || '#4361ee'})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {aesthetic.aesthetic_name}
                </motion.h2>
                <p className="text-gray-300 text-base max-w-2xl mx-auto italic leading-relaxed relative z-10">
                  "{aesthetic.vibe_description}"
                </p>
              </motion.div>

              {/* ── Two-column: personality + palette ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <PersonalityCard personality={aesthetic.personality} />

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="p-6 rounded-2xl bg-white/3 border border-white/8 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Color weather</h3>
                  </div>
                  <ColorPalette palette={aesthetic.palette} />
                </motion.div>
              </div>

              {/* ── Aesthetic tags ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-2xl bg-white/3 border border-white/8 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Atmosphere markers</h3>
                  </div>
                  <span className="text-xs text-gray-600">Touch a marker to drift outward</span>
                </div>
                <TagPills tags={aesthetic.tags} />
              </motion.div>

              <div className="grid gap-4 md:grid-cols-3">
                <Link
                  to={`/discover${aesthetic.tags?.[0] ? `?q=${encodeURIComponent(aesthetic.tags[0])}` : ''}`}
                  className="rounded-2xl border border-white/8 bg-white/3 p-5 transition-all hover:border-brand-purple/25 hover:bg-white/[0.05]"
                >
                  <p className="section-label mb-2">Drift from here</p>
                  <p className="text-sm font-semibold text-white">Let this atmosphere pull in new signals</p>
                  <p className="mt-2 text-xs text-slate-500">Carry its strongest marker into Discover and see what wanders back.</p>
                </Link>
                <Link
                  to={`/galaxy?mode=genre${aesthetic.tags?.[0] ? `&q=${encodeURIComponent(aesthetic.tags[0])}` : ''}`}
                  className="rounded-2xl border border-white/8 bg-white/3 p-5 transition-all hover:border-brand-purple/25 hover:bg-white/[0.05]"
                >
                  <p className="section-label mb-2">See where it lives</p>
                  <p className="text-sm font-semibold text-white">Open this mood inside the galaxy</p>
                  <p className="mt-2 text-xs text-slate-500">Move from palette and texture into the regions and voices holding them.</p>
                </Link>
                <Link
                  to={`/auralith?mode=concept&prompt=${encodeURIComponent(aesthetic?.vibe_description || aesthetic?.aesthetic_name || 'soft-focus memory')}`}
                  className="rounded-2xl border border-white/8 bg-white/3 p-5 transition-all hover:border-brand-purple/25 hover:bg-white/[0.05]"
                >
                  <p className="section-label mb-2">Send it to Auralith</p>
                  <p className="text-sm font-semibold text-white">Turn this atmosphere into language or sequence</p>
                  <p className="mt-2 text-xs text-slate-500">Let the mood become a prompt while it still feels close.</p>
                </Link>
              </div>

              {/* ── Cosmic moodboard ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="p-6 rounded-2xl bg-white/3 border border-white/8 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Why it feels true</h3>
                      </div>
                      <span
                        className="text-[11px] px-2.5 py-1 rounded-full border uppercase tracking-[0.15em]"
                        style={(() => {
                          const tone = confidenceTone(aesthetic?.confidence?.label)
                          return { color: tone.text, background: tone.bg, borderColor: tone.border }
                        })()}
                      >
                        {aesthetic?.confidence?.label || 'soft signal'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed mb-4">
                      {aesthetic?.explanation || 'The atmosphere is still forming, but the outline of its gravity is visible.'}
                    </p>
                    {aesthetic.blendExplanation && (
                      <p className="text-xs text-gray-500 leading-relaxed">{aesthetic.blendExplanation}</p>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.24 }}
                    className="p-6 rounded-2xl bg-white/3 border border-white/8 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">What shaped it</h3>
                    </div>
                    <div className="space-y-3 text-sm text-gray-300">
                      {aesthetic.supportingSignals?.genreEvidence?.length > 0 && (
                        <p><span className="text-gray-500">Atmospheres:</span> {aesthetic.supportingSignals.genreEvidence.join(', ')}</p>
                      )}
                      {aesthetic.supportingSignals?.artistEvidence?.length > 0 && (
                        <p><span className="text-gray-500">Voices:</span> {aesthetic.supportingSignals.artistEvidence.join(', ')}</p>
                      )}
                      {aesthetic.supportingSignals?.audioEvidence?.length > 0 && (
                        <p><span className="text-gray-500">Signal:</span> {aesthetic.supportingSignals.audioEvidence.join(' - ')}</p>
                      )}
                      {aesthetic.eraInfluence?.dominant?.length > 0 && (
                        <p><span className="text-gray-500">Era pull:</span> {aesthetic.eraInfluence.dominant.map((item) => item.era).join(', ')}</p>
                      )}
                      {aesthetic.supportingSignals?.discoveryEvidence?.length > 0 && (
                        <p><span className="text-gray-500">Discovery drift:</span> {aesthetic.supportingSignals.discoveryEvidence.join(', ')}</p>
                      )}
                      {!hasSupportingSignals && (
                        <p className="text-gray-500">The atmosphere is still forming. Give the signal another pass and we will surface the strongest influences.</p>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Tab switcher */}
                <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-white/4 border border-white/8 w-fit">
                  {[{ id: 'board', label: 'Visual field' }, { id: 'pinterest', label: 'Reference drift' }].map((tab) => (
                    <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: activeTab === tab.id ? 'rgba(99,102,241,0.25)' : 'transparent',
                        color: activeTab === tab.id ? '#a5b4fc' : '#6b7280',
                        border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'board' && (
                  <>
                    <p className="text-xs text-gray-600 mb-4">{aesthetic.images?.length || 0} frames - move gently for parallax</p>
                    <CosmicMoodboard images={aesthetic.images || []} palette={aesthetic.palette} />
                  </>
                )}

                {activeTab === 'pinterest' && (
                  <div>
                    {pinterestLoading && (
                      <div className="flex items-center justify-center py-16">
                        <VibeEmitter bpm={120} size={56} label="pulling in distant references..." />
                      </div>
                    )}
                    {!pinterestLoading && pinterestPins?.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-12">nothing surfaced there yet -- try shaping the atmosphere again.</p>
                    )}
                    {!pinterestLoading && pinterestPins?.length > 0 && (
                      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
                        {pinterestPins.map((pin, i) => (
                          <motion.a
                            key={pin.id || i}
                            href={pin.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.04 }}
                            whileHover={{ scale: 1.03 }}
                            className="break-inside-avoid mb-3 block rounded-2xl overflow-hidden group relative cursor-pointer"
                          >
                            <img
                              src={pin.thumb || pin.image}
                              alt={pin.title}
                              className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                              <p className="text-xs text-white font-medium truncate">{pin.title}</p>
                              <p className="text-xs text-white/50 truncate">{pin.query}</p>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <ExternalLink className="w-2.5 h-2.5" />
                            </div>
                          </motion.a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
