import { useState } from 'react'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Pings /api/health to wake the Render backend before redirecting.
 * Returns { waking, wake } where wake(redirectUrl) handles the full flow.
 */
export default function useBackendWake() {
  const [waking, setWaking] = useState(false)

  const wake = async (redirectUrl) => {
    setWaking(true)
    try {
      await axios.get(`${BASE_URL}/api/health`, { timeout: 30000 })
    } catch (_) {
      // backend may still be starting — proceed anyway
    }
    window.location.href = redirectUrl
  }

  return { waking, wake }
}
