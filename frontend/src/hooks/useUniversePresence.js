/**
 * useUniversePresence
 * -------------------
 * Tracks the user's presence state inside /universe.
 *
 * States:
 *   active   — user is interacting (recent mouse/touch/key)
 *   idle     — no interaction for ~22s; HUD subtly dims
 *   sleeping — no interaction for 80s; HUD minimised, camera drifts slowly
 *   waking   — 1.2s transition back to active after sleeping
 *
 * Reduced motion:
 *   - driftSpeed stays 0 (no camera drift ever)
 *   - waking transition is instant (no animated fade)
 *
 * Usage:
 *   const presence = useUniversePresence({ reducedMotion, enabled })
 *   presence.hudOpacity   // 1 | 0.12
 *   presence.driftSpeed   // 0.18 | 0.06 | 0
 *   presence.isSleeping   // boolean
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_MS   = 22_000          // 22s → idle
const SLEEP_MS  = 80_000          // 80s total → sleeping
const WAKE_MS   = 1_200           // waking transition

export default function useUniversePresence({ reducedMotion = false, enabled = true } = {}) {
  const [presenceState, setPresenceState] = useState('active')
  const stateRef   = useRef('active')
  const idleTimer  = useRef(null)
  const sleepTimer = useRef(null)
  const wakeTimer  = useRef(null)

  const clearAll = useCallback(() => {
    clearTimeout(idleTimer.current)
    clearTimeout(sleepTimer.current)
    clearTimeout(wakeTimer.current)
  }, [])

  const scheduleIdle = useCallback(() => {
    clearAll()
    idleTimer.current = setTimeout(() => {
      stateRef.current = 'idle'
      setPresenceState('idle')
      sleepTimer.current = setTimeout(() => {
        stateRef.current = 'sleeping'
        setPresenceState('sleeping')
      }, SLEEP_MS - IDLE_MS)
    }, IDLE_MS)
  }, [clearAll])

  const handleActivity = useCallback(() => {
    if (!enabled) return
    const prev = stateRef.current

    if (prev === 'sleeping') {
      stateRef.current = 'waking'
      setPresenceState('waking')
      clearAll()
      wakeTimer.current = setTimeout(() => {
        stateRef.current = 'active'
        setPresenceState('active')
        scheduleIdle()
      }, reducedMotion ? 0 : WAKE_MS)
    } else if (prev !== 'waking') {
      if (prev !== 'active') {
        stateRef.current = 'active'
        setPresenceState('active')
      }
      scheduleIdle()
    }
  }, [enabled, reducedMotion, clearAll, scheduleIdle])

  useEffect(() => {
    if (!enabled) return undefined
    const events = ['mousemove', 'mousedown', 'touchstart', 'touchmove', 'keydown', 'wheel', 'pointerdown']
    const opts   = { passive: true }
    events.forEach((ev) => window.addEventListener(ev, handleActivity, opts))
    scheduleIdle()   // start countdown immediately on mount
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity, opts))
      clearAll()
    }
  }, [enabled, handleActivity, scheduleIdle, clearAll])

  const isSleeping = presenceState === 'sleeping'
  const isWaking   = presenceState === 'waking'
  const isIdle     = presenceState === 'idle'

  return {
    presenceState,
    isActive:    presenceState === 'active',
    isIdle,
    isSleeping,
    isWaking,
    // HUD: full opacity normally, nearly invisible when sleeping
    hudOpacity:    isSleeping ? 0.12 : isWaking ? 0.5 : 1,
    // True when non-essential HUD should be hidden
    hudDimmed:     isSleeping,
    // Camera auto-rotate speed (0 = no drift)
    driftSpeed:    reducedMotion ? 0 : isSleeping ? 0.06 : 0.18,
    // Label density hint for GalaxyScene
    labelDensity:  isSleeping ? 'sparse' : 'normal',
  }
}
