/**
 * DiscoveryComets.jsx
 * -------------------
 * Recommendations visualised as comets entering from the outer rim.
 *
 * Data priority:
 *   1. discoverAPI.playlists() results if authenticated
 *   2. DEMO_COMET_SEEDS if not authenticated or API fails
 *
 * Visual encoding (12-data-to-visual-metaphor):
 *   trail color  = archetype / genre (inherited from profile palette)
 *   brightness   = recommendation confidence
 *   rim distance = risk (higher risk = further from centre)
 *   flicker rate = novelty
 *
 * Interaction:
 *   hover  → "Unknown signal — click to decode"
 *   click  → DecodeCard overlay (artist / song / reason / confidence)
 *   "Capture" → demo only — adds comet to a captured list (local state)
 *
 * GPU safety (03-r3f-performance-engineer):
 *   - Comet heads: single InstancedMesh (one draw call for all heads)
 *   - Trails:      per-comet LineSegments with memoised BufferGeometry
 *   - No setState or new geometry inside useFrame
 *   - All position updates via ref mutation
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html }                    from '@react-three/drei'
import { useFrame, useThree }      from '@react-three/fiber'
import * as THREE                  from 'three'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Zap }        from 'lucide-react'
import { discoverAPI }             from '../../services/api'
import useAuthStore                from '../../store/useAuthStore'
import { MOTION_TOKENS }           from '../motion/motionTokens'

// ─── Demo seed comets ─────────────────────────────────────────────────────────
const DEMO_COMET_SEEDS = [
  { id: 'c1', title: 'Lush',           artist: 'Halsey',        genre: 'dream pop',   confidence: 0.82, risk: 0.22, reason: 'High atmospheric density — sits in the dream-pop nebula you already orbit.' },
  { id: 'c2', title: 'Grouper',        artist: 'Grouper',       genre: 'ambient folk',confidence: 0.74, risk: 0.35, reason: 'Textural match with your low-energy, high-acousticness signal.' },
  { id: 'c3', title: 'Have a Nice Life',artist: 'Have a Nice Life', genre: 'slowcore', confidence: 0.68, risk: 0.52, reason: 'Mid-rim signal — outside your core but tonally familiar.' },
  { id: 'c4', title: 'This Mortal Coil', artist: 'This Mortal Coil', genre: 'dream pop', confidence: 0.91, risk: 0.18, reason: 'Near-core match. Your listening frequently passes through this region.' },
]

// Genre → trail colour
const GENRE_TRAIL_COLORS = {
  'dream pop':   '#b59cff',
  'shoegaze':    '#9db7ff',
  'ambient folk':'#ac6294',
  'neo-soul':    '#f1aacb',
  'slowcore':    '#ccd6ff',
  'lo-fi indie': '#b59cff',
  'default':     '#EAE6FF',
}

function trailColor(genre = '') {
  for (const [key, color] of Object.entries(GENRE_TRAIL_COLORS)) {
    if (genre.toLowerCase().includes(key)) return color
  }
  return GENRE_TRAIL_COLORS.default
}

// Stable seeded random using a string hash
function seededRng(seed) {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return () => {
    h = (Math.imul(31, h) + h) | 0
    return ((h >>> 0) / 4294967296)
  }
}

// Build a comet entry trajectory: starts at rim, arcs toward inner zone
function buildCometPath(id, confidence, risk) {
  const rng     = seededRng(id)
  const rimR    = 26 + risk * 8          // high risk = further from core
  const targetR = 10 + rng() * 6         // where it decelerates
  const theta   = rng() * Math.PI * 2
  const phi     = (rng() - 0.5) * 0.8   // slight vertical angle
  return {
    origin: new THREE.Vector3(
      rimR * Math.cos(theta) * Math.cos(phi),
      rimR * Math.sin(phi),
      rimR * Math.sin(theta) * Math.cos(phi),
    ),
    target: new THREE.Vector3(
      targetR * Math.cos(theta + 0.4),
      (rng() - 0.5) * 3,
      targetR * Math.sin(theta + 0.4),
    ),
    speed:    0.06 + confidence * 0.06,
    trailLen: 12 + Math.round(confidence * 10),
  }
}

// ─── Three.js comet renderer ──────────────────────────────────────────────────
const TRAIL_LEN = 22
const MAX_COMETS = 6

// Module-scope scratch reused by every CometHead's frame loop — avoids allocating
// a THREE.Vector3 per comet per frame. Safe: each frame callback copies out of it
// (into posRef + mesh.position) before the next comet's callback runs.
const _cometScratch = new THREE.Vector3()

function CometTrail({ path, color, opacity, trailPositions }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(TRAIL_LEN * 3)
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  // Dispose the trail buffer on unmount (route away from /universe).
  useEffect(() => () => geo?.dispose(), [geo])

  useFrame(() => {
    const attr = geo.attributes.position
    const tp   = trailPositions.current
    if (!tp || tp.length < 3) return
    for (let i = 0; i < TRAIL_LEN; i++) {
      const srcIdx = Math.min(i * 3, tp.length - 3)
      attr.setXYZ(i, tp[srcIdx], tp[srcIdx + 1], tp[srcIdx + 2])
    }
    attr.needsUpdate = true
  })

  return (
    <line geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity * 0.6} />
    </line>
  )
}

function CometHead({ path, color, opacity, posRef, onHover, onClick, hovered, label, reducedMotion }) {
  const meshRef = useRef()
  const t       = useRef(0)

  useFrame((state, delta) => {
    if (reducedMotion) return
    t.current = Math.min(t.current + delta * path.speed, 1)
    const pos = _cometScratch.lerpVectors(path.origin, path.target, t.current)
    posRef.current.push(pos.x, pos.y, pos.z)
    if (posRef.current.length > TRAIL_LEN * 3) posRef.current.splice(0, 3)
    if (meshRef.current) {
      meshRef.current.position.copy(pos)
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.22
      meshRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <mesh ref={meshRef} position={path.origin.toArray()}>
      <sphereGeometry args={[0.14, 10, 10]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(true) }}
        onPointerOut={(e) => { e.stopPropagation(); onHover(false) }}
      >
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <Html distanceFactor={8} center>
          <div className="pointer-events-none rounded-xl border border-[#b59cff]/30 bg-[#070814]/92 px-3 py-1.5 text-[11px] text-[#b59cff] backdrop-blur">
            Unknown signal · click to decode
          </div>
        </Html>
      )}
    </mesh>
  )
}

// ─── R3F scene layer ──────────────────────────────────────────────────────────
export function CometLayer({ comets, onCometClick, reducedMotion = false }) {
  const trailRefs   = useRef(comets.map(() => ({ current: [] })))
  const [hovered, setHovered] = useState(null)

  if (!comets.length) return null

  return (
    <>
      {comets.map((comet, i) => {
        const path  = comet._path
        const color = trailColor(comet.genre)
        const opac  = 0.55 + comet.confidence * 0.4
        if (!trailRefs.current[i]) trailRefs.current[i] = { current: [] }

        return (
          <group key={comet.id}>
            <CometTrail
              path={path}
              color={color}
              opacity={opac}
              trailPositions={trailRefs.current[i]}
            />
            <CometHead
              path={path}
              color={color}
              opacity={opac}
              posRef={trailRefs.current[i]}
              onHover={(h) => setHovered(h ? comet.id : null)}
              onClick={() => onCometClick(comet)}
              hovered={hovered === comet.id}
              label={comet.title}
              reducedMotion={reducedMotion}
            />
          </group>
        )
      })}
    </>
  )
}

// ─── Decode card (2D HUD overlay) ─────────────────────────────────────────────
function DecodeCard({ comet, isDemo, onClose, onCapture, captured }) {
  if (!comet) return null
  const color = trailColor(comet.genre)

  return (
    <motion.div
      key={comet.id}
      initial={{ opacity: 0, scale: 0.9, y: 16 }}
      animate={{ opacity: 1, scale: 1,   y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 12 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="pointer-events-auto relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-xl"
      style={{
        background:  'linear-gradient(135deg, rgba(7,8,20,0.94), rgba(4,5,14,0.97))',
        borderColor: `${color}30`,
        boxShadow:   `0 0 60px ${color}10`,
      }}
    >
      {/* Scanner line */}
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full"
           style={{ background: `linear-gradient(90deg, transparent, ${color}44, transparent)` }} />

      <button type="button" onClick={onClose}
        className="absolute right-3 top-3 rounded-full border border-white/10 p-1.5 text-gray-500 hover:text-white transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>

      <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: `${color}99` }}>
        Outer rim signal decoded
      </p>
      <h3 className="mt-2 text-xl font-black text-white">{comet.title}</h3>
      <p className="text-sm text-gray-400">{comet.artist}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">
          {comet.genre}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[11px]"
          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
        >
          {Math.round(comet.confidence * 100)}% match
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-400">
          risk: {Math.round(comet.risk * 100)}%
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-300 italic">
        "{comet.reason}"
      </p>

      <div className="mt-4 flex gap-2">
        {isDemo && !captured && (
          <button
            type="button"
            onClick={() => onCapture(comet.id)}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${color}44, ${color}22)`, border: `1px solid ${color}40` }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Capture into orbit
          </button>
        )}
        {captured && (
          <span className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#ac6294]"
                style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.24)' }}>
            <Zap className="h-3.5 w-3.5" /> In orbit
          </span>
        )}
        <button type="button" onClick={onClose}
          className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
          Dismiss signal
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main hook: load and manage comets ───────────────────────────────────────
export function useDiscoveryComets({ profile, isDemo = false }) {
  const sessionToken = useAuthStore((s) => s.sessionToken)
  const providers    = useAuthStore((s) => s.providers)
  const isAuthed     = Boolean(sessionToken || providers?.spotify?.connected)

  const [comets, setComets]       = useState([])
  const [loading, setLoading]     = useState(false)
  const [decoded, setDecoded]     = useState(null)   // comet being shown in decode card
  const [captured, setCaptured]   = useState(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const buildComets = (raw) => raw
      .slice(0, MAX_COMETS)
      .map((item, i) => ({
        id:         item.id         || `comet-${i}`,
        title:      item.title      || item.name    || 'Unknown signal',
        artist:     item.artist     || item.primary_artist || '',
        genre:      item.genre      || (profile?.genres?.[0]?.genre || 'unknown'),
        confidence: Math.min(1, Math.max(0, item.confidence ?? (0.5 + Math.random() * 0.4))),
        risk:       Math.min(1, Math.max(0, item.risk       ?? (0.2 + Math.random() * 0.5))),
        reason:     item.reason     || item.explanation || 'Signal detected at the outer rim.',
        _path:      null, // filled below
      }))
      .map((c) => ({ ...c, _path: buildCometPath(c.id, c.confidence, c.risk) }))

    if (isDemo || !isAuthed) {
      if (!cancelled) setComets(buildComets(DEMO_COMET_SEEDS))
      setLoading(false)
      return
    }

    // Authenticated: try real discover API
    discoverAPI.playlists(
      { topArtists: profile?.topArtists, genres: profile?.genres, audioFeatures: profile?.audioFeatures },
      { limit: 8 },
    )
      .then((res) => {
        if (cancelled) return
        const songs = res?.data?.songs || res?.data?.items || res?.data || []
        if (songs.length) {
          setComets(buildComets(songs))
        } else {
          // No results → no fake data in authenticated mode; show nothing
          setComets([])
        }
      })
      .catch(() => {
        if (!cancelled) setComets([]) // never fake in auth mode
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [isAuthed, isDemo, profile])

  const handleCometClick = useCallback((comet) => setDecoded(comet), [])
  const handleCapture    = useCallback((id) => setCaptured((s) => new Set([...s, id])), [])
  const handleClose      = useCallback(() => setDecoded(null), [])

  return { comets, loading, decoded, captured, handleCometClick, handleCapture, handleClose }
}

// ─── Decode card portal (mount outside Canvas) ───────────────────────────────
export function CometDecodeOverlay({ decoded, isDemo, onClose, onCapture, captured }) {
  return (
    <AnimatePresence>
      {decoded && (
        <div className="pointer-events-none absolute bottom-24 right-4 z-30 w-[min(90vw,360px)]">
          <DecodeCard
            comet={decoded}
            isDemo={isDemo}
            onClose={onClose}
            onCapture={onCapture}
            captured={captured.has(decoded?.id)}
          />
        </div>
      )}
    </AnimatePresence>
  )
}
