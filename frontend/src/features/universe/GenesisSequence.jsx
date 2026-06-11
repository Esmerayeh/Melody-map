/**
 * GenesisSequence.jsx
 * -------------------
 * Cinematic universe-formation sequence shown once on first open of /demo
 * or /universe.  8–12 seconds.  Skippable.  Reduced-motion: instant.
 *
 * Sequence:
 *   0.0s  — cosmic silence, dark canvas
 *   0.6s  — Soul Orb spark appears (tiny pulsing point)
 *   1.8s  — "Your universe is forming." text
 *   2.4s  — dust gathers (star count ramps from 0)
 *   4.0s  — genre nebulae bloom (opacity ramps)
 *   6.0s  — artist stars ignite (opacity ramps)
 *   7.5s  — constellation links draw
 *   9.0s  — Auralith one-line caption fades in
 *   10.0s — camera settles, HUD appears, sequence completes
 *
 * Implementation uses:
 *   - Framer Motion for all 2D HUD elements
 *   - A single CSS-driven opacity gate for the Galaxy canvas
 *   - No new Three.js objects; the existing GalaxyScene handles 3D rendering
 *   - sessionStorage flag so sequence only fires once per session
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// How long each phase lasts (seconds)
const PHASE_DURATIONS = {
  silence:    0.6,
  spark:      1.2,   // cumulative: 1.8
  gather:     2.2,   // cumulative: 4.0
  nebulae:    2.0,   // cumulative: 6.0
  stars:      1.5,   // cumulative: 7.5
  links:      1.5,   // cumulative: 9.0
  auralith:   1.0,   // cumulative: 10.0
  settle:     0.8,   // cumulative: 10.8 → sequence done
}

const TOTAL_DURATION = Object.values(PHASE_DURATIONS).reduce((a, b) => a + b, 0)

// Phase thresholds (seconds) at which each CSS class enables.
const T_SPARK    = PHASE_DURATIONS.silence
const T_GATHER   = T_SPARK + PHASE_DURATIONS.spark
const T_NEBULAE  = T_GATHER + PHASE_DURATIONS.gather
const T_STARS    = T_NEBULAE + PHASE_DURATIONS.nebulae
const T_LINKS    = T_STARS + PHASE_DURATIONS.stars
const T_AURALITH = T_LINKS + PHASE_DURATIONS.links
const T_SETTLE   = T_AURALITH + PHASE_DURATIONS.auralith

const SESSION_KEY = 'mm_genesis_shown'

export default function GenesisSequence({
  auralithLine = 'Your listening history is a universe. You are inside it now.',
  isDemo = false,
  onComplete,
}) {
  const [active, setActive]      = useState(false)
  const [phase, setPhase]        = useState('silence')
  const [galaxyOpacity, setGalaxyOpacity] = useState(0)
  const [showAuralith, setShowAuralith]   = useState(false)
  const [done, setDone]          = useState(false)
  const timerRef                 = useRef(null)
  const startRef                 = useRef(null)

  // Check if we should play
  useEffect(() => {
    try {
      const shown = sessionStorage.getItem(SESSION_KEY)
      if (!shown) setActive(true)
    } catch {
      setActive(true)
    }
  }, [])

  const skip = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setGalaxyOpacity(1)
    setDone(true)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    onComplete?.()
  }, [onComplete])

  // Reduced motion: skip immediately
  useEffect(() => {
    if (!active) return
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (query?.matches) { skip(); return }
  }, [active, skip])

  // Sequence timer
  useEffect(() => {
    if (!active || done) return
    startRef.current = performance.now()

    timerRef.current = setInterval(() => {
      const elapsed = (performance.now() - startRef.current) / 1000

      // Galaxy canvas opacity ramps in starting at T_GATHER
      if (elapsed >= T_GATHER) {
        const ratio = Math.min(1, (elapsed - T_GATHER) / (T_SETTLE - T_GATHER))
        setGalaxyOpacity(ratio)
      }

      if (elapsed >= T_AURALITH && !showAuralith) setShowAuralith(true)

      if (elapsed < T_SPARK)    { setPhase('silence'); return }
      if (elapsed < T_GATHER)   { setPhase('spark');   return }
      if (elapsed < T_NEBULAE)  { setPhase('gather');  return }
      if (elapsed < T_STARS)    { setPhase('nebulae'); return }
      if (elapsed < T_LINKS)    { setPhase('stars');   return }
      if (elapsed < T_AURALITH) { setPhase('links');   return }
      if (elapsed < T_SETTLE)   { setPhase('auralith');return }

      // Done
      setPhase('done')
      setGalaxyOpacity(1)
      setDone(true)
      clearInterval(timerRef.current)
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
      onComplete?.()
    }, 80)

    return () => clearInterval(timerRef.current)
  }, [active, done, onComplete, showAuralith])

  if (!active || done) return null

  const phaseIndex = ['silence','spark','gather','nebulae','stars','links','auralith','done'].indexOf(phase)

  return (
    <>
      {/* Galaxy canvas opacity gate — CSS var injected into parent */}
      <style>{`
        .genesis-galaxy-gate { opacity: ${galaxyOpacity}; transition: opacity 2.2s ease; pointer-events: ${galaxyOpacity < 0.5 ? 'none' : 'auto'}; }
      `}</style>

      {/* Full-screen overlay */}
      <AnimatePresence>
        {phase !== 'done' && (
          <motion.div
            key="genesis-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } }}
            className="pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
            style={{
              background: 'radial-gradient(ellipse at 50% 44%, rgba(9,8,22,0.92) 0%, rgba(3,4,11,0.98) 70%)',
            }}
          >
            {/* Phase: spark — Soul Orb tiny seed */}
            <AnimatePresence>
              {phaseIndex >= 1 && (
                <motion.div
                  key="spark"
                  initial={{ opacity: 0, scale: 0.1 }}
                  animate={{ opacity: [0, 1, 0.6, 1], scale: [0.1, 1.4, 0.9, 1.1] }}
                  transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <div
                    className="h-5 w-5 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, #f9f4ff 0%, #b59cff 40%, #8f75ff 70%, transparent 100%)',
                      boxShadow: '0 0 28px 12px rgba(181,156,255,0.55), 0 0 80px 36px rgba(143,117,255,0.22)',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phase: gather — title text */}
            <AnimatePresence>
              {phaseIndex >= 2 && (
                <motion.div
                  key="title"
                  initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-[28%] left-1/2 -translate-x-1/2 text-center"
                >
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[#b59cff]/60">
                    {isDemo ? 'demo universe' : 'your universe'}
                  </p>
                  <p className="mt-2 text-xl font-black text-white/88">
                    {phaseIndex <= 3 ? 'gathering signal…' :
                     phaseIndex <= 4 ? 'nebulae forming…' :
                     phaseIndex <= 5 ? 'artist stars igniting…' :
                     'links drawing…'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phase: auralith — the meaningful line */}
            <AnimatePresence>
              {showAuralith && (
                <motion.div
                  key="auralith-line"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-[18%] left-1/2 max-w-md -translate-x-1/2 px-6 text-center"
                >
                  <p className="text-sm italic leading-relaxed text-[#9fdcff]/80">
                    "{auralithLine}"
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-[#b59cff]/50">
                    Auralith
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Skip affordance */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: phaseIndex >= 2 ? 0.45 : 0 }}
              whileHover={{ opacity: 0.9 }}
              transition={{ duration: 0.4 }}
              onClick={skip}
              className="absolute bottom-6 right-6 pointer-events-auto rounded-full border border-white/14 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 backdrop-blur"
            >
              Skip
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Utility: wrap the galaxy canvas with the opacity gate class.
 * Call this inside Universe.jsx / Demo.jsx around the canvas container.
 */
export function GenesisGalaxyGate({ children, active }) {
  if (!active) return <>{children}</>
  return <div className="genesis-galaxy-gate h-full w-full">{children}</div>
}

/**
 * Clear the session flag (for testing / debugging).
 */
export function resetGenesisSequence() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}
