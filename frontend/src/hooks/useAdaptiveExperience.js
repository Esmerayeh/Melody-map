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

    const coarseQuery = window.matchMedia('(pointer: coarse)')
    const smallQuery = window.matchMedia('(max-width: 767px)')
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const update = () => {
      setState({
        isCoarsePointer: coarseQuery.matches,
        isSmallViewport: smallQuery.matches,
        prefersReducedMotion: reduceQuery.matches,
        webglSupported: detectWebglSupport(),
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
      add(smallQuery, update),
      add(reduceQuery, update),
    ]

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  return {
    ...state,
    lowPowerMode: state.isCoarsePointer || state.isSmallViewport || state.prefersReducedMotion,
  }
}
