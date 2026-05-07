import { create } from 'zustand'

const PROFILE_CACHE_KEY = 'music_profile_cache_v1'
const PROFILE_CACHE_TTL_MS = 1000 * 60 * 60 * 6

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getStoredValue(key, fallback = null) {
  const storage = getStorage()
  if (!storage) return fallback
  try {
    const value = storage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

function setStoredValue(key, value) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(key, value)
  } catch {
    // Ignore storage failures.
  }
}

function getStoredJson(key, fallback = null) {
  const storage = getStorage()
  if (!storage) return fallback
  try {
    const value = storage.getItem(key)
    return value == null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

function removeStoredValue(key) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readCachedProfile() {
  const cached = getStoredJson(PROFILE_CACHE_KEY, null)
  if (!cached?.profile || !cached?.cachedAt) return null
  const age = Date.now() - Number(cached.cachedAt)
  if (!Number.isFinite(age) || age > PROFILE_CACHE_TTL_MS) {
    removeStoredValue(PROFILE_CACHE_KEY)
    return null
  }
  return cached
}

const initialCache = readCachedProfile()

const useProfileStore = create((set) => ({
  profile: initialCache?.profile || null,
  error: null,
  timeRange: getStoredValue('music_profile_time_range', 'medium_term') || 'medium_term',
  cachedAt: initialCache?.cachedAt || null,
  cachedProvider: initialCache?.provider || null,

  setProfile: (profile, meta = {}) => {
    if (profile) {
      const payload = {
        profile,
        cachedAt: Date.now(),
        provider: meta.provider || null,
        timeRange: meta.timeRange || null,
      }
      setStoredValue(PROFILE_CACHE_KEY, JSON.stringify(payload))
      set({ profile, error: null, cachedAt: payload.cachedAt, cachedProvider: payload.provider })
      return
    }

    removeStoredValue(PROFILE_CACHE_KEY)
    set({ profile: null, error: null, cachedAt: null, cachedProvider: null })
  },
  setError: (error) => set({ error: error || null }),
  clearProfile: () => {
    removeStoredValue(PROFILE_CACHE_KEY)
    set({ profile: null, error: null, cachedAt: null, cachedProvider: null })
  },
  setTimeRange: (timeRange) => {
    setStoredValue('music_profile_time_range', timeRange)
    set({ timeRange, profile: null, error: null, cachedAt: null, cachedProvider: null })
  },
}))

export default useProfileStore
