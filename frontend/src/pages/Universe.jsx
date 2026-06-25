/**
 * Universe.jsx
 * ------------
 * The flagship spatial experience.  The Galaxy becomes the primary interface.
 * Feature portals (Identity, Discover, Soulmate, Aesthetic, Auralith, Analytics)
 * are HUD overlays and sector labels — not separate nav cards.
 *
 * Architecture:
 *   UniverseCanvas    — full-screen GalaxyScene + GalaxyLivingLayer
 *   UniverseHUD       — floating info panels, mode controls, Soul Orb dock
 *   SectorPortals     — contextual entry points into deeper pages
 *   UniverseNav       — minimal navigation ring at the bottom
 *
 * Route: /universe  (ProtectedRoute in App.jsx)
 * The single galaxy home. The old /galaxy route is retired and redirects here
 * (preserving ?mode=/?q= deep links); "Galaxy" is now a lens within /universe.
 *
 * Sprint: PRESENCE + TRAVERSAL
 *   - useUniversePresence: sleep/wake/idle/active HUD opacity + drift speed
 *   - activePanel: only one contextual panel at a time
 *   - live signal: 7s poll while /universe is active, Soul Orb pulse, ripple
 *   - traversal: WASD / Space / R / F / T wired through GalaxyScene
 *   - sector travel: SectorPortal blocks all other contextual panels
 *   - Universe Event Feed: quiet signal log, top-right
 *   - NowPlayingRipple: CSS ring on track change
 *   - mobile: single bottom sheet for contextual panels
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Disc3, Heart, Maximize2, Minimize2,
  Radio, Sparkles, Zap, X,
} from 'lucide-react'
import useMusicProfile         from '../hooks/useMusicProfile'
import useLiveTasteSignal      from '../hooks/useLiveTasteSignal'
import useAdaptiveExperience   from '../hooks/useAdaptiveExperience'
import useUniversePresence     from '../hooks/useUniversePresence'
import useGalaxyInteractionStore from '../features/galaxy/useGalaxyInteractionStore'
import { useGalaxyStageConfig } from '../features/galaxy/useGalaxyStage'
import GalaxyTraversalHUD from '../features/galaxy/GalaxyTraversalHUD'
import CinematicTour from '../features/galaxy/CinematicTour'
import { buildGalaxyModel, buildGalaxyModeModel } from '../features/galaxy/galaxyBuilder'
import useGalaxyArtifact        from '../features/galaxy/useGalaxyArtifact'
import { resolveInteractionEntity, slugifyInteraction } from '../features/galaxy/interactionModel'
import { mapGalaxySelectionToResonance } from '../features/orb/resonanceEngine'
import useStore                from '../store/useStore'
import DeferredSoulOrb         from '../components/DeferredSoulOrb'
import NebulaLoader              from '../components/premium/NebulaLoader'
import GenesisSequence           from '../features/universe/GenesisSequence'
import AuralithNodeExplainer     from '../features/universe/AuralithNodeExplainer'
import { CometLayer, CometDecodeOverlay, useDiscoveryComets } from '../features/universe/DiscoveryComets'
import { GhostConstellationLines, MemoryBeltPanel, useMemoryBelt } from '../features/universe/MemoryBelt'
import { ObsessionGravityWell, useObsessionNode } from '../features/universe/ObsessionWell'
import useArtistTimelines, { applyTimelineClassifications } from '../hooks/useArtistTimelines'
import { IdentityPassportModal }  from '../features/universe/IdentityPassport'
import SemanticLegend             from '../features/universe/SemanticLegend'
import UniverseEventFeed          from '../features/universe/UniverseEventFeed'
import NowPlayingRipple           from '../features/universe/NowPlayingRipple'
import { emitUniverseEvent, EVENT_TYPES } from '../features/universe/useUniverseEvents'
import { MOTION_TOKENS }       from '../features/motion/motionTokens'

const GalaxyControls    = lazy(() => import('../features/galaxy/GalaxyControls'))
const GalaxyInspector   = lazy(() => import('../features/galaxy/GalaxyInspector'))
const GalaxyLegend      = lazy(() => import('../features/galaxy/GalaxyLegend'))

// ─────────────────────────────────────────────────────────────────────────────
// Sector portals — feature entry points shown as HUD overlays
// ─────────────────────────────────────────────────────────────────────────────
const SECTORS = [
  { id: 'identity',  to: '/identity',  label: 'Identity Passport',    icon: Sparkles, color: '#de83b4', desc: 'Your music archetype and constellation.' },
  { id: 'discover',  to: '/discover',  label: 'Discovery Comets',     icon: Radio,    color: '#ac6294', desc: 'New signals arriving from the outer rim.' },
  { id: 'soulmate',  to: '/soulmate',  label: 'Twin Galaxy',          icon: Heart,    color: '#d15296', desc: 'Where your universe meets another.' },
  { id: 'aesthetic', to: '/aesthetic', label: 'Aesthetic Nebula',     icon: Zap,      color: '#d15296', desc: 'The visual atmosphere of your taste.' },
  { id: 'auralith',  to: '/auralith',  label: 'Auralith Observatory', icon: Brain,    color: '#e1a7c6', desc: 'Ask the oracle what your galaxy means.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// activePanel values (mutual exclusion)
// ─────────────────────────────────────────────────────────────────────────────
const PANELS = {
  NONE:      null,
  INSPECTOR: 'inspector',
  COMET:     'comet',
  MEMORY:    'memory',
  PASSPORT:  'passport',
  SECTOR:    'sector',
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD components
// ─────────────────────────────────────────────────────────────────────────────

function SoulOrbDock({ profile, resonance, sparseGraphics, liveIntensity, premium = false }) {
  const [expanded, setExpanded] = useState(false)

  // Pulse size reacts to live session intensity (0–1)
  const liveSize = expanded ? 220 : 88 + Math.round((liveIntensity || 0) * 12)

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...MOTION_TOKENS.panel, delay: 0.5 }}
      className={`absolute right-4 z-20 flex flex-col items-end ${premium ? 'top-52 gap-4' : 'top-52 gap-3'}`}
    >
      {/* role=button (not <button>) on purpose: MusicSoulOrb renders its own
          <button> inside, and a button nested in a button is invalid DOM. This
          keeps the click-to-expand + keyboard a11y without the nesting. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v) } }}
        className={premium
          ? 'pointer-events-auto rounded-full p-1 transition'
          : 'pointer-events-auto rounded-full border border-white/12 bg-[#0a0c1e]/80 p-1 backdrop-blur transition hover:border-white/24'}
        aria-label={expanded ? 'Collapse Soul Orb' : 'Expand Soul Orb'}
        style={{
          boxShadow: !premium && liveIntensity > 0.3 ? `0 0 ${Math.round(liveIntensity * 24)}px rgba(172,98,148,0.18)` : undefined,
        }}
      >
        <DeferredSoulOrb
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
          resonance={resonance}
          size={liveSize}
          showLabels={expanded}
          lowPower={sparseGraphics}
        />
      </div>
      {expanded && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={premium
            ? 'max-w-[200px] text-right text-[11px] leading-relaxed text-[#f4e6ee]/35'
            : 'max-w-[180px] text-right text-[10px] leading-relaxed text-gray-500'}
        >
          {resonance?.explanation || 'Your soul orb holds the shape of what returns most often.'}
        </motion.p>
      )}
    </motion.div>
  )
}

function SectorPortal({ sector, onClose, premium = false }) {
  const navigate = useNavigate()
  return (
    <motion.div
      key={sector.id}
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={MOTION_TOKENS.focusSettle}
      className={`pointer-events-auto absolute bottom-24 left-1/2 z-30 -translate-x-1/2 ${premium ? 'w-[min(92vw,420px)]' : 'w-[min(90vw,380px)]'}`}
    >
      {premium ? (
        /* PREMIUM: no card, no nested boxes — content floats on the galaxy. One
           confident serif heading; everything else small + dim; generous space. */
        <div className="relative px-6 py-2">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-0 flex h-9 w-9 items-center justify-center rounded-full text-[#f4e6ee]/40 transition-colors hover:text-[#f4e6ee]/90 min-h-[44px] min-w-[44px]"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#f4e6ee]/30">Sector</p>
          <h3 className="font-display mt-3 text-3xl font-medium leading-tight text-[#f4e6ee]/95">{sector.label}</h3>
          <p className="mt-3 max-w-[300px] text-[12px] leading-relaxed text-[#f4e6ee]/40">{sector.desc}</p>
          <button
            type="button"
            onClick={() => navigate(sector.to)}
            className="mt-7 inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#f4e6ee]/80 transition-colors hover:text-[#f4e6ee] min-h-[44px]"
          >
            Enter {sector.label} →
          </button>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-xl"
          style={{
            borderColor: `${sector.color}30`,
            background:  `linear-gradient(135deg, rgba(10,11,26,0.92), rgba(10,11,26,0.88))`,
            boxShadow:   `0 0 60px ${sector.color}14`,
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20"
            style={{ background: `radial-gradient(circle at 20% 20%, ${sector.color}28, transparent 55%)` }} />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-xl p-2" style={{ background: `${sector.color}18` }}>
                  <sector.icon className="h-4 w-4" style={{ color: sector.color }} />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Sector portal</p>
              </div>
              <h3 className="text-lg font-black text-white">{sector.label}</h3>
              <p className="mt-1 text-sm text-gray-400">{sector.desc}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/10 p-1.5 text-gray-500 transition-colors hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate(sector.to)}
            className="relative z-10 mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 min-h-[44px]"
            style={{ background: `linear-gradient(135deg, ${sector.color}44, ${sector.color}22)`, border: `1px solid ${sector.color}40` }}
          >
            Enter {sector.label}
          </button>
        </div>
      )}
    </motion.div>
  )
}

/** Desktop: icon ring at bottom. Mobile: scrollable carousel. */
function SectorRing({ sectors, onSelect, activeSectorId, isMobile, premium = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_TOKENS.panel, delay: 0.4 }}
      className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
    >
      <div
        className={`flex items-center gap-2 rounded-full border border-[#c1337f]/25 bg-[#301725]/82 px-3 py-2 backdrop-blur-xl ${isMobile ? 'overflow-x-auto max-w-[90vw]' : ''}`}
        style={isMobile ? { WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' } : undefined}
      >
        {sectors.map((sector) => (
          <button
            key={sector.id}
            type="button"
            onClick={() => onSelect(sector)}
            title={sector.label}
            aria-pressed={activeSectorId === sector.id}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all hover:scale-110"
            style={{
              // Dark plum button so the coloured icon reads against the bright
              // nebula (the old ~9%-opacity coloured fill made them near-invisible).
              background: activeSectorId === sector.id ? `${sector.color}55` : 'rgba(48,23,37,0.66)',
              border:     `1px solid ${activeSectorId === sector.id ? sector.color : sector.color + '88'}`,
              scrollSnapAlign: 'center',
            }}
          >
            <sector.icon className="h-[18px] w-[18px]" style={{ color: activeSectorId === sector.id ? '#faf5f8' : sector.color, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
          </button>
        ))}
        <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
        <Link
          to="/"
          title="Dashboard"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c1337f]/30 bg-[#301725]/66 transition-all hover:bg-[#51203a]/70"
        >
          <Disc3 className="h-[18px] w-[18px] text-[#ebccdc]" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
        </Link>
      </div>
    </motion.div>
  )
}

function UniverseTopBar({ title, subtitle, cinemaMode, onToggleCinema, onOpenPassport, premium = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION_TOKENS.panel}
      className={`absolute left-4 right-4 top-4 z-20 flex justify-between ${premium ? 'items-start' : 'items-center'}`}
    >
      <div>
        <p className={premium
          ? 'text-[10px] uppercase tracking-[0.28em] text-[#f4e6ee]/35'
          : 'text-[10px] uppercase tracking-[0.24em] text-gray-600'}>Universe</p>
        {premium ? (
          <h1 className="font-display mt-1.5 text-3xl font-medium leading-[1.05] text-[#f4e6ee]/95 sm:text-4xl">{title}</h1>
        ) : (
          <p className="text-sm font-semibold text-white">{title}</p>
        )}
        {subtitle && (
          <p className={premium
            ? 'mt-2 max-w-md text-[11px] leading-relaxed text-[#f4e6ee]/35'
            : 'mt-0.5 text-[10px] text-gray-500'}>{subtitle}</p>
        )}
      </div>
      <div className={`pointer-events-auto flex items-center ${premium ? 'gap-3' : 'gap-2'}`}>
        <button
          type="button"
          onClick={onOpenPassport}
          className={premium
            ? 'flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] tracking-[0.08em] text-[#f4e6ee]/55 transition hover:text-[#f4e6ee]/90 min-h-[44px]'
            : 'flex h-9 items-center gap-1.5 rounded-full border border-[#c1337f]/24 bg-[#c1337f]/10 px-3 text-[11px] text-[#c1337f]/80 backdrop-blur transition hover:bg-[#c1337f]/18 min-h-[44px]'}
          title="Export Universe Passport"
        >
          Passport
        </button>
        <button
          type="button"
          onClick={onToggleCinema}
          className={premium
            ? 'flex h-9 w-9 items-center justify-center rounded-full text-[#f4e6ee]/45 transition hover:text-[#f4e6ee]/90 min-h-[44px] min-w-[44px]'
            : 'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0a0c1e]/80 text-gray-400 transition hover:text-white backdrop-blur min-h-[44px] min-w-[44px]'}
          title={cinemaMode ? 'Exit cinema' : 'Cinema mode'}
        >
          {cinemaMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </motion.div>
  )
}

/** Traversal hint overlay — shown briefly on first load, fades after 8s */
function TraversalHint({ reducedMotion }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), reducedMotion ? 0 : 8000)
    return () => clearTimeout(t)
  }, [reducedMotion])
  if (!visible) return null
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 pointer-events-none"
    >
      <p className="rounded-full border border-white/8 bg-[#080c1e]/70 px-4 py-1.5 text-[10px] tracking-[0.16em] text-white/28 backdrop-blur">
        WASD · Space · R · F · T
      </p>
    </motion.div>
  )
}

/** Mobile bottom sheet — wraps contextual panels when isSmallViewport */
function MobileSheet({ children, onClose }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 340, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] border-t border-white/10 bg-[#080c1e]/95 p-4 pb-8 backdrop-blur-xl"
      style={{ maxHeight: '70dvh', overflowY: 'auto' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/16" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 hover:text-white min-h-[44px] min-w-[44px]"
          aria-label="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function Universe() {
  const { profile, loading: profileLoading, phase, tier } = useMusicProfile({ autoFetch: true })
  const { artifact: generatedGalaxy, loading: galaxyLoading } = useGalaxyArtifact(profile)
  const adaptive = useAdaptiveExperience()

  // ── Presence (sleep/wake/idle/active) ─────────────────────────────────────
  const presence = useUniversePresence({
    reducedMotion: adaptive.reducedMotion,
    enabled: true,
  })

  // ── Live Listening — 7s poll while /universe is active ────────────────────
  const { signal: liveSignal } = useLiveTasteSignal({
    enabled: Boolean(profile),
    pollMs: 7_000,
  })

  const cinemaMode    = useStore((s) => s.cinemaMode)
  const setCinemaMode = useStore((s) => s.setCinemaMode)

  // Cinematic walkthrough — auto-pilots the real galaxy with captions. Starts on
  // a button press, or automatically when the URL carries ?tour=1 (handy for a
  // one-take screen recording).
  const [tourActive, setTourActive] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('tour') === '1'
  })

  // Galaxy store — all hooks before any conditional
  const galaxyMode        = useGalaxyInteractionStore((s) => s.galaxyMode)
  const viewMode          = useGalaxyInteractionStore((s) => s.viewMode)
  const constellationMode = useGalaxyInteractionStore((s) => s.constellationMode)
  const showTracks        = useGalaxyInteractionStore((s) => s.showTracks)
  const showMoodRegions   = useGalaxyInteractionStore((s) => s.showMoodRegions)
  const searchQuery       = useGalaxyInteractionStore((s) => s.searchQuery)
  const hoveredObject     = useGalaxyInteractionStore((s) => s.hoveredObject)
  const focusedObject     = useGalaxyInteractionStore((s) => s.focusedObject)
  const setGalaxyMode     = useGalaxyInteractionStore((s) => s.setGalaxyMode)
  const setViewMode       = useGalaxyInteractionStore((s) => s.setViewMode)
  const toggleTracks      = useGalaxyInteractionStore((s) => s.toggleTracks)
  const toggleMoodRegions = useGalaxyInteractionStore((s) => s.toggleMoodRegions)
  const setSearchQuery    = useGalaxyInteractionStore((s) => s.setSearchQuery)
  const setFocusTarget    = useGalaxyInteractionStore((s) => s.setFocusTarget)
  const setFocusedObject  = useGalaxyInteractionStore((s) => s.setFocusedObject)
  const resetGalaxy       = useGalaxyInteractionStore((s) => s.resetGalaxyInteraction)
  const setMotionState    = useGalaxyInteractionStore((s) => s.setMotionState)
  const setNodeData       = useGalaxyInteractionStore((s) => s.setNodeData)
  const setLayoutData     = useGalaxyInteractionStore((s) => s.setLayoutData)
  const focusTarget       = useGalaxyInteractionStore((s) => s.focusTarget)

  const [model,          setModel]         = useState(null)
  const [loading,        setLoading]       = useState(true)

  // Deep-link consumption (folded in from the retired /galaxy route): honour
  // ?mode=universal|genre|artist|song and ?q=<search> so links like
  // /universe?mode=song&q=… land in the right lens with the search applied.
  const [searchParams] = useSearchParams()
  // Premium chrome toggle (reversible judgment): start from ?premium=1, flip
  // live with the on-screen button. Old chrome is the default (premium=false);
  // nothing is deleted — both looks exist until the user decides.
  const [premium, setPremium] = useState(() => searchParams.get('premium') === '1')
  useEffect(() => {
    const requestedMode = searchParams.get('mode')
    if (requestedMode && ['universal', 'genre', 'artist', 'song'].includes(requestedMode) && requestedMode !== galaxyMode) {
      setGalaxyMode(requestedMode)
    }
    const requestedQuery = searchParams.get('q')
    if (requestedQuery && requestedQuery !== searchQuery) setSearchQuery(requestedQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── activePanel — only one contextual panel at a time ────────────────────
  const [activePanel,    setActivePanel]   = useState(PANELS.NONE)

  // Individual panel visibility (derived from activePanel)
  const [activeSector,   setActiveSector]  = useState(null)
  const [showPassport,   setShowPassport]  = useState(false)
  const [showMemoryBelt, setShowMemoryBelt]= useState(false)

  // ── Scan pulse for Space key (passed to GalaxyScene) ─────────────────────
  const [scanPulseCount, setScanPulseCount] = useState(0)
  const handleScanPulse = useCallback(() => setScanPulseCount((n) => n + 1), [])

  // ── Panel open helpers — enforce mutual exclusion ─────────────────────────
  const openSector = useCallback((sector) => {
    setActiveSector(sector)
    setShowPassport(false)
    setShowMemoryBelt(false)
    setActivePanel(sector ? PANELS.SECTOR : PANELS.NONE)
  }, [])

  const openPassport = useCallback(() => {
    setShowPassport(true)
    setActiveSector(null)
    setShowMemoryBelt(false)
    setActivePanel(PANELS.PASSPORT)
    emitUniverseEvent(EVENT_TYPES.PASSPORT_EXPORT, 'Passport opened')
  }, [])

  const openMemoryBelt = useCallback(() => {
    setShowMemoryBelt((v) => {
      const next = !v
      if (next) {
        setActiveSector(null)
        setShowPassport(false)
        setActivePanel(PANELS.MEMORY)
      } else {
        setActivePanel(PANELS.NONE)
      }
      return next
    })
  }, [])

  const closeAllPanels = useCallback(() => {
    setActiveSector(null)
    setShowPassport(false)
    setShowMemoryBelt(false)
    setActivePanel(PANELS.NONE)
  }, [])

  // Inspector panel is active when an entity is focused and no other panel is dominating
  const inspectorVisible = useMemo(
    () => !!(focusedObject) && activePanel !== PANELS.SECTOR && activePanel !== PANELS.PASSPORT,
    [focusedObject, activePanel],
  )

  // ── Real Memory Belt ──────────────────────────────────────────────────────
  const timelines = useArtistTimelines({
    profile,
    isDemo: false,
    enabled: Boolean(profile) && !loading,
  })

  // Build / update model
  useEffect(() => {
    setLoading(true)
    let raw = null
    if (generatedGalaxy) {
      raw = generatedGalaxy
    } else if (profile?.topArtists?.length || profile?.genres?.length) {
      raw = buildGalaxyModel(profile)
    }
    if (raw && !timelines.loading && timelines.basis !== 'unavailable') {
      raw = applyTimelineClassifications(raw, timelines)
    }
    if (raw) setModel(raw)
    setLoading(false)
  }, [generatedGalaxy, profile, timelines.ghostIds, timelines.surgeIds, timelines.anchorIds, timelines.loading])

  useEffect(() => () => resetGalaxy(), [resetGalaxy])

  // ── Live motion state from signal ─────────────────────────────────────────
  const liveIntensity = Math.max(0, Math.min(1, liveSignal?.sessionIntensity || 0))
  const liveNovelty   = Math.max(0, Math.min(1, liveSignal?.noveltyScore     || 0))

  useEffect(() => {
    setMotionState({
      driftStrength:       0.18 + liveIntensity * 0.05,
      oscillationStrength: 0.28 + liveNovelty   * 0.06,
      shimmerStrength:     0.20 + liveIntensity * 0.05,
    })
  }, [liveIntensity, liveNovelty, setMotionState])

  // ── Live artist detection — emit event if current artist missing ──────────
  const prevLiveTrackRef = useRef(null)
  useEffect(() => {
    const currentTrack = liveSignal?.activeTracks?.[0]
    if (!currentTrack || !model) return
    const trackId = currentTrack.id || currentTrack.name
    if (trackId === prevLiveTrackRef.current) return
    prevLiveTrackRef.current = trackId

    const artistName = currentTrack.artist
    const found = artistName && model.nodes?.some(
      (n) => n.label?.toLowerCase() === artistName.toLowerCase() && n.type === 'artist',
    )
    if (!found && artistName) {
      emitUniverseEvent(EVENT_TYPES.LIVE_SIGNAL, 'New live signal entering', artistName)
    }
  }, [liveSignal?.activeTracks, model])

  // ── Emit event when obsession well is active ──────────────────────────────
  const activeModel = useMemo(
    () => buildGalaxyModeModel(model, galaxyMode),
    [galaxyMode, model],
  )

  useEffect(() => {
    if (!activeModel) return
    setNodeData(activeModel.nodes || [])
    setLayoutData({ regions: activeModel.regions || [], clusters: activeModel.clusters || [], core: activeModel.metadata?.core || null })
  }, [activeModel, setNodeData, setLayoutData])

  const focusedEntity = useMemo(
    () => resolveInteractionEntity(activeModel, profile, focusedObject),
    [activeModel, profile, focusedObject],
  )

  const resonance = useMemo(() => mapGalaxySelectionToResonance({
    node:    focusedEntity.node,
    cluster: focusedEntity.cluster,
    region:  focusedEntity.region,
    edge:    focusedEntity.edge,
    model:   activeModel,
    mode:    'focused',
  }), [activeModel, focusedEntity])

  const activeViewMode = constellationMode ? 'constellation' : viewMode
  const sparseMode     = tier === 'sparse' || !profile
  const isLoading      = loading || galaxyLoading || (profileLoading && !model)

  // ── Memory Belt + Obsession Well ─────────────────────────────────────────
  const ghostNodes    = useMemoryBelt(activeModel)
  const obsessionNode = useObsessionNode(activeModel, {
    isLastfm: profile?.provider === 'lastfm',
    surgeIds: timelines.surgeIds,
  })

  // Emit once when obsession field becomes active
  const obsessionEmittedRef = useRef(false)
  useEffect(() => {
    if (obsessionNode && !obsessionEmittedRef.current) {
      obsessionEmittedRef.current = true
      emitUniverseEvent(EVENT_TYPES.OBSESSION_FIELD, 'Obsession field active', obsessionNode.label)
    }
    if (!obsessionNode) obsessionEmittedRef.current = false
  }, [obsessionNode])

  // Emit when surge stars appear
  const surgeEmittedRef = useRef(new Set())
  useEffect(() => {
    if (!timelines.surgeIds) return
    timelines.surgeIds.forEach((id) => {
      if (!surgeEmittedRef.current.has(id)) {
        surgeEmittedRef.current.add(id)
        const node = activeModel?.nodes?.find((n) => n.id === id)
        if (node) emitUniverseEvent(EVENT_TYPES.SURGE_STAR, 'New surge star', node.label)
      }
    })
  }, [timelines.surgeIds, activeModel])

  // Emit when ghost stars are found
  const ghostEmittedRef = useRef(false)
  useEffect(() => {
    if (ghostNodes.length > 0 && !ghostEmittedRef.current) {
      ghostEmittedRef.current = true
      emitUniverseEvent(EVENT_TYPES.FORMER_ORBIT, `${ghostNodes.length} former orbit${ghostNodes.length > 1 ? 's' : ''} detected`)
    }
  }, [ghostNodes])

  // ── Discovery Comets ──────────────────────────────────────────────────────
  const {
    comets,
    decoded:  decodedComet,
    captured: capturedComets,
    handleCometClick,
    handleCapture,
    handleClose: handleCometClose,
  } = useDiscoveryComets({ profile, isDemo: false })

  // Emit comet decoded event
  const cometDecodeEmittedRef = useRef(null)
  useEffect(() => {
    if (decodedComet && decodedComet.id !== cometDecodeEmittedRef.current) {
      cometDecodeEmittedRef.current = decodedComet.id
      emitUniverseEvent(EVENT_TYPES.COMET_DECODED, 'Comet decoded', decodedComet.artistName || decodedComet.label)
      setActivePanel(PANELS.COMET)
    }
    if (!decodedComet && activePanel === PANELS.COMET) {
      setActivePanel(PANELS.NONE)
    }
  }, [decodedComet, activePanel])

  // Emit when semantic coverage is high
  const semanticEmittedRef = useRef(false)
  useEffect(() => {
    const cov = activeModel?.metadata?.semanticCoverage
    if (cov >= 0.8 && !semanticEmittedRef.current) {
      semanticEmittedRef.current = true
      emitUniverseEvent(EVENT_TYPES.SEMANTIC_LOCKED, 'Semantic map locked', `${Math.round(cov * 100)}% coverage`)
    }
  }, [activeModel?.metadata?.semanticCoverage])

  const controlProps = {
    isDemo:              false,
    loading:             isLoading,
    cinemaMode,
    onRefresh:           () => profile && setModel(buildGalaxyModel(profile)),
    galaxyMode,
    onChangeGalaxyMode:  setGalaxyMode,
    viewMode:            activeViewMode,
    onChangeViewMode:    setViewMode,
    showTracks,
    onToggleTracks:      toggleTracks,
    showMoodRegions,
    onToggleMoodRegions: toggleMoodRegions,
    searchQuery,
    onSearchChange:      setSearchQuery,
  }

  // In-canvas extras (comets, ghost lines, obsession well) rendered inside the
  // ONE persistent galaxy <Canvas> via the stage store. Memoized so the stage
  // only republishes when these actually change.
  const stageExtraChildren = useMemo(() => (
    <>
      <Suspense fallback={null}>
        <CometLayer comets={comets} onCometClick={handleCometClick} reducedMotion={adaptive.reducedMotion} />
      </Suspense>
      <GhostConstellationLines ghostNodes={ghostNodes} reducedMotion={adaptive.reducedMotion} />
      {obsessionNode && <ObsessionGravityWell node={obsessionNode} reducedMotion={adaptive.reducedMotion} />}
    </>
  ), [comets, handleCometClick, ghostNodes, obsessionNode, adaptive.reducedMotion])

  // Publish this route's scene to the persistent galaxy canvas. /universe drives
  // traversal, the scan pulse, presence-based drift speed, and the comet/memory
  // extras — all of which used to be props on its own inline <GalaxyScene>.
  useGalaxyStageConfig({
    model:            activeModel,
    sparseMode,
    lowPower:         adaptive.sparseGraphics,
    reducedMotion:    adaptive.reducedMotion,
    webglEnabled:     adaptive.webglSupported,
    traversalEnabled: !adaptive.touchDevice,
    scanPulseCount,
    onScanPulse:      handleScanPulse,
    autoRotateSpeed:  presence.driftSpeed,
    extraChildren:    stageExtraChildren,
  }, [
    activeModel, sparseMode, adaptive.sparseGraphics, adaptive.reducedMotion,
    adaptive.webglSupported, adaptive.touchDevice, scanPulseCount, handleScanPulse,
    presence.driftSpeed, stageExtraChildren,
  ])

  // ── Loading screen ────────────────────────────────────────────────────────
  if (phase === 'loading' && !model) {
    return (
      <div className="fixed inset-0 flex items-center justify-center app-shell-bg">
        <NebulaLoader label="Your universe is assembling." detail="Stars, nebulae, and bridges are forming in the dark." />
      </div>
    )
  }

  const title    = profile?.userProfile?.displayName
    ? `${profile.userProfile.displayName}'s universe`
    : 'Your universe'
  const subtitle = activeModel
    ? `${activeModel.nodes?.length || 0} bodies · ${activeModel.regions?.length || 0} nebulae`
    : null

  // Live track ID for ripple trigger
  const currentTrackId = liveSignal?.activeTracks?.[0]?.id || liveSignal?.activeTracks?.[0]?.name || null

  // Inspector panel content (shared between desktop + mobile sheet)
  const inspectorContent = inspectorVisible && (
    <div className="space-y-2">
      <Suspense fallback={null}>
        <GalaxyInspector
          node={focusedEntity.node}
          edge={focusedEntity.edge}
          cluster={focusedEntity.cluster}
          region={focusedEntity.region}
        />
      </Suspense>
      <AuralithNodeExplainer entity={focusedEntity} profile={profile} />
    </div>
  )

  // pointer-events-none on the root below is LOAD-BEARING: this root sits at z-10
  // directly over the persistent galaxy <Canvas> (z-0, a sibling in App.jsx).
  // Without it, this full-screen div swallows every drag and click before they
  // reach the stars — keyboard (WASD) still works, the mouse does not. Each
  // interactive child (HUD panels, Recenter/Drift buttons, Soul Orb dock)
  // re-enables pointer-events-auto on itself, so the mouse falls through the gaps
  // to the canvas and click-to-focus / drag-to-look work.
  return (
    <div className={`relative pointer-events-none ${cinemaMode ? 'fixed inset-0 z-50' : 'z-10 h-[100dvh] overflow-hidden'}`}>

      {/* The galaxy renders from the ONE persistent <Canvas> in the app shell
          (published via useGalaxyStageConfig above). While the model resolves,
          a quiet loader sits over the ambient backdrop. */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <NebulaLoader label="Tuning the universe" detail="Laying out your listening cosmos." />
        </div>
      )}

      {/* Fly-through lifeline: recenter + drift + controls hint. */}
      {!isLoading && (
        <GalaxyTraversalHUD reducedMotion={adaptive.reducedMotion} coarsePointer={adaptive.touchDevice} />
      )}

      {/* Genesis Sequence — cinematic formation on first open */}
      <GenesisSequence
        auralithLine={profile
          ? `${profile.userProfile?.displayName || 'Your'} universe is here. Every star is a voice you returned to.`
          : 'Your listening history is a universe. You are inside it now.'}
      />

      {/* Now Playing ripple — fires from Soul Orb position on track change */}
      <NowPlayingRipple currentTrackId={currentTrackId} reducedMotion={adaptive.reducedMotion} />

      {/* ── HUD — opacity dimmed when presence is sleeping ─────────────── */}
      {!isLoading && (
        <motion.div
          animate={{ opacity: presence.hudOpacity }}
          transition={{ duration: adaptive.reducedMotion ? 0 : 1.2, ease: 'easeInOut' }}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 0 }}
        >
          {/* This layer MUST stay pointer-events-none so clicks fall through the
              empty gaps to the galaxy canvas (z-0) and stars are selectable.
              Each interactive panel/leaf re-enables pointer-events-auto on
              itself. A full-screen pointer-events-auto here silently kills
              click-to-focus on every star — that was the bug. */}
          <div className="absolute inset-0 pointer-events-none">

            <UniverseTopBar
              title={title}
              subtitle={subtitle}
              cinemaMode={cinemaMode}
              onToggleCinema={() => setCinemaMode(!cinemaMode)}
              onOpenPassport={openPassport}
              premium={premium}
            />

            {/* Signal feed — top right under orb */}
            <div className="pointer-events-auto absolute right-4 top-[8.5rem] z-20 sm:top-[9.5rem]">
              <AnimatePresence>
                <UniverseEventFeed />
              </AnimatePresence>
            </div>

            {/* Controls — top left under title */}
            <div className="pointer-events-auto absolute left-4 top-[4.5rem] z-20">
              <Suspense fallback={null}>
                <GalaxyControls {...controlProps} />
              </Suspense>
            </div>

            {/* Soul Orb dock — right side */}
            <SoulOrbDock
              profile={profile}
              resonance={resonance}
              sparseGraphics={adaptive.sparseGraphics}
              liveIntensity={liveIntensity}
              premium={premium}
            />

            {/* Legend */}
            {activeModel && (
              <Suspense fallback={null}>
                <GalaxyLegend
                  clusters={activeModel.clusters || []}
                  regions={activeModel.regions   || []}
                  density={activeModel.metadata?.modeDensity || activeModel.metadata?.density}
                  profileTier={activeModel.metadata?.profileTier}
                  onSelectCluster={(id) => {
                    const c = activeModel.clusters?.find((x) => x.id === id)
                    if (c) { setFocusedObject({ id, type: 'cluster', label: c.label }); setFocusTarget(c.centroid || null) }
                  }}
                  onSelectRegion={(id) => {
                    const r = activeModel.regions?.find((x) => x.id === id)
                    if (r) { setFocusedObject({ id, type: 'region', label: r.title || r.label }); setFocusTarget(r.centroid || null) }
                  }}
                />
              </Suspense>
            )}

            {/* ── Desktop inspector + Auralith (not shown on mobile — use bottom sheet) */}
            <AnimatePresence>
              {inspectorVisible && !adaptive.isSmallViewport && !activeSector && (
                <motion.div
                  key="inspector"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={MOTION_TOKENS.focusSettle}
                  className="pointer-events-auto absolute bottom-20 left-4 z-20 w-[min(90vw,340px)] space-y-2"
                >
                  {inspectorContent}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sector portal overlay */}
            <AnimatePresence>
              {activeSector && (
                <SectorPortal
                  key={activeSector.id}
                  sector={activeSector}
                  onClose={closeAllPanels}
                  premium={premium}
                />
              )}
            </AnimatePresence>

            {/* Memory Belt button + panel */}
            {ghostNodes.length > 0 && (
              <div className="pointer-events-auto absolute left-4 top-[4.5rem] z-20 mt-14 w-[min(90vw,280px)]">
                <button
                  type="button"
                  onClick={openMemoryBelt}
                  className="mb-1 flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#ccd6ff]/16 bg-[#ccd6ff]/06 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#ccd6ff]/52 backdrop-blur transition hover:border-[#ccd6ff]/28"
                >
                  {ghostNodes.length} former orbit{ghostNodes.length > 1 ? 's' : ''}
                </button>
                <MemoryBeltPanel ghostNodes={ghostNodes} model={activeModel} visible={showMemoryBelt && !adaptive.isSmallViewport} />
              </div>
            )}

            {/* Discovery comet decode overlay */}
            <CometDecodeOverlay
              decoded={decodedComet}
              isDemo={false}
              onClose={() => { handleCometClose(); setActivePanel(PANELS.NONE) }}
              onCapture={handleCapture}
              captured={capturedComets}
            />

            {/* Semantic Legend */}
            {!presence.hudDimmed && (
              <SemanticLegend
                className="pointer-events-auto absolute bottom-20 right-4 z-20"
                semanticCoverage={activeModel?.metadata?.semanticCoverage ?? null}
              />
            )}

            {/* Traversal hint — desktop only, fades after 8s */}
            <AnimatePresence>
              {!adaptive.isSmallViewport && !adaptive.reducedMotion && (
                <TraversalHint reducedMotion={adaptive.reducedMotion} />
              )}
            </AnimatePresence>

            {/* Sector ring navigation */}
            <SectorRing
              sectors={SECTORS}
              activeSectorId={activeSector?.id}
              isMobile={adaptive.isSmallViewport}
              onSelect={(s) => openSector(activeSector?.id === s.id ? null : s)}
              premium={premium}
            />

            {/* Cinematic walkthrough — auto-pilots the real galaxy with captions. */}
            {!tourActive && (
              <button
                type="button"
                onClick={() => setTourActive(true)}
                className="shell-chrome shell-chrome--fade pointer-events-auto absolute right-4 top-24 z-30 flex items-center gap-2 rounded-full border border-[#c1337f]/35 bg-[#301725]/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ebccdc] backdrop-blur transition hover:text-[#faf5f8] min-h-[44px]"
                title="Play a cinematic walkthrough of your universe"
              >
                ▶ Play tour
              </button>
            )}
            <CinematicTour
              model={model}
              active={tourActive}
              onExit={() => setTourActive(false)}
              reducedMotion={adaptive.reducedMotion}
            />

            {/* Reversible premium-chrome toggle — flip OLD vs NEW chrome live to
                judge. Sits to the RIGHT of the bottom-left volume button (which is
                portaled in at left-4); at left-4 the two stacked and the volume
                pill covered "Prem", so the toggle read as a clipped "ium: OFF". */}
            <button
              type="button"
              onClick={() => setPremium((v) => !v)}
              className="pointer-events-auto absolute bottom-4 left-20 z-30 rounded-full border border-[#f4e6ee]/20 bg-[#0c0907]/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#f4e6ee]/55 backdrop-blur transition hover:text-[#f4e6ee]/90 min-h-[44px]"
              title="Toggle premium chrome"
            >
              {premium ? 'Premium: ON' : 'Premium: OFF'}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Mobile bottom sheet — contextual panels ────────────────────── */}
      <AnimatePresence>
        {adaptive.isSmallViewport && (inspectorVisible || showMemoryBelt) && !activeSector && (
          <MobileSheet onClose={closeAllPanels}>
            {inspectorVisible && inspectorContent}
            {showMemoryBelt && ghostNodes.length > 0 && (
              <MemoryBeltPanel ghostNodes={ghostNodes} model={activeModel} visible />
            )}
          </MobileSheet>
        )}
      </AnimatePresence>

      {/* Identity Passport modal — always on top, not affected by presence HUD */}
      <IdentityPassportModal
        open={showPassport}
        onClose={() => { setShowPassport(false); setActivePanel(PANELS.NONE) }}
        profile={profile}
        model={activeModel}
        comets={comets}
        isDemo={false}
      />
    </div>
  )
}
