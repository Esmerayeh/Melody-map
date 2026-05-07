import { useState } from 'react'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

export default function useBackendWake() {
  const [waking, setWaking] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [message, setMessage] = useState('')
  const [timedOut, setTimedOut] = useState(false)

  const wake = async (redirectUrl) => {
    setWaking(true)
    setTimedOut(false)
    setPhase('health')
    setMessage('Waking the backend and checking the listening service.')

    try {
      await axios.get(`${BASE_URL}/api/health`, { timeout: 15000 })
      setPhase('redirecting')
      setMessage('Backend is warm. Redirecting to Spotify now.')
    } catch (_) {
      setPhase('cold-start')
      setTimedOut(true)
      setMessage('Backend may be cold-starting. We are continuing so auth does not stall.')
    }

    window.location.href = redirectUrl
  }

  return { waking, wake, phase, message, timedOut }
}
