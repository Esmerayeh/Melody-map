/**
 * IdentityReveal
 * Cinematic "Music Identity Reveal" experience.
 * Reads the Spotify-derived profile and shows receipts for every claim.
 *
 * Export shape:
 *   { type, name, desc, axes } from mbti evidence
 *   [{ id, label, emoji, pct, color }] from personality signals
 *   intenseLine from Spotify receipts
 *   signalClarity from identity confidence and audio coverage
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, Download, Sparkles } from 'lucide-react'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'

function getSignalClarity(profile) {
  const identityConfidence = profile?.confidence?.identity?.score
  const audioCoverage = profile?.dataQuality?.audioCoverage
  const signalConfidence = profile?.livingIdentity?.topSignal?.confidence
  return Math.round(Math.max(identityConfidence ?? 0, audioCoverage ?? 0, signalConfidence ?? 0) * 100)
}

function getDynamicLine(profile) {
  return (
    profile?.livingIdentity?.summary ||
    profile?.identitySignals?.find((signal) => signal?.evidence?.length)?.evidence?.[0] ||
    profile?.spotifyEvidence?.receipts?.[0] ||
    "Melody Map needs more Spotify evidence before making an identity claim."
  )
}

const PHASES = [
  { id: "scan1",  text: "Reading Spotify artist anchors...", duration: 1900 },
  { id: "scan2",  text: "Checking audio-feature evidence...", duration: 1900 },
  { id: "scan3",  text: "Assembling identity receipts...", duration: 1700 },
  { id: "reveal", text: null, duration: null },
]

// ─────────────────────────────────────────────────────────────────────────────
// SCAN PHASE UI
// ─────────────────────────────────────────────────────────────────────────────
function ScanPhase({ text }) {
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6"
    >
      <div className="relative w-24 h-24 flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[#ac6294]/40"
            style={{ width: 40 + i * 24, height: 40 + i * 24 }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 2, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          className="w-10 h-10 rounded-full bg-[#ac6294]/20 border border-[#ac6294]/60 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-4 h-4 text-[#ac6294]" />
        </motion.div>
      </div>
      <p className="text-gray-300 text-sm font-medium tracking-wide text-center max-w-xs">{text}</p>
      <div className="w-48 h-0.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#ac6294] to-purple-500"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY CARD — shareable, exportable via html2canvas
// ─────────────────────────────────────────────────────────────────────────────
function IdentityCard({ mbti, personality, profile, cardRef }) {
  const topTrait     = personality?.[0]
  const primaryColor = topTrait?.color || "#a78bfa"
  const secondColor  = personality?.[1]?.color || "#60a5fa"

  const signalClarity = getSignalClarity(profile)
  const receipts = [
    ...(profile?.livingIdentity?.receipts || []),
    ...(topTrait?.evidence || []),
  ].filter(Boolean)
  const contras = receipts.length ? receipts.slice(0, 3) : [
    "More Spotify listening history is needed before Melody Map can show receipts here.",
  ]
  const intenseLine = getDynamicLine(profile)
  const description = profile?.musicIdentitySummary || profile?.livingIdentity?.summary || mbti.desc

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.88, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
      whileHover={{ boxShadow: `0 0 60px ${primaryColor}30` }}
      className="relative rounded-3xl overflow-hidden p-8 max-w-md w-full mx-auto select-none"
      style={{
        background: "linear-gradient(145deg, #0a0d1f 0%, #0f0820 50%, #080b1a 100%)",
        border: `1px solid ${primaryColor}30`,
        boxShadow: `0 0 40px ${primaryColor}18, inset 0 0 60px ${primaryColor}06`,
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)` }}
      />
      <div
        className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{ background: `radial-gradient(circle, ${secondColor} 0%, transparent 70%)` }}
      />

      {/* Header */}
      <div className="relative z-10 mb-6">
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em] mb-2"
          style={{ color: `${primaryColor}99` }}
        >
          melody map · music identity
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <motion.p
              className="text-7xl font-black tracking-tight leading-none mb-1"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondColor})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              animate={{
                filter: [
                  `drop-shadow(0 0 8px ${primaryColor}00)`,
                  `drop-shadow(0 0 20px ${primaryColor}80)`,
                  `drop-shadow(0 0 8px ${primaryColor}00)`,
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              {mbti.type}
            </motion.p>
            <p className="text-white font-bold text-lg leading-tight">{mbti.name}</p>
          </div>

          {/* Signal clarity badge */}
          <div className="shrink-0 text-right">
            <div
              className="inline-flex flex-col items-center px-3 py-2 rounded-2xl"
              style={{ background: `${primaryColor}15`, border: `1px solid ${primaryColor}30` }}
            >
              <span className="text-2xl font-black" style={{ color: primaryColor }}>
                {signalClarity || "--"}%
              </span>
              <span className="text-[10px] text-gray-500 tracking-wider leading-tight">
                signal clarity
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description + dynamic emotional line */}
      <div className="relative z-10 mb-5">
        <p className="text-gray-300 text-sm leading-relaxed mb-3">{description}</p>
        <p className="text-sm font-semibold italic leading-snug" style={{ color: primaryColor }}>
          "{intenseLine}"
        </p>
      </div>

      {/* Trait bars */}
      <div className="relative z-10 mb-5 space-y-2">
        {personality.map((t, i) => (
          <div key={t.id} className="flex items-center gap-3">
            <span className="text-sm w-4">{t.emoji}</span>
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: t.color }}
                initial={{ width: 0 }}
                animate={{ width: `${t.pct}%` }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-xs font-bold w-8 text-right" style={{ color: t.color }}>
              {t.pct}%
            </span>
            <span className="text-xs text-gray-500 w-20 truncate">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Evidence receipts */}
      <div className="relative z-10 space-y-2 mb-6">
        <p className="text-[10px] tracking-[0.25em] text-gray-600 mb-2">
          Spotify receipts
        </p>
        {contras.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.12 }}
            className="flex items-start gap-2 text-xs text-gray-400"
          >
            <span style={{ color: primaryColor }} className="mt-0.5 shrink-0">
              ◆
            </span>
            {c}
          </motion.div>
        ))}
      </div>

      {/* Footer — visible on exported image */}
      <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/8">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3" style={{ color: `${primaryColor}80` }} />
          <span className="text-[11px] text-gray-500 font-medium">Made with Melody Map</span>
        </div>
        <div className="flex gap-1.5">
          {personality.map((t) => (
            <div
              key={t.id}
              className="w-2 h-2 rounded-full"
              style={{ background: t.color, boxShadow: `0 0 4px ${t.color}` }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────────────────────────────────────
export default function IdentityReveal({ mbti, personality, profile, onClose }) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const cardRef = useRef(null)

  // Advance through scan phases on a timer
  useEffect(() => {
    if (phaseIndex >= PHASES.length - 1) return
    const timer = setTimeout(() => {
      setPhaseIndex((p) => p + 1)
    }, PHASES[phaseIndex].duration)
    return () => clearTimeout(timer)
  }, [phaseIndex])

  const currentPhase = PHASES[phaseIndex]
  const isRevealed   = currentPhase.id === "reveal"

  // ── Export helpers ──────────────────────────────────────────────────────────
  const captureCard = useCallback(async () => {
    if (!cardRef.current) return null
    return html2canvas(cardRef.current, {
      backgroundColor: "#080b1a",
      scale: 2,
      useCORS: true,
      logging: false,
    })
  }, [])

  const handleSave = useCallback(async () => {
    try {
      const canvas = await captureCard()
      if (!canvas) return
      const a = document.createElement("a")
      a.href     = canvas.toDataURL("image/png")
      a.download = `melody-map-${mbti.type}.png`
      a.click()
      toast.success("Identity card saved!")
    } catch {
      toast.error("Could not export card.")
    }
  }, [captureCard, mbti.type])

  const handleShare = useCallback(async () => {
    try {
      const canvas = await captureCard()
      if (!canvas) return
      canvas.toBlob(async (blob) => {
        if (!blob) { handleSave(); return }
        const file = new File([blob], `melody-map-${mbti.type}.png`, { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `I'm ${mbti.type} — ${mbti.name}`,
            text: "Discover your music identity on Melody Map",
          })
        } else {
          handleSave()
        }
      })
    } catch {
      handleSave()
    }
  }, [captureCard, mbti.type, mbti.name, handleSave])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(4, 5, 15, 0.93)", backdropFilter: "blur(14px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all z-10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">

        {/* Scan phases */}
        <AnimatePresence mode="wait">
          {!isRevealed && (
            <motion.div
              key={currentPhase.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="flex flex-col items-center min-h-[200px] justify-center"
            >
              <ScanPhase text={currentPhase.text} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reveal */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9 }}
              className="w-full flex flex-col items-center gap-5"
            >
              <IdentityCard
                mbti={mbti}
                personality={personality}
                profile={profile}
                cardRef={cardRef}
              />

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="flex gap-3"
              >
                <motion.button
                  onClick={handleShare}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    boxShadow: "0 0 20px rgba(99,102,241,0.35)",
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Share My Identity
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Save Image
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  )
}
