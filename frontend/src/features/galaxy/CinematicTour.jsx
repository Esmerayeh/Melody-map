/**
 * CinematicTour.jsx
 * -----------------
 * An auto-piloted walkthrough of the REAL galaxy — it drives the existing camera
 * + mode actions (setGalaxyMode / setViewMode / focus glide / recenter) on a timed
 * sequence and shows a caption per beat. No new rendering: it choreographs the
 * actual app graphics so a screen recording is a true product walkthrough.
 *
 * Trigger: the "Play tour" button in Universe, or visiting /universe?tour=1.
 * Reduced motion: still advances captions, but skips the camera glides.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import useGalaxyInteractionStore from './useGalaxyInteractionStore'

const recenter = () => window.dispatchEvent(new CustomEvent('galaxy:recenter'))

export default function CinematicTour({ model, active, onExit, reducedMotion = false }) {
  const setGalaxyMode      = useGalaxyInteractionStore((s) => s.setGalaxyMode)
  const setViewMode        = useGalaxyInteractionStore((s) => s.setViewMode)
  const setFocusTarget     = useGalaxyInteractionStore((s) => s.setFocusTarget)
  const setFocusedObject   = useGalaxyInteractionStore((s) => s.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((s) => s.clearFocusedObject)

  const [step, setStep] = useState(-1)
  const timerRef = useRef(null)

  // Representative bodies pulled from the live model so the tour focuses on the
  // user's ACTUAL data (their top artist + a lead genre).
  const { topArtist, leadGenre } = useMemo(() => {
    const nodes = model?.nodes || []
    const artists = nodes.filter((n) => n.type === 'artist')
    const genres  = nodes.filter((n) => n.type === 'genre')
    const sig = (n) => (n.metrics?.significance ?? n.significance ?? 0)
    return {
      topArtist: artists.slice().sort((a, b) => sig(b) - sig(a))[0] || null,
      leadGenre: genres.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0] || null,
    }
  }, [model])

  const focusNode = useCallback((node) => {
    if (!node) { recenter(); return }
    setFocusedObject({ id: node.id, type: node.type, label: node.label, clusterId: node.clusterId || null })
    setFocusTarget(node.position || null)
  }, [setFocusedObject, setFocusTarget])

  // The choreography. Each beat sets a caption + drives the real scene.
  const steps = useMemo(() => [
    {
      kicker: 'Your universe',
      caption: 'Everything you listen to, rendered as a living galaxy.',
      run: () => { setGalaxyMode('universal'); setViewMode('identity'); clearFocusedObject(); setFocusTarget(null); recenter() },
      hold: 4200,
    },
    {
      kicker: 'Artists are stars',
      caption: topArtist ? `Your brightest anchor — ${topArtist.label}.` : 'Your brightest artists anchor the map.',
      run: () => { setGalaxyMode('artist'); focusNode(topArtist) },
      hold: 4600,
    },
    {
      kicker: 'Genres are nebulae',
      caption: leadGenre ? `Your sound lives in fields like ${leadGenre.label}.` : 'Each genre is a nebula your sound lives in.',
      run: () => { setGalaxyMode('genre'); focusNode(leadGenre) },
      hold: 4600,
    },
    {
      kicker: 'Songs orbit',
      caption: 'Your top tracks ignite as points of light.',
      run: () => { clearFocusedObject(); setFocusTarget(null); setGalaxyMode('song'); recenter() },
      hold: 4400,
    },
    {
      kicker: 'Bridges connect it',
      caption: 'Lanes trace how your taste flows between worlds.',
      run: () => { setGalaxyMode('universal'); setViewMode('constellation'); clearFocusedObject(); setFocusTarget(null); recenter() },
      hold: 4400,
    },
    {
      kicker: 'One identity',
      caption: 'It all resolves into a single shape — yours.',
      run: () => { setGalaxyMode('universal'); setViewMode('identity'); recenter() },
      hold: 4600,
    },
  ], [topArtist, leadGenre, setGalaxyMode, setViewMode, focusNode, clearFocusedObject, setFocusTarget])

  const finish = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStep(-1)
    setGalaxyMode('universal'); setViewMode('identity'); clearFocusedObject(); setFocusTarget(null); recenter()
    onExit?.()
  }, [onExit, setGalaxyMode, setViewMode, clearFocusedObject, setFocusTarget])

  // Start / stop with `active`.
  useEffect(() => {
    if (!active) { if (timerRef.current) clearTimeout(timerRef.current); setStep(-1); return undefined }
    setStep(0)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active])

  // Run the current beat, then schedule the next.
  useEffect(() => {
    if (!active || step < 0) return undefined
    if (step >= steps.length) { finish(); return undefined }
    steps[step].run()
    timerRef.current = setTimeout(() => setStep((s) => s + 1), steps[step].hold)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step])

  if (!active || step < 0 || step >= steps.length) return null
  const beat = steps[step]

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-end pb-28">
      {/* progress dots */}
      <div className="mb-4 flex items-center gap-1.5">
        {steps.map((_, i) => (
          <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 22 : 8, background: i === step ? '#d15296' : 'rgba(235,204,220,0.35)' }} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl rounded-[24px] border px-7 py-5 text-center backdrop-blur-xl"
          style={{ background: 'rgba(34,18,27,0.9)', borderColor: 'rgba(193,19,127,0.3)', boxShadow: '0 18px 60px rgba(0,0,0,0.5)' }}
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#d15296]">{beat.kicker}</p>
          <p className="mt-2 font-display text-2xl leading-snug text-[#faf5f8]">{beat.caption}</p>
        </motion.div>
      </AnimatePresence>
      {/* exit */}
      <button
        type="button"
        onClick={finish}
        className="pointer-events-auto mt-4 flex items-center gap-1.5 rounded-full border border-[#c1337f]/30 bg-[#301725]/80 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#ebccdc] backdrop-blur transition hover:text-[#faf5f8]"
      >
        <X className="h-3 w-3" /> End tour
      </button>
    </div>
  )
}
