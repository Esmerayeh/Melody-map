import { create } from 'zustand'
import { EMPTY_OBJECT, normalizeGalaxyObject } from './interactionModel.js'

const defaultState = {
  hoveredObject: null,
  focusedObject: null,
  focusTarget: null,
  galaxyMode: 'universal',
  viewMode: 'identity',
  constellationMode: false,
  constellationOrigin: null,
  showTracks: true,
  showMoodRegions: true,
  searchQuery: '',
  nodeData: null,
  layoutData: null,
  motionState: {
    driftStrength: 0.18,
    oscillationStrength: 0.28,
    shimmerStrength: 0.2,
  },
}

const useGalaxyInteractionStore = create((set) => ({
  ...defaultState,

  setHoveredObject: (payload) => set({ hoveredObject: normalizeGalaxyObject(payload) }),
  clearHoveredObject: () => set({ hoveredObject: null }),

  setFocusedObject: (payload) => set((state) => {
    const object = normalizeGalaxyObject(payload)
    return {
      focusedObject: object,
      constellationOrigin: state.constellationMode && object?.type === 'artist' ? object.id : state.constellationMode ? null : state.constellationOrigin,
    }
  }),
  clearFocusedObject: () => set({ focusedObject: null, constellationOrigin: null }),

  setFocusTarget: (target) => set({ focusTarget: target || null }),

  setGalaxyMode: (galaxyMode) => set((state) => ({
    galaxyMode,
    showTracks: galaxyMode === 'song' ? true : galaxyMode === 'genre' ? false : state.showTracks,
    showMoodRegions: galaxyMode === 'artist' || galaxyMode === 'song' ? false : state.showMoodRegions,
    focusedObject: galaxyMode === state.galaxyMode ? state.focusedObject : null,
    hoveredObject: galaxyMode === state.galaxyMode ? state.hoveredObject : null,
    focusTarget: galaxyMode === state.galaxyMode ? state.focusTarget : null,
    constellationOrigin: state.constellationMode && galaxyMode !== 'artist' ? null : state.constellationOrigin,
  })),

  setViewMode: (viewMode) => set((state) => ({
    viewMode,
    constellationMode: viewMode === 'constellation',
    constellationOrigin: viewMode === 'constellation' && state.focusedObject?.type === 'artist'
      ? state.focusedObject.id
      : viewMode === 'constellation'
        ? state.constellationOrigin
        : null,
  })),

  setConstellationMode: (enabled) => set((state) => ({
    constellationMode: !!enabled,
    viewMode: enabled ? 'constellation' : state.viewMode === 'constellation' ? 'identity' : state.viewMode,
    constellationOrigin: enabled && state.focusedObject?.type === 'artist' ? state.focusedObject.id : enabled ? state.constellationOrigin : null,
  })),

  setConstellationOrigin: (id) => set({ constellationOrigin: id || null }),

  toggleTracks: () => set((state) => ({ showTracks: !state.showTracks })),
  toggleMoodRegions: () => set((state) => ({ showMoodRegions: !state.showMoodRegions })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setNodeData: (nodeData) => set({ nodeData: nodeData || null }),
  setLayoutData: (layoutData) => set({ layoutData: layoutData || null }),
  setMotionState: (motionState) => set((state) => ({
    motionState: {
      ...state.motionState,
      ...(motionState || {}),
    },
  })),

  resetGalaxyInteraction: () => set({ ...defaultState }),
}))

export const selectHoveredObject = (state) => state.hoveredObject || EMPTY_OBJECT
export const selectFocusedObject = (state) => state.focusedObject || EMPTY_OBJECT

export default useGalaxyInteractionStore
