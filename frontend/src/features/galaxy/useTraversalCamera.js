/**
 * useTraversalCamera
 * ------------------
 * R3F hook — MUST be used inside a Canvas / R3F context.
 *
 * First-person drift through the galaxy, anchored by click-to-focus so the
 * user can never get lost.
 *
 * Controls:
 *   Drag           steer the view (OrbitControls rotate, damped)
 *   Scroll         dolly forward / back (OrbitControls zoom)
 *   W / S          fly forward / back along view direction
 *   A / D          strafe left / right
 *   Shift          gentle speed boost
 *   R              recenter to the overview framing
 *   F              focus the current focusTarget
 *   Space          scan pulse
 *   window event 'galaxy:recenter'  → same as R (dispatched by the HUD button)
 *
 * Design rules (per the r3f + universe skills):
 *   - NO per-frame allocations: all vectors are reused refs, lerped in place.
 *   - No React state in the frame loop.
 *   - Everything eased — accelerate/decelerate, never instant. Dreamy, calm.
 *   - Speed is clamped to a calm ceiling (drifting through fog, not racing).
 *   - Position is SOFT-bounded to a sphere: fly to the edge and you are gently
 *     eased back, never hard-stopped, never lost in empty black.
 *   - reducedMotion: free-flight drift disabled; click-to-focus still glides,
 *     gently and briefly. Vestibular safety.
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const FLY_SPEED   = 0.14    // base units/frame at 60fps — calm
const BOOST_MULT  = 2.4
const FLY_LERP    = 0.12    // velocity easing (accel/decel)
const MAX_STEP    = 0.42    // hard speed ceiling per frame (calm drift)
const RETURN_LERP = 0.05    // slow, cinematic recenter/focus glide
const OVERVIEW    = { x: 0, y: 10, z: 55 }   // recenter framing, scaled to the SPREAD_SCALE galaxy

// Bounded volume: with SPREAD_SCALE=2.5 the galaxy lives within ~70 units, so
// the soft-pull must begin well OUTSIDE that — otherwise flying outward stops
// before you can pull back to see the whole thing. Soft-pull begins at
// SOFT_START (past the galaxy, past OrbitControls maxDistance 150) and fully
// engages by MAX_RADIUS, easing the user back rather than flinging into void.
const SOFT_START  = 160
const MAX_RADIUS  = 200

/**
 * Pure, testable: how strongly to ease the camera back toward the bounded
 * shell. 0 while inside SOFT_START, ramps to 1 by MAX_RADIUS.
 */
export function softBoundEase(distance, softStart = SOFT_START, maxRadius = MAX_RADIUS) {
  if (!(distance > softStart)) return 0
  return Math.min(1, (distance - softStart) / Math.max(maxRadius - softStart, 1e-3))
}

export function useTraversalCamera({
  controlsRef,
  focusTarget,      // { x, y, z } | null
  onScanPulse,      // () => void
  reducedMotion = false,
  enabled       = true,
}) {
  const { camera } = useThree()

  const keysRef       = useRef(new Set())
  const flyVelRef     = useRef(new THREE.Vector3())
  const dirRef        = useRef(new THREE.Vector3())   // scratch — reused
  const scratchRef    = useRef(new THREE.Vector3())   // scratch — reused
  const lerpTargetRef = useRef(new THREE.Vector3())
  const lerpFromRef   = useRef(new THREE.Vector3())
  const returningRef  = useRef(false)
  const lerpTRef      = useRef(0)
  const prevFocusRef  = useRef(null)

  const beginGlide = (toX, toY, toZ, targetX, targetY, targetZ) => {
    lerpFromRef.current.copy(camera.position)
    lerpTargetRef.current.set(toX, toY, toZ)
    lerpTRef.current = 0
    returningRef.current = true
    if (controlsRef?.current) controlsRef.current.target.set(targetX, targetY, targetZ)
  }

  const recenter = () => beginGlide(OVERVIEW.x, OVERVIEW.y, OVERVIEW.z, 0, 0, 0)

  // ── Keyboard + recenter event ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined

    const onDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      keysRef.current.add(e.code)

      if (e.code === 'KeyR') recenter()
      if (e.code === 'KeyF' && focusTarget) {
        beginGlide(focusTarget.x + 8, focusTarget.y + 4, focusTarget.z + 10, focusTarget.x, focusTarget.y, focusTarget.z)
      }
      if (e.code === 'Space') { e.preventDefault(); onScanPulse?.() }
    }
    const onUp = (e) => keysRef.current.delete(e.code)
    const onRecenter = () => recenter()

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('galaxy:recenter', onRecenter)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('galaxy:recenter', onRecenter)
      keysRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusTarget, camera, controlsRef, onScanPulse])

  // ── focusTarget change → smooth glide (click-to-focus, works mid-flight) ────
  useEffect(() => {
    if (!enabled || !focusTarget) return
    const key = `${focusTarget.x},${focusTarget.y},${focusTarget.z}`
    if (key === prevFocusRef.current) return
    prevFocusRef.current = key
    beginGlide(focusTarget.x + 8, focusTarget.y + 4, focusTarget.z + 10, focusTarget.x, focusTarget.y, focusTarget.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusTarget])

  // ── Frame loop — NO allocations ─────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!enabled) return
    const keys  = keysRef.current
    const step  = Math.min(delta * 60, 3)
    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed = FLY_SPEED * (boost ? BOOST_MULT : 1) * step

    const flying = keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD')
    if (flying && !reducedMotion) {
      const dir = dirRef.current.set(0, 0, 0)
      if (keys.has('KeyW')) dir.z -= 1
      if (keys.has('KeyS')) dir.z += 1
      if (keys.has('KeyA')) dir.x -= 1
      if (keys.has('KeyD')) dir.x += 1
      if (dir.lengthSq() > 0) {
        dir.normalize().applyQuaternion(camera.quaternion).multiplyScalar(speed)
        flyVelRef.current.lerp(dir, FLY_LERP)
      }
      // Clamp to a calm ceiling.
      if (flyVelRef.current.length() > MAX_STEP) flyVelRef.current.setLength(MAX_STEP)
      camera.position.add(flyVelRef.current)
      if (controlsRef?.current) controlsRef.current.target.addScaledVector(flyVelRef.current, 1)
      returningRef.current = false
    } else {
      flyVelRef.current.multiplyScalar(0.88) // decay to a stop
    }

    // Soft bounds — ease back toward the shell instead of hard-stopping.
    const dist = camera.position.length()
    const ease = softBoundEase(dist)
    if (ease > 0) {
      const pull = scratchRef.current.copy(camera.position).setLength(SOFT_START)
      camera.position.lerp(pull, ease * 0.06)
      if (controlsRef?.current) controlsRef.current.target.multiplyScalar(1 - ease * 0.02)
      flyVelRef.current.multiplyScalar(1 - ease * 0.4)
    }

    // Recenter / focus glide.
    if (returningRef.current) {
      lerpTRef.current = Math.min(lerpTRef.current + delta * RETURN_LERP * (reducedMotion ? 6 : 3.5), 1)
      const t = easeOutCubic(lerpTRef.current)
      camera.position.lerpVectors(lerpFromRef.current, lerpTargetRef.current, t)
      if (lerpTRef.current >= 1) returningRef.current = false
    }

    if (controlsRef?.current) controlsRef.current.update()
  })
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}
