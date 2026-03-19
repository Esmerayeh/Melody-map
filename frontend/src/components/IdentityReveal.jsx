/**
 * IdentityReveal
 * Cinematic "Music Identity Reveal" experience.
 * Reads profile.mbti and profile.personality — never recomputes.
 *
 * Export shape (for future "Compare Identities"):
 *   { type, name, desc, axes }          ← mbti
 *   [{ id, label, emoji, pct, color }]  ← personality (top-3 traits)
 *   contradictions[]                    ← per-MBTI strings
 *   intenseLine                         ← dynamic audio-feature line
 *   rarity                              ← computed integer 0–99
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, Download, Sparkles } from 'lucide-react'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// RARITY — computed from MBTI base + genre uniqueness + trait spread
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_RARITY_BASE = {
  INFJ: 95, INTJ: 93, ENTJ: 91, INFP: 90, INTP: 89,
  ENFJ: 87, ENTP: 85, ISFJ: 80, ISFP: 78, ISTJ: 76,
  ISTP: 74, ENFP: 72, ESFJ: 68, ESFP: 66, ESTJ: 63, ESTP: 60,
}

/**
 * getRarity(mbtiType, personality, profile)
 * Deterministic — same inputs always produce same output.
 * Factors: MBTI base rarity + genre count uniqueness + trait spread.
 */
function getRarity(mbtiType, personality, profile) {
  const base = TYPE_RARITY_BASE[mbtiType] ?? 72

  // Genre uniqueness bonus: more unique genres = rarer listener
  const genreCount = (profile?.genres || []).length
  const genreBonus = Math.min(4, Math.floor(genreCount / 4))

  // Trait spread bonus: if top trait dominates heavily (>50%), listener is more defined = rarer
  const topPct = personality?.[0]?.pct ?? 40
  const spreadBonus = topPct > 50 ? 2 : topPct > 45 ? 1 : 0

  // Rare archetype bonus
  const topId = personality?.[0]?.id
  const archetypeBonus = (topId === "cosmic" || topId === "melancholic") ? 2 : 0

  return Math.min(99, base + genreBonus + spreadBonus + archetypeBonus)
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC EMOTIONAL LINE — derived from audio features, not static per archetype
// ─────────────────────────────────────────────────────────────────────────────
function getDynamicLine(audioFeatures) {
  const e = audioFeatures?.energy    ?? 0.5
  const v = audioFeatures?.valence   ?? 0.5
  const d = audioFeatures?.danceability ?? 0.5
  const a = audioFeatures?.acousticness ?? 0.3

  // Matrix of emotional states based on energy + valence quadrants
  if (e < 0.35 && v > 0.55) return "You try to stay light, even when you're not okay."
  if (e > 0.65 && v < 0.4)  return "You keep moving so you don't have to sit with what you feel."
  if (e < 0.4  && v < 0.4)  return "You sit with the weight of things most people skip past."
  if (e > 0.65 && v > 0.6)  return "You use music to convince yourself everything is fine."
  if (e < 0.45 && a > 0.6)  return "You need music that sounds like being alone doesn't hurt."
  if (d > 0.7  && v < 0.45) return "You dance through things you haven't processed yet."
  if (d < 0.35 && a > 0.55) return "You listen like you're searching for something you lost."
  if (e > 0.55 && d < 0.4)  return "You feel intensely but rarely let it show."
  if (v > 0.7  && d > 0.65) return "You choose joy deliberately. That takes more strength than it looks."
  if (e < 0.5  && v > 0.65) return "You find peace in music the way others find it in people."
  // Default — still personal, not generic
  return "Your music knows things about you that you haven't said out loud."
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRADICTIONS — all double-quoted to avoid apostrophe syntax errors
// ─────────────────────────────────────────────────────────────────────────────
const CONTRADICTIONS = {
  INFP: [
    "Craves connection, listens alone",
    "Finds joy in sad songs",
    "Wants to be understood, resists being known",
  ],
  INFJ: [
    "Deeply social, deeply private",
    "Seeks meaning in noise",
    "Feels everything, shows little",
  ],
  INTP: [
    "Loves music, can't explain why",
    "Analyzes emotion instead of feeling it",
    "Finds patterns in chaos",
  ],
  INTJ: [
    "Curates obsessively, shares rarely",
    "Emotionally moved, intellectually detached",
    "Builds walls with playlists",
  ],
  ISFP: [
    "Feels deeply, speaks softly",
    "Lives in the moment, haunted by the past",
    "Gentle taste, intense inner world",
  ],
  ISFJ: [
    "Loyal to old favorites, afraid of new ones",
    "Comforts others with music, rarely asks for comfort",
    "Quiet listener, loud memory",
  ],
  ISTP: [
    "Appreciates craft, dismisses sentiment",
    "Minimal words, maximal feeling",
    "Detached observer of their own emotions",
  ],
  ISTJ: [
    "Resistant to change, moved by nostalgia",
    "Disciplined listener, chaotic inner life",
    "Trusts the familiar, longs for the unknown",
  ],
  ENFP: [
    "Loves everything, commits to nothing",
    "Starts 10 playlists, finishes none",
    "Enthusiastic about music no one else knows yet",
  ],
  ENFJ: [
    "Curates for others, forgets themselves",
    "Feels responsible for the room's mood",
    "Gives music as a love language",
  ],
  ENTP: [
    "Argues about music they secretly love",
    "Contrarian taste, mainstream feelings",
    "Deconstructs songs while crying to them",
  ],
  ENTJ: [
    "Controls the aux, controls the energy",
    "Efficient with playlists, inefficient with feelings",
    "Leads with sound",
  ],
  ESFP: [
    "Lives in the beat, dies in the silence",
    "Dances alone, feels most alive in crowds",
    "Impulsive listener, deliberate mood-setter",
  ],
  ESFJ: [
    "Plays what others want, feels what they need",
    "Harmony in music, harmony in life",
    "Remembers every song from every moment",
  ],
  ESTP: [
    "Needs the drop, hates the buildup",
    "Moves fast, feels slow",
    "Adrenaline seeker with a soft playlist",
  ],
  ESTJ: [
    "Has a system for everything, including shuffle",
    "Reliable taste, unpredictable emotions",
    "Organized chaos in headphones",
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN PHASES — humanized, personal, slightly haunting
// ─────────────────────────────────────────────────────────────────────────────
const PHASES = [
  { id: "scan1",  text: "Reading your late night music patterns...", duration: 1900 },
  { id: "scan2",  text: "Understanding what you feel but don't say...", duration: 1900 },
  { id: "scan3",  text: "Noticing what you hide in your playlists...", duration: 1700 },
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
            className="absolute rounded-full border border-indigo-500/40"
            style={{ width: 40 + i * 24, height: 40 + i * 24 }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 2, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-400/60 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </motion.div>
      </div>
      <p className="text-gray-300 text-sm font-medium tracking-wide text-center max-w-xs">{text}</p>
      <div className="w-48 h-0.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
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

  const rarity      = getRarity(mbti.type, personality, profile)
  const contras     = CONTRADICTIONS[mbti.type] || [
    "Feels deeply, speaks rarely",
    "Thinks differently, listens loudly",
    "Searches for meaning in every track",
  ]
  const intenseLine = getDynamicLine(profile?.audioFeatures)

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

          {/* Rarity badge */}
          <div className="shrink-0 text-right">
            <div
              className="inline-flex flex-col items-center px-3 py-2 rounded-2xl"
              style={{ background: `${primaryColor}15`, border: `1px solid ${primaryColor}30` }}
            >
              <span className="text-2xl font-black" style={{ color: primaryColor }}>
                {rarity}%
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-tight">
                rarer than
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description + dynamic emotional line */}
      <div className="relative z-10 mb-5">
        <p className="text-gray-300 text-sm leading-relaxed mb-3">{mbti.desc}</p>
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

      {/* Contradictions */}
      <div className="relative z-10 space-y-2 mb-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-600 mb-2">
          Your contradictions
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
