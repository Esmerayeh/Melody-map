import { useEffect } from 'react'
import useStore from '../store/useStore'
import { applyVibeTheme, resetVibeTheme } from '../services/vibeTheme'

export default function VibeBridge() {
  const aestheticState = useStore((s) => s.aestheticState)
  const vibeFeatures = useStore((s) => s.vibeFeatures)

  useEffect(() => {
    if (vibeFeatures?.energy != null && vibeFeatures?.valence != null) {
      applyVibeTheme(vibeFeatures.energy, vibeFeatures.valence)
    } else if (aestheticState?.palette?.length >= 2) {
      const root = document.documentElement
      root.style.setProperty('--color-brand-purple', aestheticState.palette[0])
      root.style.setProperty('--color-brand-pink', aestheticState.palette[1])
      root.style.setProperty('--color-brand-blue', aestheticState.palette[2] || aestheticState.palette[0])
    } else {
      resetVibeTheme()
    }
  }, [vibeFeatures, aestheticState])

  return null
}
