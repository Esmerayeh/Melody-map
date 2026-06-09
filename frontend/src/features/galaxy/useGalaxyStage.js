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

export default useGalaxyStage
