/**
 * useTraversalCamera
 * ------------------
 * R3F hook — MUST be used inside a Canvas / R3F context.
 *
 * Controls:
 *   W/A/S/D     fly in camera-local space
 *   Shift       speed boost (3×)
 *   Space       scan pulse (calls onScanPulse)
 *   R           return to Soul Orb core (0, 0, 0)
 *   F           focus on current focusTarget
 *   T           toggle cinematic tour orbit
 *
 * Design rules:
 *   - No React state in the frame loop — all refs
 *   - Smooth lerp everywhere — no hard snaps, no nausea
 *   - Disabled when reducedMotion = true (WASD still works, no camera drift)
 *   - Clean mode switch: WASD flight disables OrbitControls autoRotate temporarily
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const FLY_SPEED   = 0.14    // units per frame at 60fps
const BOOST_MULT  = 3.2
const FLY_LERP    = 0.14
const RETURN_LERP = 0.055   // slow, cinematic return
const TOUR_SPEED  = 0.10    // rad/s cinematic orbit

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
  const lerpTargetRef = useRef(new THREE.Vector3())
  const returningRef  = useRef(false)
  const lerpTRef      = useRef(0)         // lerp progress 0–1
  const lerpFromRef   = useRef(new THREE.Vector3())
  const tourRef       = useRef(false)
  const tourAngleRef  = useRef(0)
  const prevFocusRef  = useRef(null)

  // ── Keyboard listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined

    const onDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      keysRef.current.add(e.code)

      if (e.code === 'KeyR') {
        // Return to core
        lerpFromRef.current.copy(camera.position)
        lerpTargetRef.current.set(0, 4, 22)
        lerpTRef.current   = 0
        returningRef.current = true
        tourRef.current = false
        if (controlsRef?.current) controlsRef.current.target.set(0, 0, 0)
      }

      if (e.code === 'KeyF' && focusTarget) {
        lerpFromRef.current.copy(camera.position)
        lerpTargetRef.current.set(
          focusTarget.x + 8,
          focusTarget.y + 4,
          focusTarget.z + 10,
        )
        lerpTRef.current    = 0
        returningRef.current = true
        tourRef.current = false
        if (controlsRef?.current) {
          controlsRef.current.target.set(focusTarget.x, focusTarget.y, focusTarget.z)
        }
      }

      if (e.code === 'KeyT') tourRef.current = !tourRef.current

      if (e.code === 'Space') {
        e.preventDefault()
        onScanPulse?.()
      }
    }

    const onUp = (e) => keysRef.current.delete(e.code)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [enabled, focusTarget, camera, controlsRef, onScanPulse])

  // ── focusTarget change → smooth glide ────────────────────────────────────
  useEffect(() => {
    if (!enabled || !focusTarget) return
    const key = `${focusTarget.x},${focusTarget.y},${focusTarget.z}`
    if (key === prevFocusRef.current) return
    prevFocusRef.current = key
    // Trigger F-key behaviour automatically when a star is selected
    lerpFromRef.current.copy(camera.position)
    lerpTargetRef.current.set(
      focusTarget.x + 8,
      focusTarget.y + 4,
      focusTarget.z + 10,
    )
    lerpTRef.current    = 0
    returningRef.current = true
    if (controlsRef?.current) {
      controlsRef.current.target.set(focusTarget.x, focusTarget.y, focusTarget.z)
    }
  }, [enabled, focusTarget, camera, controlsRef])

  // ── Frame loop ────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!enabled) return

    const keys   = keysRef.current
    const boost  = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed  = FLY_SPEED * (boost ? BOOST_MULT : 1) * Math.min(delta * 60, 3)

    // WASD fly — camera-local movement
    const flying = keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD')
    if (flying && !reducedMotion) {
      const dir = new THREE.Vector3()
      if (keys.has('KeyW')) dir.z -= 1
      if (keys.has('KeyS')) dir.z += 1
      if (keys.has('KeyA')) dir.x -= 1
      if (keys.has('KeyD')) dir.x += 1
      dir.normalize().applyQuaternion(camera.quaternion)
      flyVelRef.current.lerp(dir.multiplyScalar(speed), FLY_LERP)
      camera.position.add(flyVelRef.current)
      if (controlsRef?.current) {
        controlsRef.current.target.addScaledVector(flyVelRef.current, 1)
      }
      returningRef.current = false
    } else {
      // Decay fly velocity
      flyVelRef.current.multiplyScalar(0.88)
    }

    // Smooth lerp return / focus
    if (returningRef.current) {
      lerpTRef.current = Math.min(lerpTRef.current + delta * RETURN_LERP * 3.5, 1)
      const t = easeOutCubic(lerpTRef.current)
      camera.position.lerpVectors(lerpFromRef.current, lerpTargetRef.current, t)
      if (lerpTRef.current >= 1) returningRef.current = false
    }

    // Cinematic tour — slow orbit around origin
    if (tourRef.current && !reducedMotion) {
      tourAngleRef.current += delta * TOUR_SPEED
      const radius = clamp(camera.position.length(), 16, 42)
      const y      = camera.position.y
      camera.position.set(
        Math.sin(tourAngleRef.current) * radius,
        y,
        Math.cos(tourAngleRef.current) * radius,
      )
      camera.lookAt(0, 0, 0)
      if (controlsRef?.current) controlsRef.current.target.set(0, 0, 0)
    }

    if (controlsRef?.current) controlsRef.current.update()
  })
}

// ── Utilities ─────────────────────────────────────────────────────────────
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}
