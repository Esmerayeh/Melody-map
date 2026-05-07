import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Music2, TrendingUp, Users, Sparkles, Zap, Heart, Disc3, Radio, ExternalLink, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicSourceCard from '../components/MusicSourceCard'
import MusicIdentityPanel from '../components/MusicIdentityPanel'
import DeferredSoulOrb from '../components/DeferredSoulOrb'
import HeroScene from '../components/HeroScene'
import { getVibeName, extractPastelPalette } from '../services/vibeTheme'
import IdentityReveal from '../components/IdentityReveal'
import RouteStatusBanner from '../components/RouteStatusBanner'
import { useRouteReadiness } from '../hooks/useRouteReadiness'
import { MOTION_FLOAT, MOTION_TOKENS } from '../features/motion/motionTokens'
import ModuleBoundary from '../components/shell/ModuleBoundary'
import ShellSkeleton from '../components/shell/ShellSkeleton'
import useLiveTasteSignal from '../hooks/useLiveTasteSignal'
import AtmosphereBackground from '../components/premium/AtmosphereBackground'
import AuraCard from '../components/premium/AuraCard'
import HaloButton from '../components/premium/HaloButton'
import ShimmerDivider from '../components/premium/ShimmerDivider'
import NebulaLoader from '../components/premium/NebulaLoader'

const cleanCopy = (value = '') => value
  .replace(/\u00e2\u20ac\u201d/g, '--')
  .replace(/\u00e2\u20ac\u00a2/g, '*')
  .replace(/\u00c2\u00b7/g, '-')
  .replace(/\u00e2\u2020\u2014/g, '->')

// ── Animated SVG Radar ─────────────────────────────────────────────────────────
function AudioRadar({ features }) {
  const keys   = ['Energy', 'Valence', 'Dance', 'Acoustic', 'Tempo']
  const values = [
    features.energy       ?? 0.5,
    features.valence      ?? 0.5,
    features.danceability ?? 0.5,
    features.acousticness ?? 0.5,
    (features.tempo ?? 120) / 200,
  ]
  const cx = 90, cy = 90, r = 68
  const angles = keys.map((_, i) => (i / keys.length) * Math.PI * 2 - Math.PI / 2)
  const toXY = (angle, radius) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  const gridLevels = [0.25, 0.5, 0.75, 1.0]
  const polyPoints = values.map((v, i) => toXY(angles[i], v * r).join(',')).join(' ')

  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7C6FFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#E040FB" stopOpacity="0.1" />
        </radialGradient>
        <filter id="radarGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {gridLevels.map((level) => (
        <polygon key={level}
          points={angles.map((a) => toXY(a, level * r).join(',')).join(' ')}
          fill="none" stroke="rgba(124,111,255,0.08)" strokeWidth="1" />
      ))}
      {angles.map((a, i) => {
        const [x, y] = toXY(a, r)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(124,111,255,0.1)" strokeWidth="1" />
      })}
      <polygon points={polyPoints} fill="url(#radarFill)" stroke="#7C6FFF" strokeWidth="1.5" filter="url(#radarGlow)" />
      {values.map((v, i) => {
        const [x, y] = toXY(angles[i], v * r)
        return <circle key={i} cx={x} cy={y} r="3" fill="#7C6FFF" style={{ filter: 'drop-shadow(0 0 4px #7C6FFF)' }} />
      })}
      {keys.map((key, i) => {
        const [x, y] = toXY(angles[i], r + 16)
        return (
          <text key={key} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(148,163,184,0.7)" fontSize="9" fontFamily="Inter, sans-serif">{key}</text>
        )
      })}
    </svg>
  )
}

// ── Tilt card wrapper ──────────────────────────────────────────────────────────
function TiltCard({ children, className = '' }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [MOTION_FLOAT.hero.tilt, -MOTION_FLOAT.hero.tilt]), { stiffness: 140, damping: 24, mass: 0.8 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-MOTION_FLOAT.hero.tilt, MOTION_FLOAT.hero.tilt]), { stiffness: 140, damping: 24, mass: 0.8 })

  const handleMouse = (e) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  const reset = () => { x.set(0); y.set(0) }

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      animate={{ y: [0, -MOTION_FLOAT.hero.amplitude * 0.28, 0] }}
      transition={MOTION_TOKENS.heroFloat}
      onMouseMove={handleMouse} onMouseLeave={reset}
      className={`dimensional-surface ${className}`}>
      {children}
    </motion.div>
  )
}

// ── Stat orb ──────────────────────────────────────────────────────────────────
function StatOrb({ icon: Icon, label, value, color, delay = 0 }) {
  const normalizedValue = value == null ? '' : String(value)
  const displayValue = normalizedValue === '--' || normalizedValue.includes('\u00e2') || normalizedValue.includes('\u2014')
    ? 'soft signal'
    : value
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...MOTION_TOKENS.focusSettle, delay }}
      whileHover={{ y: -3, scale: 1.015, rotateX: 1.2, rotateY: -1 }}
      className="dimensional-surface relative overflow-hidden rounded-[24px] p-5 flex items-center gap-4 cursor-default glass-card"
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 md:hover:opacity-100"
        style={{ background: `radial-gradient(ellipse at 30% 50%, ${color}15 0%, transparent 70%)` }} />
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative"
        style={{ background: `${color}18`, border: `1px solid ${color}30`, boxShadow: `0 0 20px ${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="relative z-10">
        <p className="text-2xl font-black text-white">{displayValue}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

// ── Artist chip ────────────────────────────────────────────────────────────────
function ArtistChip({ artist, rank }) {
  return (
    <motion.a
      href={artist.spotify_url || '#'} target="_blank" rel="noopener noreferrer"
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05, type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ x: 4 }}
      className="flex items-center gap-3 p-3 rounded-xl transition-all group"
      style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}
    >
      <div className="relative shrink-0">
        {artist.image
          ? <img src={artist.image} alt={artist.name} className="w-10 h-10 rounded-full object-cover" />
          : <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300">{rank + 1}</div>
        }
          <div className="absolute inset-0 rounded-full opacity-0 transition-opacity md:group-hover:opacity-100"
            style={{ boxShadow: '0 0 12px rgba(124,111,255,0.5)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate md:group-hover:text-indigo-300 transition-colors">{artist.name}</p>
          <p className="text-xs text-gray-600 truncate">{artist.genres?.[0] || 'Artist'}</p>
        </div>
      <ExternalLink className="w-3.5 h-3.5 text-gray-500 md:text-gray-700 md:group-hover:text-gray-400 shrink-0 transition-colors" />
    </motion.a>
  )
}

// ── Track row ──────────────────────────────────────────────────────────────────
function TrackRow({ track, rank }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      whileHover={{ x: 3 }}
      className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0 group cursor-default"
    >
      <span className="text-xs text-gray-700 w-5 text-center shrink-0 font-mono">{rank + 1}</span>
      {track.album_art
        ? <img src={track.album_art} alt={track.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />
        : <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0"><Music2 className="w-4 h-4 text-gray-600" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-gray-600 truncate">{track.artist}</p>
      </div>
      {track.spotify_url && (
          <a href={track.spotify_url} target="_blank" rel="noopener noreferrer"
            className="touch-reveal opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs text-green-400 shrink-0">{'->'}</a>
      )}
    </motion.div>
  )
}

// ── Identity card ──────────────────────────────────────────────────────────────
function IdentityCard({ metrics, genres }) {
  if (!metrics) return null
  const e = metrics.energyScore != null ? metrics.energyScore / 100 : null
  const v = metrics.valenceScore != null ? metrics.valenceScore / 100 : null
  const genreStr = genres.map((g) => g.genre).join(' ')

  let personality = 'Sonic Explorer'
  let description = 'Your taste defies categories -- you roam freely across genres, moods, and eras.'
  let traits = ['eclectic', 'open-minded']
  let accentColor = '#7C6FFF'

  if (e != null && v != null && e < 0.45 && v < 0.45) {
    personality = 'Nocturnal Dreamer'; accentColor = '#60a5fa'
    description = 'You gravitate toward atmospheric soundscapes, nostalgic melodies, and late-night music.'
    traits = ['introspective', 'atmospheric', 'nocturnal']
  } else if (e != null && e > 0.65 && metrics.tempoAvg != null && metrics.tempoAvg > 120) {
    personality = 'Electric Wanderer'; accentColor = '#FBBF24'
    description = 'You chase energy and movement -- your music is kinetic, charged, and always in motion.'
    traits = ['energetic', 'restless', 'adventurous']
  } else if (v != null && e != null && v > 0.6 && e < 0.55) {
    personality = 'Velvet Romantic'; accentColor = '#f472b6'
    description = 'Warm, soulful, and deeply emotional -- you feel music in your chest.'
    traits = ['emotional', 'warm', 'soulful']
  } else if (genreStr.includes('electronic') || genreStr.includes('techno')) {
    personality = 'Neon Architect'; accentColor = '#00D1FF'
    description = 'You build worlds with sound -- electronic, precise, and futuristic.'
    traits = ['analytical', 'futuristic', 'precise']
  } else if (genreStr.includes('indie') || genreStr.includes('folk')) {
    personality = 'Golden Nostalgist'; accentColor = '#FBBF24'
    description = 'You live in warm memories -- your music smells like old film and summer afternoons.'
    traits = ['nostalgic', 'warm', 'reflective']
  }

  return (
    <TiltCard className="h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="noire-panel p-6 rounded-[28px] h-full relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}10, rgba(0,0,0,0.3))`, border: `1px solid ${accentColor}25` }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ background: `${accentColor}15` }} />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl pointer-events-none"
          style={{ background: `${accentColor}08` }} />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-2 relative z-10"
          style={{ color: accentColor }}>Your Music Identity</p>
        <h2 className="text-3xl font-black text-white mb-3 relative z-10"
          style={{ textShadow: `0 0 40px ${accentColor}40` }}>{personality}</h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-5 relative z-10">{cleanCopy(description)}</p>
        <div className="flex flex-wrap gap-2 relative z-10">
          {traits.map((t) => (
            <span key={t} className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>{t}</span>
          ))}
        </div>
      </motion.div>
    </TiltCard>
  )
}

// ── Feature nav cards ──────────────────────────────────────────────────────────
const NAV_CARDS = [
  { to: '/galaxy',    icon: Disc3,    label: 'Music Galaxy',    desc: '3D taste universe',         from: '#6366f1', to2: '#8b5cf6' },
  { to: '/discover',  icon: Radio,    label: 'Sonic Echoes',    desc: 'signals drifting your way', from: '#ec4899', to2: '#f43f5e' },
  { to: '/soulmates', icon: Heart,    label: 'Music Soulmate',  desc: 'see where your worlds meet', from: '#a855f7', to2: '#7c3aed' },
  { to: '/aesthetic', icon: Sparkles, label: 'Aesthetic Board', desc: 'the atmosphere you live in', from: '#f59e0b', to2: '#ef4444' },
  { to: '/identity',  icon: Sparkles, label: 'Inner Music Self', desc: 'Follow the full reading',  from: '#38bdf8', to2: '#6366f1' },
]

const TIME_RANGES = [
  { value: 'short_term',  label: '4 Weeks' },
  { value: 'medium_term', label: '6 Months' },
  { value: 'long_term',   label: 'All Time' },
]

export default function Dashboard() {
  const spotifyConnected     = useStore((s) => s.spotifyConnected)
  const lastfmConnected      = useStore((s) => s.lastfmConnected)
  const username             = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'there')
  const setTimeRange         = useStore((s) => s.setMusicProfileTimeRange)
  const isConnected          = spotifyConnected || lastfmConnected

  const { profile, loading, error, refetch, timeRange, confidence, dataQuality, phase, readiness, tier } = useMusicProfile()
  const { signal: liveSignal } = useLiveTasteSignal({ enabled: Boolean(isConnected), pollMs: 12000 })

  const [showReveal, setShowReveal] = useState(false)

  const features = profile?.audioFeatures || {}
  const artists  = profile?.topArtists    || []
  const tracks   = profile?.topTracks     || []
  const genres   = profile?.genres        || []
  const metrics  = profile?.analyticsMetrics || null
  const liveTrack = liveSignal?.recentEvents?.[0] || null
  const orbAudioFeatures = liveTrack?.audio_features || profile?.audioFeatures || {}
  const analyticsConfidence = confidence?.labels?.analytics || metrics?.metricConfidence?.energyScore?.label || 'soft signal'
  const identityConfidence = profile?.personalityMeta?.confidence != null
    ? profile.personalityMeta.confidence >= 0.8
      ? 'high'
      : profile.personalityMeta.confidence >= 0.5
        ? 'medium'
        : profile.personalityMeta.confidence > 0
          ? 'low'
          : 'soft signal'
    : confidence?.labels?.identity || 'soft signal'

  // Extract pastel palette from album art and apply as CSS custom properties
  const [pastelPalette, setPastelPalette] = useState([])
  useEffect(() => {
    if (!tracks.length) return
    const imageUrls = tracks.map((t) => t.album_art).filter(Boolean)
    extractPastelPalette(imageUrls, 5).then((colors) => {
      setPastelPalette(colors)
      const root = document.documentElement
      colors.forEach((color, i) => root.style.setProperty(`--pastel-${i}`, color))
    })
  }, [tracks])

  const boot = useRouteReadiness({
    phase,
    profile: isConnected ? profile : null,
    readiness,
    tier,
    require: { profile: true },
    copy: {
      loading: {
        title: 'The observatory is tuning in.',
        subtitle: 'We are gathering your listening signal before the room fills in.',
        detail: 'Hold steady.',
      },
      error: {
        title: 'The observatory could not read your signal.',
        subtitle: 'The listening data is not reachable right now.',
        detail: 'Refresh once and the room should return.',
      },
      empty: {
        title: 'The observatory is still quiet.',
        subtitle: 'Your listening signal has not settled into a full profile yet.',
        detail: 'Try syncing again in a moment.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'We are rendering a lighter observatory until the profile deepens.',
        detail: 'This is intentional, not an error.',
      },
    },
  })

  return (
    <div className="cosmic-page">
      {/* Hero greeting */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        transition={MOTION_TOKENS.focusSettle} className="mb-8">
        <div className="dimensional-surface relative noire-panel rounded-[36px] overflow-hidden mb-3 min-h-[280px]">
          <AtmosphereBackground variant="default" intensity="rich" anchored />
          {/* 3D floating objects */}
          {features.energy != null && (
            <HeroScene energy={features.energy} valence={features.valence ?? 0.5} height={160} />
          )}
          <div className="relative z-10 grid gap-8 p-6 lg:grid-cols-[minmax(0,1.18fr)_320px] lg:p-8">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className="premium-kicker mb-3">The Observatory</p>
                <h1 className="premium-hero-title max-w-4xl">
                  Your music is more than taste.
                  <span className="mt-2 block text-gradient-aurora">It is memory, atmosphere, longing, motion, identity.</span>
                </h1>
                <p className="premium-body mt-5 max-w-2xl">
                  {features.energy != null
                    ? <>Right now the room leans toward <span className="font-semibold text-gradient-aurora">{getVibeName(features.energy, features.valence)}</span>, and every surface is calibrating itself around that weather.</>
                    : 'The room is awake and listening, even before your full profile settles into focus.'}
                </p>
                {liveTrack?.title ? (
                  <p className="mt-4 text-sm text-cyan-200">
                    Now shaping the field: {liveTrack.title} by {liveTrack.artist}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <HaloButton to="/identity" variant="primary" icon={Sparkles}>
                  Enter the full reading
                </HaloButton>
                <HaloButton to="/galaxy" variant="secondary" icon={Disc3}>
                  Open the galaxy
                </HaloButton>
              </div>
            </div>

            <AuraCard accent="lavender" className="relative z-10 p-5 lg:p-6" glow interactive>
              <p className="section-label mb-2">Current presence</p>
              <p className="text-sm leading-relaxed text-slate-300">
                Hey, {username}. This is the pulse beneath the rest of the interface.
              </p>
              <ShimmerDivider className="my-4" />
              {features.energy != null ? (
                <div className="floating-orb flex items-center justify-center">
                  <DeferredSoulOrb
                    personality={profile?.personality}
                    personalityMeta={profile?.personalityMeta}
                    mbti={profile?.mbti}
                    mbtiMeta={profile?.mbtiMeta}
                    audioFeatures={orbAudioFeatures}
                    analyticsMetrics={profile?.analyticsMetrics}
                    confidence={profile?.confidence}
                    dataQuality={profile?.dataQuality}
                    genres={profile?.genres}
                    topArtists={profile?.topArtists}
                    size={148}
                    showLabels={false}
                    lowPower={tier === 'sparse' || tier === 'limited'}
                  />
                </div>
              ) : (
                <NebulaLoader compact label="Listening for your orbit" detail="The orb wakes when your signal settles." />
              )}
            </AuraCard>
          </div>
        </div>
        {/* Time range selector */}
        {isConnected && (
          <div className="mobile-scroll-row flex w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:w-fit noire-panel-soft">
            {TIME_RANGES.map(({ value, label }) => (
              <motion.button
                key={value}
                onClick={() => setTimeRange(value)}
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                transition={timeRange === value ? MOTION_TOKENS.focusSettle : MOTION_TOKENS.chip}
                className="dimensional-chip px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200"
                style={timeRange === value
                  ? { background: 'rgba(143,117,255,0.2)', color: '#e3dbff', border: '1px solid rgba(143,117,255,0.26)', boxShadow: '0 0 18px rgba(143,117,255,0.12)' }
                  : { color: 'rgba(196,185,226,0.58)' }}>
                {label}
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {isConnected && boot.variant !== 'ready' && (
        <div className="mb-6">
          <RouteStatusBanner
            variant={boot.variant}
            title={boot.title}
            subtitle={boot.subtitle}
            detail={boot.detail}
          />
        </div>
      )}

      {!isConnected && (
        <div className="max-w-lg">
          <p className="text-gray-400 text-sm mb-4">Connect a music source and the room begins to fill in.</p>
          <MusicSourceCard />
        </div>
      )}

      {isConnected && loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <AuraCard key={index} className="p-5" accent="silver">
              <NebulaLoader compact label="Rendering the room" detail="Gathering the next visible layer." />
            </AuraCard>
          ))}
        </motion.div>
      )}

      {isConnected && error && (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-3">something slipped through the static.</p>
          <button onClick={refetch} className="text-sm text-indigo-400 hover:text-indigo-300">Try again</button>
        </div>
      )}

      {isConnected && !loading && profile && (
        <div className="space-y-6">
          {profile?.isDegraded && (
            <div className="flex flex-wrap gap-2 text-[11px] text-amber-300/80">
              <span>partial signal</span>
              <span>-</span>
              <span>
                {dataQuality?.degradedReasons?.[0] === 'spotify_audio_features_unavailable'
                  ? 'Spotify audio features are unavailable, so the deeper read stays quiet instead of pretending.'
                  : 'Some listening inputs are still thin, so this reading stays gentle with certainty.'}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <span>{dataQuality?.topTracksCount || tracks.length || 0} tracks in reach</span>
            <span>-</span>
            <span>{dataQuality?.audioFeaturesCount || 0}/{dataQuality?.audioFeaturesRequested || 0} tracks carried a deep signal</span>
            <span>-</span>
            <span>signal reading: {analyticsConfidence}</span>
            <span>-</span>
            <span>inner reading: {identityConfidence}</span>
          </div>

          <ModuleBoundary
            title="Signal summary"
            loading={loading && !profile}
            degraded={Boolean(profile?.isDegraded)}
            fallback={<ShellSkeleton lines={4} />}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatOrb icon={Users}      label="Voices you orbit"  value={artists.length || '--'} color={pastelPalette[0] || '#7C6FFF'} delay={0} />
              <StatOrb icon={Music2}     label="Songs in reach"   value={tracks.length  || '--'} color={pastelPalette[1] || '#FF5DA2'} delay={0.05} />
              <StatOrb icon={TrendingUp} label="Atmospheres held" value={genres.length  || '--'} color={pastelPalette[2] || '#34D399'} delay={0.1} />
              <StatOrb icon={Zap}        label="Current intensity"   value={metrics?.energyScore != null ? `${metrics.energyScore}%` : 'soft signal'} color={pastelPalette[3] || '#FBBF24'} delay={0.15} />
            </div>
          </ModuleBoundary>

          {/* Identity + radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <IdentityCard metrics={metrics} genres={genres} />
            </div>
            {Object.keys(features).length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ ...MOTION_TOKENS.focusSettle, delay: 0.2 }}
                className="dimensional-surface noire-panel p-5 rounded-[28px] flex flex-col items-center justify-center"
              >
                <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mb-3">Sonic shape</p>
                <AudioRadar features={features} />
              </motion.div>
            )}
          </div>

          {/* DNA report */}
          {liveTrack?.title && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="noire-panel p-5 rounded-[28px] border border-cyan-400/15">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200 mb-2">Live listening sync</p>
              <p className="text-sm font-semibold text-white">{liveTrack.title} by {liveTrack.artist}</p>
              <p className="mt-2 text-xs text-slate-500">The Soul Orb is leaning into the current track audio signature while the session is active.</p>
            </motion.div>
          )}

          {/* DNA report */}
          {metrics && profile?.canComputeAnalytics && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="noire-panel p-6 rounded-[28px] relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(0,209,255,0.04), rgba(224,64,251,0.04))', border: '1px solid rgba(0,209,255,0.1)' }}
            >
              <div className="absolute inset-0 opacity-30"
                style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(224,64,251,0.08) 0%, transparent 60%)' }} />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neon-cyan mb-4 relative z-10">Signal reading</p>
              <div className="flex flex-wrap gap-2 relative z-10">
                {[
                  metrics?.energyScore != null ? { label: `${metrics.energyScore}% Energy`, color: '#FBBF24' } : null,
                  metrics?.valenceScore != null ? { label: `${metrics.valenceScore}% Valence`, color: '#E040FB' } : null,
                  metrics?.tempoAvg != null ? { label: `${metrics.tempoAvg} BPM`, color: '#00D1FF' } : null,
                  metrics?.danceabilityScore != null ? { label: `${metrics.danceabilityScore}% Dance`, color: '#7C6FFF' } : null,
                  metrics?.nostalgiaIndex != null ? { label: `${metrics.nostalgiaIndex}% Nostalgia`, color: '#f472b6' } : null,
                  metrics?.diversityScore != null ? { label: `${metrics.diversityScore}% Diversity`, color: '#34D399' } : null,
                ].filter(Boolean).map(({ label, color }, i) => (
                  <motion.span key={label}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="text-xs px-3 py-1.5 rounded-full border font-mono"
                    style={{ borderColor: `${color}30`, color, background: `${color}10`, boxShadow: `0 0 12px ${color}15` }}>
                    {label}
                  </motion.span>
                ))}
              </div>
              <p className="text-gray-400 text-sm mt-4 relative z-10">
                Mood: <span className="text-white font-medium capitalize">{metrics.mood || 'soft signal'}</span>
                {metrics.sonicBrightness != null && <> / Brightness: <span className="text-white font-medium">{metrics.sonicBrightness}%</span></>}
              </p>
              <p className="text-[11px] text-gray-500 mt-2 relative z-10">
                {metrics.sampleSizes?.energyScore != null && <>Intensity drawn from {metrics.sampleSizes.energyScore} tracks</>}
                {metrics.sampleSizes?.sonicBrightness != null && <> / brightness drawn from {metrics.sampleSizes.sonicBrightness} tracks</>}
                {metrics.sampleSizes?.nostalgiaIndex != null && <> / nostalgia traced through {metrics.sampleSizes.nostalgiaIndex} release dates</>}
              </p>
            </motion.div>
          )}

          {/* Music Identity panel */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-600 uppercase tracking-[0.2em]">Inner music self</p>
              <div className="flex items-center gap-2">
                <HaloButton to="/identity" variant="cyan" icon={Sparkles} className="px-4 py-2 text-[10px]">
                  Enter the full reading
                </HaloButton>
                {profile?.mbti && profile?.personality?.length > 0 && (
                  <motion.button
                    onClick={() => setShowReveal(true)}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={MOTION_TOKENS.chip}
                    className="dimensional-chip flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))', border: '1px solid rgba(99,102,241,0.35)', boxShadow: '0 0 16px rgba(99,102,241,0.15)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Let it flare open
                  </motion.button>
                )}
              </div>
            </div>
            <MusicIdentityPanel profile={profile} />
          </div>

          {/* Genre pills */}
          {genres.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <AuraCard className="p-5" accent="rose">
              <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mb-3">The atmospheres you return to</p>
              <div className="flex flex-wrap gap-2">
                {genres.slice(0, 12).map((g, i) => (
                  <motion.span key={g.genre}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.03, y: -1 }}
                    className="dimensional-chip px-3 py-1.5 rounded-full text-sm cursor-default"
                    style={{ background: 'rgba(124,111,255,0.1)', color: '#a5b4fc', border: '1px solid rgba(124,111,255,0.2)' }}
                  >{g.genre}</motion.span>
                ))}
              </div>
              </AuraCard>
            </motion.div>
          )}

          {/* Artists + Tracks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {artists.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 28 }}>
                <AuraCard className="p-5" accent="lavender" interactive>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-200">The voices you orbit</p>
                  <HaloButton to="/analytics" variant="secondary" className="px-3 py-2 text-[10px]">Drift deeper</HaloButton>
                </div>
                <div className="space-y-1">
                  {artists.slice(0, 5).map((a, i) => <ArtistChip key={a.id || a.name} artist={a} rank={i} />)}
                </div>
                </AuraCard>
              </motion.div>
            )}

            {tracks.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 28 }}>
                <AuraCard className="p-5" accent="rose" interactive>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-200">Songs closest to hand</p>
                  <HaloButton to="/discover" variant="secondary" className="px-3 py-2 text-[10px]">Keep drifting</HaloButton>
                </div>
                <div>
                  {tracks.slice(0, 8).map((t, i) => <TrackRow key={t.id || t.title + i} track={t} rank={i} />)}
                </div>
                </AuraCard>
              </motion.div>
            )}
          </div>

          {/* Feature nav */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <p className="text-xs text-gray-600 uppercase tracking-[0.2em] mb-3">Ways in</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {NAV_CARDS.map(({ to, icon: Icon, label, desc, from, to2 }, i) => (
                <motion.div key={to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ ...MOTION_TOKENS.focusSettle, delay: 0.5 + i * 0.06 }}>
                  <TiltCard>
                    <Link to={to} className="dimensional-surface aura-card aura-interactive block p-4 rounded-[24px] relative overflow-hidden group"
                      style={{ background: `linear-gradient(135deg, ${from}15, ${to2}08)`, border: `1px solid ${from}25` }}>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `linear-gradient(135deg, ${from}20, ${to2}12)` }} />
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 relative z-10"
                        style={{ background: `${from}20`, border: `1px solid ${from}30` }}>
                        <Icon className="w-4.5 h-4.5" style={{ color: from }} />
                      </div>
                      <p className="font-semibold text-sm text-white relative z-10">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 relative z-10">{cleanCopy(desc)}</p>
                    </Link>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="flex justify-end">
            <button onClick={refetch} disabled={loading}
              className="halo-button halo-secondary flex items-center gap-1.5 px-4 py-2 text-[10px] text-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Tune again
            </button>
          </div>
        </div>
      )}

      {/* Identity Reveal modal */}
      <AnimatePresence>
        {showReveal && profile?.mbti && profile?.personality?.length > 0 && (
          <IdentityReveal
            mbti={profile.mbti}
            personality={profile.personality}
            profile={profile}
            onClose={() => setShowReveal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
