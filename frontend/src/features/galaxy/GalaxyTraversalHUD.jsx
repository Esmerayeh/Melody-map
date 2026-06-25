/**
 * GalaxyTraversalHUD
 * ------------------
 * Small DOM overlay for the traversable galaxy: a Recenter lifeline, a Drift
 * (release focus → resume free flight) button, and a one-line controls hint.
 * Rendered by the galaxy routes over the persistent canvas. No 3D here — it
 * only dispatches the 'galaxy:recenter' event the camera hook listens for and
 * clears focus through the interaction store.
 */
import useGalaxyInteractionStore from './useGalaxyInteractionStore'

export default function GalaxyTraversalHUD({ reducedMotion = false, coarsePointer = false }) {
  const setFocusTarget = useGalaxyInteractionStore((s) => s.setFocusTarget)
  const clearFocusedObject = useGalaxyInteractionStore((s) => s.clearFocusedObject)
  const focusedObject = useGalaxyInteractionStore((s) => s.focusedObject)

  const recenter = () => {
    window.dispatchEvent(new CustomEvent('galaxy:recenter'))
    setFocusTarget(null)
    clearFocusedObject()
  }
  const drift = () => {
    setFocusTarget(null)
    clearFocusedObject()
  }

  const hint = coarsePointer
    ? 'Drag to look · pinch to zoom · tap a star to focus'
    : reducedMotion
      ? 'Drag to look · scroll to move · click a star to focus'
      : 'Drag to look · W/S/A/D to fly · E/Q up·down · scroll to move · click a star to focus'

  return (
    // Raised to clear the bottom dock/tab bar (which sits at bottom-3) — at bottom-5
    // the controls hint overlapped the dock icons. Now it floats just above it.
    <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={recenter}
          className="pointer-events-auto touch-target rounded-full border border-[#c1337f]/35 bg-[#301725]/80 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-[#ebccdc] shadow-[0_18px_40px_rgba(3,4,15,0.4)] backdrop-blur-xl transition-colors hover:border-[#c1337f]/55 hover:text-[#faf5f8]"
          aria-label="Recenter the galaxy view"
        >
          ◎ Recenter
        </button>
        {focusedObject ? (
          <button
            type="button"
            onClick={drift}
            className="pointer-events-auto touch-target rounded-full border border-[#c1337f]/30 bg-[#301725]/80 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-[#ebccdc] shadow-[0_18px_40px_rgba(3,4,15,0.4)] backdrop-blur-xl transition-colors hover:border-[#c1337f]/50 hover:text-[#faf5f8]"
            aria-label="Release focus and resume drifting"
          >
            ✦ Drift
          </button>
        ) : null}
      </div>
      <p className="rounded-full border border-[#c1337f]/20 bg-[#301725]/85 px-3 py-1 text-[10px] tracking-[0.08em] text-[#ebccdc] backdrop-blur-md">
        {hint}
      </p>
    </div>
  )
}
