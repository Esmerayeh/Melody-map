import { useEffect, useRef } from 'react'
import { create } from 'zustand'

/**
 * useGalaxyStage
 * --------------
 * Shared "stage" for the ONE persistent galaxy canvas.
 *
 * The immersive shell mounts a single <GalaxyScene> once, in a fixed full-viewport
 * layer that lives ABOVE the route swap (so it never remounts on navigation).
 * Each route that wants to drive the galaxy publishes its props here on mount and
 * resets on unmount, via the `useGalaxyStageConfig` helper below. Routes that do
 * not publish leave the last config in place → the galaxy persists as an ambient
 * backdrop everywhere.
 *
 * This carries PRESENTATION props only (model, motion flags, per-page extras like
 * comets/traversal). It does not fetch data or own the scene internals.
 */
const DEFAULT_STAGE = {
  active: false,               // true once a route has opted into the persistent canvas
  model: null,                 // null → ambient backdrop (stars/nebulae/core, no data nodes)
  sparseMode: false,
  lowPower: false,
  reducedMotion: false,
  webglEnabled: true,
  traversalEnabled: false,
  scanPulseCount: 0,
  onScanPulse: null,
  autoRotateSpeed: 0.18,
  extraChildren: null,         // React node rendered inside the shared Canvas (comets, etc.)
}

const useGalaxyStage = create((set) => ({
  ...DEFAULT_STAGE,
  setStage: (partial) => set((state) => ({ ...state, ...(partial || {}) })),
  resetStage: () => set({ ...DEFAULT_STAGE }),
}))

// Presentation fields only (everything except `active`). Used as the "ambient
// backdrop" config a route falls back to on unmount — the persistent canvas
// keeps rendering stars/nebulae/core with no data nodes.
const AMBIENT_PRESENTATION = {
  model: null,
  sparseMode: false,
  lowPower: false,
  reducedMotion: false,
  webglEnabled: true,
  traversalEnabled: false,
  scanPulseCount: 0,
  onScanPulse: null,
  autoRotateSpeed: 0.18,
  extraChildren: null,
}

/**
 * useGalaxyStageConfig
 * --------------------
 * A route opts into the persistent galaxy canvas by calling this on mount with
 * its scene config. The config is published to the stage store (and `active` is
 * flipped on) whenever `deps` change.
 *
 * On unmount the stage is SOFT-reset to the ambient backdrop but `active` stays
 * true — so navigating between routes never tears down and remounts the single
 * shared <Canvas>. The next route simply publishes its own model over the top.
 *
 * `config` is read through a ref so callers can pass a fresh object literal each
 * render; only `deps` decide when a republish happens (avoids render loops).
 */
export function useGalaxyStageConfig(config, deps = []) {
  const setStage = useGalaxyStage((s) => s.setStage)
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    setStage({ active: true, ...configRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => () => {
    setStage({ ...AMBIENT_PRESENTATION, active: true })
  }, [setStage])
}

export default useGalaxyStage
