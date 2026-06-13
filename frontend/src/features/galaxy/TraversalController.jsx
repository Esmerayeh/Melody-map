/**
 * TraversalController
 * -------------------
 * R3F component — must be rendered inside a Canvas.
 * Combines useTraversalCamera (keyboard/WASD/return/focus/tour)
 * and ScanPulseEffect (Space-key ring shockwave).
 *
 * Receives controlsRef from the parent SceneContents so it can
 * cooperate with OrbitControls without fighting it.
 */
import { Suspense, useEffect } from 'react'
import { useTraversalCamera } from './useTraversalCamera'
import ScanPulseEffect from './ScanPulseEffect'

function TraversalBrain({ controlsRef, focusTarget, scanPulseCount, onScanPulse, reducedMotion, enabled }) {
  // Defensive mount assertion: confirms the fly-through controller actually
  // mounted and is driving the camera (this change can't be screenshot-tested).
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info('[TRAVERSAL] camera controller mounted', { enabled, reducedMotion })
  }, [enabled, reducedMotion])

  useTraversalCamera({ controlsRef, focusTarget, onScanPulse, reducedMotion, enabled })
  return (
    <ScanPulseEffect triggerCount={scanPulseCount} reducedMotion={reducedMotion} />
  )
}

export default function TraversalController(props) {
  if (!props.enabled) return null
  return (
    <Suspense fallback={null}>
      <TraversalBrain {...props} />
    </Suspense>
  )
}
