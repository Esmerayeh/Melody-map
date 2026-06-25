/**
 * GalaxyAudioController
 * ---------------------
 * The DOM-side glue for the galaxy ambient audio (isolated from the 3D scene):
 *
 *   • Arms a one-time user-gesture listener that creates/resumes the AudioContext
 *     and fades the ambient pad in (respecting autoplay policy — no console errors).
 *   • Plays a soft tone on the rising edge of hover / click-select by subscribing
 *     to the interaction store (event-driven — NOT per frame).
 *   • Renders an obvious, persistent mute/unmute control, portalled to <body> so
 *     it's clickable + accessible (the galaxy stage itself is z-0 + aria-hidden).
 *
 * Reduced motion (or a separate muted preference) means NO audio at all — the
 * context is never even created. Sound is never forced on.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Volume2, VolumeX } from 'lucide-react'
import useGalaxyInteractionStore from './useGalaxyInteractionStore'
import useGalaxyAudioStore from './useGalaxyAudioStore'
import { resumeOnGesture, setMuted, playHover, playSelect } from './galaxyAudio'

export default function GalaxyAudioController({ reducedMotion = false }) {
  const muted = useGalaxyAudioStore((state) => state.muted)
  const toggleMuted = useGalaxyAudioStore((state) => state.toggleMuted)
  // Reduced motion is a hard off-switch for audio (per spec).
  const audioOff = reducedMotion

  // Keep the engine's mute in sync (forced off under reduced motion).
  useEffect(() => {
    setMuted(audioOff || muted)
  }, [audioOff, muted])

  // Arm a one-time gesture to unlock + start the ambient pad. Skipped entirely
  // under reduced motion, so the AudioContext is never created.
  useEffect(() => {
    if (audioOff) return
    let armed = true
    const onGesture = () => {
      if (!armed) return
      armed = false
      resumeOnGesture()
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [audioOff])

  // Event-driven tones: fire on the rising edge of a new hovered / focused id.
  useEffect(() => {
    if (audioOff) return
    const unsubscribe = useGalaxyInteractionStore.subscribe((state, prev) => {
      const h = state.hoveredObject?.id || null
      if (h && h !== (prev.hoveredObject?.id || null)) playHover()
      const f = state.focusedObject?.id || null
      if (f && f !== (prev.focusedObject?.id || null)) playSelect()
    })
    return unsubscribe
  }, [audioOff])

  if (audioOff || typeof document === 'undefined') return null

  return createPortal(
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={muted ? 'Turn on galaxy ambient sound' : 'Mute galaxy ambient sound'}
      aria-pressed={!muted}
      title={muted ? 'Galaxy sound: off' : 'Galaxy sound: on'}
      className="fixed z-40 flex h-11 w-11 items-center justify-center rounded-full border bg-[#120b06]/80 text-[#ffd9a0] shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:bg-[#1a0f07]/85"
      style={{
        // z-40: below modals (z-50) and the dock, above canvas/HUD content (was z-[70],
        // which let it sit over the nav/dock). Safe-area insets keep it off the OS taskbar.
        bottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
        left: 'calc(1.25rem + env(safe-area-inset-left))',
        borderColor: muted ? 'rgba(255,217,160,0.22)' : 'rgba(255,206,138,0.55)',
        boxShadow: muted ? undefined : '0 0 18px rgba(255,206,138,0.25)',
      }}
    >
      {muted ? <VolumeX className="h-5 w-5 opacity-70" /> : <Volume2 className="h-5 w-5" />}
    </button>,
    document.body,
  )
}
