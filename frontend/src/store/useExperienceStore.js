import { create } from 'zustand'

const DEFAULT_LOADING = {
  profile: false,
  route: false,
  scene: false,
}

const DEFAULT_CONFIDENCE = {
  overall: 'soft signal',
  analytics: 'soft signal',
  identity: 'soft signal',
  galaxy: 'soft signal',
  soulmate: 'soft signal',
  degraded: false,
  hasAudioProfile: false,
  profileReady: false,
}

const useExperienceStore = create((set) => ({
  activeMode: 'dashboard',
  hoveredObject: null,
  selectedObject: null,
  loadingState: DEFAULT_LOADING,
  dataConfidence: DEFAULT_CONFIDENCE,
  routeContext: {
    pathname: '/',
    search: '',
  },

  setActiveMode: (activeMode) => set({ activeMode }),
  setHoveredObject: (hoveredObject) => set({ hoveredObject: hoveredObject || null }),
  setSelectedObject: (selectedObject) => set({ selectedObject: selectedObject || null }),
  setLoadingState: (loadingState) => set((state) => ({
    loadingState: {
      ...state.loadingState,
      ...(loadingState || {}),
    },
  })),
  setDataConfidence: (dataConfidence) => set((state) => ({
    dataConfidence: {
      ...state.dataConfidence,
      ...(dataConfidence || {}),
    },
  })),
  setRouteContext: (routeContext) => set((state) => ({
    routeContext: {
      ...state.routeContext,
      ...(routeContext || {}),
    },
  })),
}))

export default useExperienceStore
