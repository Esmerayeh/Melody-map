import { useEffect, useState } from 'react'
import { eventsAPI } from '../services/api'

const EMPTY_SIGNAL = {
  eventCount: 0,
  sessionIntensity: 0,
  noveltyScore: 0,
  repeatScore: 0,
  activeTracks: [],
  recentEvents: [],
  updatedAt: null,
}

export default function useLiveTasteSignal({ enabled = true, pollMs = 12000 } = {}) {
  const [signal, setSignal] = useState(EMPTY_SIGNAL)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    let timerId = null

    const load = async () => {
      try {
        const response = await eventsAPI.getLiveSignal()
        if (cancelled) return
        setSignal(response?.data?.liveSignal || EMPTY_SIGNAL)
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setError(err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          timerId = window.setTimeout(load, pollMs)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      if (timerId) window.clearTimeout(timerId)
    }
  }, [enabled, pollMs])

  return {
    signal,
    loading,
    error,
    hasLiveSignal: signal.eventCount > 0,
  }
}
