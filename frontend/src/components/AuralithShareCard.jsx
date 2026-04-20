import { useCallback, useMemo, useRef } from 'react'
import html2canvas from 'html2canvas'
import { Download, Copy, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BrandMark, BrandWatermark } from './brand/BrandSystem'

function collectHighlights(result) {
  const pools = [
    result?.dominant_traits,
    result?.hidden_patterns,
    result?.exploration_suggestions,
    result?.strengths,
    result?.similar_vibe,
  ]

  return pools.flatMap((items) => items || []).filter(Boolean).slice(0, 3)
}

function createShareText(session, profileName) {
  const lines = [
    `Melody Map | Auralith Session`,
    `${profileName} | ${session.moduleLabel}`,
    session.title,
    '',
    session.summary,
  ]

  if (session.prompt) {
    lines.push('', `Prompt: ${session.prompt}`)
  }

  return lines.join('\n')
}

export default function AuralithShareCard({ session, profileName = 'your listening world' }) {
  const cardRef = useRef(null)
  const highlights = useMemo(() => collectHighlights(session?.result), [session])

  const captureCard = useCallback(async () => {
    if (!cardRef.current) return null
    return html2canvas(cardRef.current, {
      backgroundColor: '#070814',
      scale: 2,
      useCORS: true,
      logging: false,
    })
  }, [])

  const handleSave = useCallback(async () => {
    try {
      const canvas = await captureCard()
      if (!canvas) return
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `melody-map-auralith-${session.moduleId}.png`
      link.click()
      toast.success('Auralith card saved.')
    } catch {
      toast.error('Could not export the Auralith card.')
    }
  }, [captureCard, session.moduleId])

  const handleShare = useCallback(async () => {
    try {
      const canvas = await captureCard()
      if (!canvas) return
      canvas.toBlob(async (blob) => {
        if (!blob) {
          handleSave()
          return
        }

        const file = new File([blob], `melody-map-auralith-${session.moduleId}.png`, { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: session.title,
            text: createShareText(session, profileName),
          })
        } else {
          await navigator.clipboard.writeText(createShareText(session, profileName))
          toast.success('Share text copied. Image export opened instead.')
          handleSave()
        }
      })
    } catch {
      handleSave()
    }
  }, [captureCard, handleSave, profileName, session])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(createShareText(session, profileName))
      toast.success('Session copy text ready.')
    } catch {
      toast.error('Could not copy session text.')
    }
  }, [profileName, session])

  return (
    <section className="glass-card rounded-[32px] p-6 lg:p-7 overflow-hidden relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top right, rgba(124,111,255,0.14), transparent 35%), radial-gradient(circle at bottom left, rgba(242,141,223,0.12), transparent 42%)',
        }}
      />
      <div className="relative z-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-label mb-2">Shareable Auralith card</p>
            <h3 className="text-2xl font-black text-white">Turn this reading into an artifact</h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              Export the current Auralith session as a branded image or copy a clean text version for messages and posts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="orb-button inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Share2 className="h-4 w-4" />
              Share card
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white transition-all hover:bg-white/[0.08]"
            >
              <Download className="h-4 w-4" />
              Save image
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white transition-all hover:bg-white/[0.08]"
            >
              <Copy className="h-4 w-4" />
              Copy text
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <div
            ref={cardRef}
            className="relative w-full max-w-[540px] overflow-hidden rounded-[36px] border border-white/10 bg-[#070814] p-7 shadow-[0_0_70px_rgba(124,111,255,0.12)]"
          >
            <BrandWatermark className="absolute right-[-8%] top-[-16%] w-72" opacity={0.1} rotate={12} />
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 22% 18%, rgba(124,111,255,0.26), transparent 28%), radial-gradient(circle at 78% 24%, rgba(242,141,223,0.22), transparent 26%), linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BrandMark size={38} />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Melody Map</p>
                    <p className="text-sm font-semibold text-white">Auralith Session</p>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  {session.moduleLabel}
                </span>
              </div>

              <div className="mt-8">
                <p className="text-xs uppercase tracking-[0.2em] text-[#f6d486]">Listening for</p>
                <p className="mt-2 text-sm text-slate-300">{profileName}</p>
                <h4 className="mt-4 text-3xl font-black leading-tight text-white">{session.title}</h4>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">{session.summary}</p>
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Prompt</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{session.prompt}</p>
              </div>

              {highlights.length ? (
                <div className="mt-6">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Highlights</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {highlights.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/8 pt-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Mood intelligence</p>
                  <p className="mt-1 text-sm text-slate-300">{session.result?.used_model || 'Auralith'}</p>
                </div>
                <p className="text-xs text-slate-500">melodymap.site</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
