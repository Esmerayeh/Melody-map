/**
 * IdentityPassport.jsx
 * --------------------
 * The shareable universe artifact.  Exportable as PNG via html2canvas.
 *
 * Fields:
 *   - Universe name  (user displayName + "Universe" / "Demo Universe")
 *   - Core archetype + secondary
 *   - MBTI type
 *   - Dominant nebula (top genre region)
 *   - Obsession field (top surge/anchor artist)
 *   - Ghost orbit    (top ghost star)
 *   - Outer rim signal (first comet / recommendation)
 *   - One Auralith line (from profile or template)
 *   - Date + Melody Map watermark
 *   - "Demo Universe" label if isDemo
 *
 * Visually consistent with ShareableIdentityCard.jsx but extended with
 * the full universe metaphor language.
 */
import { forwardRef, useMemo }      from 'react'
import { AnimatePresence, motion }  from 'framer-motion'
import { Download, Share2, X }      from 'lucide-react'
import { MOTION_TOKENS }            from '../motion/motionTokens'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function derivePassportData({ profile, model, comets = [], isDemo = false }) {
  const personality  = profile?.personality || []
  const primary      = personality[0] || {}
  const secondary    = personality[1] || {}
  const mbti         = profile?.mbti?.type || null
  const displayName  = profile?.userProfile?.displayName || profile?.userProfile?.username || (isDemo ? 'Midnight Drifter' : null)
  const universeName = displayName ? `${displayName}'s Universe` : (isDemo ? 'Demo Universe' : 'Your Universe')

  // Dominant nebula = top genre region
  const topRegion    = model?.regions
    ?.slice().sort((a, b) => (b.coverage || 0) - (a.coverage || 0))[0] || null

  // Obsession = surge or highest significance artist
  const obsessionArtist = model?.nodes
    ?.filter((n) => n.type === 'artist')
    .sort((a, b) => {
      const surgeA = a.metrics?.isSurge ? 1 : 0
      const surgeB = b.metrics?.isSurge ? 1 : 0
      return surgeB - surgeA || (b.metrics?.significance || 0) - (a.metrics?.significance || 0)
    })[0] || null

  // Ghost orbit = first ghost star
  const ghostArtist  = model?.nodes
    ?.find((n) => n.type === 'artist' && (n.role === 'ghost-star' || n.metrics?.isGhost)) || null

  // Outer rim = first comet
  const outerRim     = comets[0] || null

  // Auralith line
  const auralithLine = primary?.description
    ? primary.description.split('.')[0] + '.'
    : `${universeName} is a map of feeling, not just data.`

  return {
    universeName,
    archetype:     primary?.archetype || primary?.label || 'Sonic Explorer',
    archetypeColor:primary?.color     || '#8f75ff',
    secondary:     secondary?.archetype || secondary?.label || null,
    secondaryColor:secondary?.color     || null,
    mbti,
    dominantNebula:topRegion?.title    || topRegion?.label || null,
    nebulaColor:   topRegion?.color    || null,
    obsession:     obsessionArtist?.label || null,
    obsessionColor:obsessionArtist?.color || null,
    ghostOrbit:    ghostArtist?.label  || null,
    outerRim:      outerRim ? `${outerRim.title || outerRim.artist} — ${outerRim.genre || 'outer rim'}` : null,
    auralithLine,
    date:          new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    isDemo,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Passport card (ref-forwarded for html2canvas)
// ─────────────────────────────────────────────────────────────────────────────
export const IdentityPassportCard = forwardRef(function IdentityPassportCard(
  { profile, model, comets = [], isDemo = false }, ref
) {
  const d = useMemo(() => derivePassportData({ profile, model, comets, isDemo }), [profile, model, comets, isDemo])

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[28px] border border-white/10 p-6 text-white"
      style={{
        minWidth:  320,
        minHeight: 480,
        background: 'linear-gradient(160deg, #07091a 0%, #0e1228 50%, #050610 100%)',
        boxShadow: `0 0 80px ${d.archetypeColor}18`,
      }}
    >
      {/* Atmospheric bg */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 18%, ${d.archetypeColor}22 0%, transparent 36%),
            radial-gradient(ellipse at 82% 14%, ${d.secondaryColor || d.archetypeColor}14 0%, transparent 30%),
            radial-gradient(ellipse at 50% 85%, rgba(159,220,255,0.08) 0%, transparent 32%)
          `,
        }}
      />
      {/* Tiny star field */}
      <div className="pointer-events-none absolute inset-0 opacity-40"
           style={{ background: 'radial-gradient(circle at 22% 28%, rgba(255,255,255,0.12) 0 1px, transparent 1.5px), radial-gradient(circle at 74% 48%, rgba(255,255,255,0.09) 0 1px, transparent 1.5px), radial-gradient(circle at 48% 72%, rgba(255,255,255,0.07) 0 1px, transparent 1.5px)', backgroundSize: '100px 100px, 130px 130px, 160px 160px' }} />

      <div className="relative z-10 flex h-full flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/44">
              Melody Map · Universe Passport
            </p>
            <h2 className="mt-1.5 text-2xl font-black leading-tight text-white">
              {d.universeName}
            </h2>
          </div>
          {d.isDemo && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Demo
            </span>
          )}
        </div>

        {/* Core identity */}
        <div className="flex flex-wrap gap-2">
          <span
            className="rounded-full px-3 py-1.5 text-sm font-bold"
            style={{ background: `${d.archetypeColor}22`, color: d.archetypeColor, border: `1px solid ${d.archetypeColor}33` }}
          >
            {d.archetype}
          </span>
          {d.secondary && (
            <span
              className="rounded-full px-3 py-1.5 text-sm"
              style={{ background: `${d.secondaryColor || d.archetypeColor}14`, color: d.secondaryColor || d.archetypeColor, border: `1px solid ${(d.secondaryColor || d.archetypeColor)}24` }}
            >
              {d.secondary}
            </span>
          )}
          {d.mbti && (
            <span className="rounded-full border border-white/14 bg-white/6 px-3 py-1.5 text-sm font-mono text-white/70">
              {d.mbti}
            </span>
          )}
        </div>

        {/* Universe fields */}
        <div className="grid gap-2.5">
          {[
            { label: 'Dominant nebula',  value: d.dominantNebula, color: d.nebulaColor    || '#b59cff' },
            { label: 'Obsession field',  value: d.obsession,      color: d.obsessionColor || '#ffd580' },
            { label: 'Ghost orbit',      value: d.ghostOrbit,     color: '#ccd6ff' },
            { label: 'Outer rim signal', value: d.outerRim,       color: '#9fdcff' },
          ].filter((f) => f.value).map(({ label, value, color }) => (
            <div key={label} className="flex items-start gap-3 rounded-[16px] border border-white/8 bg-white/3 px-3.5 py-2.5">
              <div className="h-1.5 w-1.5 mt-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-white/84">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Auralith line */}
        <div className="rounded-[16px] border border-[#9fdcff]/14 bg-[#9fdcff]/05 px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#9fdcff]/48">Auralith</p>
          <p className="mt-1 text-sm italic leading-relaxed text-white/72">"{d.auralithLine}"</p>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between">
          <p className="text-[10px] text-white/28">{d.date}</p>
          <p className="text-[10px] tracking-[0.2em] text-white/36">melodymap.site</p>
        </div>
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Export modal — wraps the card with download / share buttons
// ─────────────────────────────────────────────────────────────────────────────
export function IdentityPassportModal({ open, onClose, profile, model, comets = [], isDemo = false }) {
  const cardRef = { current: null }

  const handleDownload = async () => {
    if (!cardRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
      })
      const link    = document.createElement('a')
      link.download = isDemo ? 'melody-map-demo-passport.png' : 'melody-map-universe-passport.png'
      link.href     = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.warn('Export failed:', err)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="passport-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1,    y: 0 }}
            exit={{ scale: 0.90, y: 12 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="w-full max-w-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.22em] text-white/50">Universe Passport</p>
              <button type="button" onClick={onClose}
                className="rounded-full border border-white/10 p-1.5 text-gray-500 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <IdentityPassportCard
              ref={(el) => { cardRef.current = el }}
              profile={profile}
              model={model}
              comets={comets}
              isDemo={isDemo}
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8f75ff] to-[#b99aff] py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(143,117,255,0.25)] transition hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                Save passport
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.share?.({ title: 'My Music Universe Passport', url: window.location.href })
                  } catch {}
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
