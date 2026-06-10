/**
 * useGalaxyAudioStore
 * -------------------
 * Persisted mute preference for the galaxy ambient audio. Default is sound ON
 * (the North Star's "ambient pad fading in" land beat), but it never actually
 * plays until a user gesture (see galaxyAudio.resumeOnGesture) and reduced-motion
 * forces it off in the controller. The preference survives reloads via
 * localStorage.
 */
import { create } from 'zustand'

const STORAGE_KEY = 'melodymap.galaxyAudioMuted'

function readInitialMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const useGalaxyAudioStore = create((set) => ({
  muted: readInitialMuted(),
  toggleMuted: () => set((state) => {
    const muted = !state.muted
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
    return { muted }
  }),
}))

export default useGalaxyAudioStore
