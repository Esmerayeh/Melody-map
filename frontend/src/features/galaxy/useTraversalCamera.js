/**
 * useTraversalCamera
 * ------------------
 * R3F hook — MUST be used inside a Canvas / R3F context.
 *
 * First-person drift through the galaxy, anchored by click-to-focus so the
 * user can never get lost.
 *
 * Controls:
 *   Drag                 steer the view (OrbitControls rotate, damped)
 *   Scroll / 2-finger    dolly forward / back along the view direction — feeds
 *                        the SAME eased velocity + soft-bounds clamp as WASD, so
 *                        mouse/trackpad-only users travel without touching keys
 *   Click empty space    glide a comfortable distance toward that point (~focus-
 *                        glide easing); star clicks still focus the star
 *   W / S                fly forward / back along view direction
 *   A / D                strafe left / right
 *   Shift                gentle speed boost
 *   R                    recenter to the overview framing
 *   F                    focus the current focusTarget
 *   Space                scan pulse
 *   window event 'galaxy:recenter'      → same as R (dispatched by the HUD button)
 *   window event 'galaxy:glideToward'   → empty-space click glide (detail {x,y,z})
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
const OVERVIEW    = { x: 0, y: 4, z: 22 }

// Scroll / trackpad dolly tuning. deltaY is normalised to a velocity impulse
// fed into the SAME flyVel bucket as WASD (so it shares the easing, the
// MAX_STEP ceiling and the soft bounds). Per-event + accumulator clamps keep a
// fast wheel flick or trackpad swipe from launching the camera.
const SCROLL_SENS        = 0.0018  // velocity per unit of wheel deltaY
const SCROLL_EVENT_CLAMP = 0.2     // max impulse a single wheel event may add
// Empty-space click glide: a comfortable hop toward the clicked direction,
// reusing beginGlide (the focus-glide easing). Not a leap across the galaxy.
const GLIDE_TRAVEL    = 14
const GLIDE_LOOKAHEAD = 14

// Bounded volume: the galaxy lives within ~30 units; soft-pull begins at
// SOFT_START and fully engages by MAX_RADIUS so the user is eased back rather
// than flying off into the void.
const SOFT_START  = 40
const MAX_RADIUS  = 54

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
  const { camera, gl } = useThree()

  const keysRef         = useRef(new Set())
  const flyVelRef       = useRef(new THREE.Vector3())
  const dirRef          = useRef(new THREE.Vector3())   // scratch — reused
  const scratchRef      = useRef(new THREE.Vector3())   // scratch — reused
  const lerpTargetRef   = useRef(new THREE.Vector3())
  const lerpFromRef     = useRef(new THREE.Vector3())
  const returningRef    = useRef(false)
  const lerpTRef        = useRef(0)
  const prevFocusRef    = useRef(null)
  const scrollImpulseRef = useRef(0)  // wheel/trackpad dolly, drained each frame

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

  // ── Mouse / trackpad travel ─────────────────────────────────────────────────
  // Wheel + two-finger swipe = dolly along the view direction (forward when
  // pushing up, back when pulling down). The impulse is drained into flyVel in
  // the frame loop, so it shares WASD's easing, ceiling and soft bounds. Empty-
  // space clicks (dispatched from the scene's background plane) glide a short,
  // eased hop toward the clicked direction so mouse-only users can travel.
  useEffect(() => {
    if (!enabled) return undefined
    const el = gl?.domElement
    if (!el) return undefined

    const onWheel = (e) => {
      if (reducedMotion) return
      e.preventDefault() // own the gesture: no page scroll, no trackpad page-zoom
      // push up (deltaY < 0) → forward; pull down (deltaY > 0) → backward.
      let d = -e.deltaY * SCROLL_SENS
      if (d > SCROLL_EVENT_CLAMP) d = SCROLL_EVENT_CLAMP
      else if (d < -SCROLL_EVENT_CLAMP) d = -SCROLL_EVENT_CLAMP
      let next = scrollImpulseRef.current + d
      if (next > MAX_STEP) next = MAX_STEP
      else if (next < -MAX_STEP) next = -MAX_STEP
      scrollImpulseRef.current = next
    }

    const onGlideToward = (e) => {
      const p = e?.detail
      if (!p) return
      // Direction from the camera to the clicked background point; glide a
      // comfortable distance along it (never past the point) and look ahead.
      const dir = scratchRef.current.set(p.x, p.y, p.z).sub(camera.position)
      const len = dir.length()
      if (len < 1e-3) return
      dir.multiplyScalar(1 / len)
      const travel = Math.min(GLIDE_TRAVEL, len * 0.6)
      beginGlide(
        camera.position.x + dir.x * travel,
        camera.position.y + dir.y * travel,
        camera.position.z + dir.z * travel,
        camera.position.x + dir.x * (travel + GLIDE_LOOKAHEAD),
        camera.position.y + dir.y * (travel + GLIDE_LOOKAHEAD),
        camera.position.z + dir.z * (travel + GLIDE_LOOKAHEAD),
      )
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('galaxy:glideToward', onGlideToward)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('galaxy:glideToward', onGlideToward)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reducedMotion, camera, gl, controlsRef])

  // ── Frame loop — NO allocations ─────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!enabled) return
    const keys  = keysRef.current
    const step  = Math.min(delta * 60, 3)
    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed = FLY_SPEED * (boost ? BOOST_MULT : 1) * step

    // ── WASD accelerate (unchanged) ──
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
      returningRef.current = false
    }

    // ── Scroll / trackpad dolly — drains into the SAME velocity bucket ──
    if (scrollImpulseRef.current !== 0 && !reducedMotion) {
      const fwd = dirRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
      flyVelRef.current.addScaledVector(fwd, scrollImpulseRef.current)
      scrollImpulseRef.current = 0
      returningRef.current = false
    }

    // ── Clamp + integrate (shared by WASD and scroll) ──
    if (flyVelRef.current.length() > MAX_STEP) flyVelRef.current.setLength(MAX_STEP)
    if (flyVelRef.current.lengthSq() > 1e-7) {
      camera.position.add(flyVelRef.current)
      if (controlsRef?.current) controlsRef.current.target.addScaledVector(flyVelRef.current, 1)
    }
    // Decay to a calm stop whenever the keys aren't actively driving — gives
    // scroll its eased coast-out and WASD a brief, soft release (never instant).
    if (!flying || reducedMotion) flyVelRef.current.multiplyScalar(0.88)

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
