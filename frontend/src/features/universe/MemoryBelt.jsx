/**
 * MemoryBelt.jsx
 * --------------
 * The Memory Belt is the outer ring of ghost stars — artists from a user's
 * long-term listening that have faded from their recent orbit.
 *
 * It gives Melody Map emotional depth: your past does not disappear,
 * it haunts the outer rim with pale light.
 *
 * This file contains:
 *   GhostConstellationLines  — broken, faded lines between ghost artists
 *   MemoryBeltHUD            — 2D panel shown when hovering a ghost star
 *   useMemoryBelt            — hook to derive ghost artists from profile data
 *
 * Data logic (12-data-to-visual-metaphor):
 *   Ghost star = artist present in profile.topArtists (long_term) but
 *                NOT present in a short_term re-fetch, OR explicitly
 *                marked metrics.isGhost in the galaxy model.
 *
 * Demo mode: uses demoPlanet.js seeded ghost artist (Porcelain Distance).
 * Auth mode + no diff data: "Memory Belt forming" state.
 */
import { useMemo, useRef }        from 'react'
import { useFrame }               from '@react-three/fiber'
import * as THREE                 from 'three'
import { AnimatePresence, motion} from 'framer-motion'
import { Ghost }                  from 'lucide-react'
import { MOTION_TOKENS }          from '../motion/motionTokens'

// ─────────────────────────────────────────────────────────────────────────────
// Three.js — broken constellation lines between ghost stars
// ─────────────────────────────────────────────────────────────────────────────
export function GhostConstellationLines({ ghostNodes, reducedMotion = false }) {
  const matRef = useRef()

  // Build dashed-looking line geometry once
  const geometry = useMemo(() => {
    if (!ghostNodes || ghostNodes.length < 2) return null
    const positions = []
    // Connect ghost stars in a chain
    for (let i = 0; i < ghostNodes.length - 1; i++) {
      const a = ghostNodes[i].position   || { x: 0, y: 0, z: 0 }
      const b = ghostNodes[i+1].position || { x: 0, y: 0, z: 0 }
      // Create "broken" look by only rendering 60% of each segment
      const SEGMENTS = 5
      for (let s = 0; s < SEGMENTS; s++) {
        if (s % 2 === 1) continue  // skip every other segment = broken look
        const t0 = s     / SEGMENTS
        const t1 = (s + 0.6) / SEGMENTS
        const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0, z: a.z + (b.z - a.z) * t0 }
        const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1, z: a.z + (b.z - a.z) * t1 }
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
      }
    }
    if (!positions.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    return geo
  }, [ghostNodes])

  useFrame(({ clock }) => {
    if (reducedMotion || !matRef.current) return
    matRef.current.opacity = 0.06 + Math.sin(clock.getElapsedTime() * 0.24) * 0.03
  })

  if (!geometry) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#ccd6ff" transparent opacity={0.08} />
    </lineSegments>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2D HUD — Memory Belt panel
// ─────────────────────────────────────────────────────────────────────────────
export function MemoryBeltPanel({ ghostNodes = [], model, visible }) {
  const count = ghostNodes.length

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        key="memory-belt"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={MOTION_TOKENS.panel}
        className="relative overflow-hidden rounded-[22px] border border-[#ccd6ff]/14 bg-[#060c1e]/88 p-4 backdrop-blur-xl"
        style={{ boxShadow: '0 0 40px rgba(204,214,255,0.04)' }}
      >
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#ccd6ff]/20 to-transparent" />

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#ccd6ff]/18 bg-[#ccd6ff]/08">
            <Ghost className="h-3.5 w-3.5 text-[#ccd6ff]/60" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ccd6ff]/50">
              Memory Belt
            </p>
            {count > 0 ? (
              <>
                <p className="mt-1 text-sm text-white/72">
                  {count === 1
                    ? 'One former orbit detected.'
                    : `${count} former orbits detected.`}
                </p>
                <p className="mt-1 text-xs italic text-[#ccd6ff]/52">
                  {count === 1
                    ? `${ghostNodes[0]?.label || 'This voice'} used to live here. It drifts in the outer rim now.`
                    : `These voices used to define your orbit. They have not left — they are simply further from the core.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ghostNodes.slice(0, 4).map((n) => (
                    <span key={n.id} className="rounded-full border border-[#ccd6ff]/16 bg-[#ccd6ff]/06 px-2.5 py-1 text-[11px] text-[#ccd6ff]/60">
                      {n.label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs italic text-[#ccd6ff]/40">
                Memory Belt forming after more listening syncs.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — derive ghost nodes from model
// ─────────────────────────────────────────────────────────────────────────────
export function useMemoryBelt(model) {
  return useMemo(() => {
    if (!model?.nodes) return []
    return model.nodes.filter((n) =>
      n.type === 'artist' && (n.role === 'ghost-star' || n.metrics?.isGhost === true)
    )
  }, [model])
}
