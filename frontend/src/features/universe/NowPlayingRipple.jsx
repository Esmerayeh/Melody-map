/**
 * NowPlayingRipple
 * ----------------
 * CSS-based expanding ring that fires from the Soul Orb dock position
 * whenever the currently-playing track ID changes.
 *
 * Pure CSS animation — zero WebGL overhead.
 * Disabled under reducedMotion.
 *
 * Props:
 *   currentTrackId   string | null — changes trigger the ripple
 *   reducedMotion    boolean
 */
import { useEffect, useRef, useState } from 'react'

const RIPPLE_DURATION_MS = 1_500

export default function NowPlayingRipple({ currentTrackId, reducedMotion = false }) {
  const [active, setActive] = useState(false)
  const prevTrackRef = useRef(null)
  const timerRef     = useRef(null)

  useEffect(() => {
    if (!currentTrackId || reducedMotion) return
    if (currentTrackId === prevTrackRef.current) return
    prevTrackRef.current = currentTrackId

    setActive(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActive(false), RIPPLE_DURATION_MS)
  }, [currentTrackId, reducedMotion])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!active) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-14 z-10 sm:top-18"
    >
      {/* Three rings at staggered delays */}
      {[0, 0.28, 0.56].map((delay) => (
        <div
          key={delay}
          className="absolute rounded-full border border-[#9fdcff]/35"
          style={{
            width: 92,
            height: 92,
            top: '50%',
            left: '50%',
            animation: `nowPlayingRipple ${RIPPLE_DURATION_MS}ms ease-out ${delay}s both`,
          }}
        />
      ))}
      <style>{`
        @keyframes nowPlayingRipple {
          0%   { transform: translate(-50%, -50%) scale(0.9); opacity: 0.55; }
          100% { transform: translate(-50%, -50%) scale(3.8); opacity: 0;    }
        }
      `}</style>
    </div>
  )
}
