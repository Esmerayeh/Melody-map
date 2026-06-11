/**
 * useAdaptiveExperience
 * ---------------------
 * Detects device/preference capabilities and returns granular flags.
 *
 * Legacy consumers that read `lowPowerMode` still work — it maps to
 * `sparseGraphics || reducedMotion`. New consumers should prefer
 * the individual flags so they can make context-specific decisions.
 *
 *   reducedMotion   — honour prefers-reduced-motion; disable animation loops
 *   sparseGraphics  — small/touch device; reduce GPU load (stars, particles)
 *   touchDevice     — coarse pointer; adjust interaction hints
 *   lowPowerMode    — legacy alias: reducedMotion || sparseGraphics
 *   webglSupported  — canvas/WebGL available
 */
import { useEffect, useState } from 'react'

function detectWebglSupport() {
  if (typeof document === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return Boolean(gl)
  } catch {
    return false
  }
}

export default function useAdaptiveExperience() {
  const [state, setState] = useState({
    isCoarsePointer: false,
    isSmallViewport: false,
    prefersReducedMotion: false,
    webglSupported: true,
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const coarseQuery  = window.matchMedia('(pointer: coarse)')
    const smallQuery   = window.matchMedia('(max-width: 767px)')
    const reduceQuery  = window.matchMedia('(prefers-reduced-motion: reduce)')

    const update = () => {
      setState({
        isCoarsePointer:       coarseQuery.matches,
        isSmallViewport:       smallQuery.matches,
        prefersReducedMotion:  reduceQuery.matches,
        webglSupported:        detectWebglSupport(),
      })
    }

    update()

    const add = (query, listener) => {
      if (query.addEventListener) {
        query.addEventListener('change', listener)
        return () => query.removeEventListener('change', listener)
      }
      query.addListener(listener)
      return () => query.removeListener(listener)
    }

    const cleanups = [
      add(coarseQuery, update),
      add(smallQuery,  update),
      add(reduceQuery, update),
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [])

  // ── Granular flags ─────────────────────────────────────────────────────────
  const reducedMotion  = state.prefersReducedMotion
  const sparseGraphics = state.isCoarsePointer || state.isSmallViewport
  const touchDevice    = state.isCoarsePointer

  return {
    // granular (prefer these in new code)
    reducedMotion,
    sparseGraphics,
    touchDevice,
    webglSupported: state.webglSupported,
    isSmallViewport: state.isSmallViewport,
    // legacy alias (kept so existing consumers compile without change)
    isCoarsePointer:      state.isCoarsePointer,
    prefersReducedMotion: state.prefersReducedMotion,
    lowPowerMode:         reducedMotion || sparseGraphics,
  }
}
