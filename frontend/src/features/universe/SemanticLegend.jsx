/**
 * SemanticLegend.jsx
 * ------------------
 * A minimal scanner-style overlay that explains what visual properties
 * in the galaxy mean.  Mounted in /universe.
 *
 * Design (08-cyber-celestial-art-director):
 *   - thin glass pill, not a tutorial modal
 *   - subtle, bottom-right or top-right when HUD is quiet
 *   - collapses to an icon; expands on hover/click
 *   - scanner-line decoration at the top
 *   - each entry has a small color dot and one short phrase
 *   - reduced-motion: static, no animation
 *
 * Content (12-data-to-visual-metaphor):
 *   - Distance = audio-feature similarity
 *   - X axis = valence / emotional brightness
 *   - Y axis = energy / intensity
 *   - Z axis = texture / organic ↔ kinetic
 *   - Brightness = significance
 *   - Ghost = long-term memory / former orbit
 *   - Surge = short-term surge / new discovery
 *   - Gravity well = playcount / repeat obsession
 *   - Comet = outer-rim recommendation
 */
import { useState }          from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MOTION_TOKENS }     from '../motion/motionTokens'

// Semantic explanations — every entry is honest and explainable
const ENTRIES = [
  { dot: '#9DB7FF', label: 'Distance',   value: 'audio similarity — similar sounds cluster together' },
  { dot: '#b59cff', label: 'X axis',     value: 'valence — dark (left) ↔ bright (right)' },
  { dot: '#9fdcff', label: 'Y axis',     value: 'energy — quiet (bottom) ↔ intense (top)' },
  { dot: '#f1c68a', label: 'Z axis',     value: 'texture — electronic/kinetic ↔ organic/still' },
  { dot: '#EAE6FF', label: 'Brightness', value: 'significance in your listening history' },
  { dot: '#ccd6ff', label: 'Ghost ○',   value: 'long-term-only artist — former orbit' },
  { dot: '#FFD580', label: 'Surge ✦',   value: 'short-term-only artist — new pull' },
  { dot: '#f1aacb', label: 'Well ◉',    value: 'high playcount — repeat obsession' },
  { dot: '#74d4a0', label: 'Comet ◎',   value: 'outer-rim recommendation — unknown signal' },
]

export default function SemanticLegend({ className = '', compact = false, semanticCoverage = null }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`pointer-events-auto ${className}`}>
      {/* Collapsed state — small pill */}
      <AnimatePresence initial={false}>
        {!expanded && (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={MOTION_TOKENS.chip}
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#070814]/72 px-3 py-1.5 backdrop-blur text-[10px] text-white/40 hover:text-white/65 hover:border-white/18 transition-all"
            title="Show semantic legend — what does distance mean?"
          >
            <span className="text-[9px] leading-none">⬡</span>
            <span className="uppercase tracking-[0.18em]">Semantic key</span>
          </motion.button>
        )}

        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={MOTION_TOKENS.panel}
            className="relative overflow-hidden rounded-[18px] border border-white/8 bg-[#060c1e]/90 backdrop-blur-xl p-4"
            style={{
              width: 260,
              boxShadow: '0 0 40px rgba(159,216,255,0.04)',
            }}
          >
            {/* Scanner line */}
            <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#9fdcff]/30 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.26em] text-[#9fdcff]/55">
                  Semantic Key
                </p>
                <p className="text-[10px] text-white/55 mt-0.5">
                  What the galaxy means
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-white/30 hover:text-white/65 transition-colors text-xs ml-2"
                aria-label="Close legend"
              >
                ✕
              </button>
            </div>

            {/* Entries */}
            <div className="space-y-2">
              {ENTRIES.map(({ dot, label, value }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <div
                    className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                    style={{ background: dot, boxShadow: `0 0 6px ${dot}60` }}
                  />
                  <div className="min-w-0">
                    <span
                      className="text-[10px] font-semibold mr-1"
                      style={{ color: dot }}
                    >
                      {label}
                    </span>
                    <span className="text-[10px] text-white/45 leading-snug">
                      {value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Coverage note */}
            {semanticCoverage !== null && semanticCoverage < 0.75 ? (
              <div className="mt-3 pt-2.5 border-t border-white/6">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-1.5 rounded-full bg-[#9fdcff]/30 flex-1">
                    <div
                      className="h-full rounded-full bg-[#9fdcff]/60"
                      style={{ width: `${Math.round((semanticCoverage ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#9fdcff]/45 tabular-nums">
                    {Math.round((semanticCoverage ?? 0) * 100)}%
                  </span>
                </div>
                <p className="text-[9px] text-white/28 leading-snug italic">
                  {semanticCoverage < 0.5
                    ? 'Some coordinates are estimated. Connect Spotify for a fuller signal.'
                    : 'Most positions are from audio features. Improving.'}
                </p>
              </div>
            ) : (
              <p className="mt-3 pt-2.5 border-t border-white/6 text-[9px] text-white/28 leading-snug italic">
                Positions derived from Spotify audio features.
                More data = more precise coordinates.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
