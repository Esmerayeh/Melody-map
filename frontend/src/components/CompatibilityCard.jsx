/**
 * CompatibilityCard
 * Advanced soulmate compatibility display with animated score ring,
 * weighted breakdown bars, and extra analysis dimensions.
 */
import { motion } from 'framer-motion'
import { Heart, Zap, Compass, Clock } from 'lucide-react'

// ── Score ring ─────────────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 144 }) {
  const r    = size * 0.375
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#a78bfa' : score >= 50 ? '#60a5fa' : '#f472b6'
  const cx = size / 2

  return (
    <motion.div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="absolute inset-0 rounded-full blur-xl pointer-events-none"
        style={{ background: `${color}18` }} />
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <defs>
          <filter id={`glow-${score}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" filter={`url(#glow-${score})`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
      </svg>
      <div className="text-center z-10">
        <motion.div className="font-black" style={{ color, fontSize: size * 0.25 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {score}
        </motion.div>
        <div className="text-gray-500" style={{ fontSize: size * 0.08 }}>/ 100</div>
      </div>
    </motion.div>
  )
}

// ── Animated bar ───────────────────────────────────────────────────────────────
function Bar({ label, value, color, icon: Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 28 }}
      className="flex items-center gap-3"
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
      <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: delay + 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{value}%</span>
    </motion.div>
  )
}

// ── Pill list ──────────────────────────────────────────────────────────────────
function PillList({ items, color }) {
  if (!items?.length) return <p className="text-xs text-gray-600">None found</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="text-xs px-2.5 py-1 rounded-full border font-medium"
          style={{ borderColor: `${color}40`, color, background: `${color}10` }}>
          {item}
        </span>
      ))}
    </div>
  )
}

// ── Main card ──────────────────────────────────────────────────────────────────
export default function CompatibilityCard({ result, userAName = 'You', userBName = 'Friend' }) {
  if (!result) return null
  const { score, sharedGenres, sharedArtists, breakdown } = result
  const accentColor = score >= 75 ? '#a78bfa' : score >= 50 ? '#60a5fa' : '#f472b6'

  const tagline =
    score >= 80 ? '🌟 Cosmic twins — your taste is almost identical!'
    : score >= 60 ? '✨ Strong connection — you share a lot of sonic DNA'
    : score >= 40 ? '🎵 Good overlap — you\'d enjoy each other\'s playlists'
    : '🔭 Different orbits — but interesting discoveries await'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accentColor}0a, rgba(0,0,0,0.4))`,
        border: `1px solid ${accentColor}25`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 50%, ${accentColor}0d 0%, transparent 60%)` }} />

      {/* Score + breakdown */}
      <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 mb-6">
        <ScoreRing score={score} size={128} />
        <div className="flex-1 w-full">
          <p className="font-black text-white text-lg mb-1">{userAName} &amp; {userBName}</p>
          <p className="text-gray-400 text-sm mb-4">{tagline}</p>
          <div className="space-y-2.5">
            <Bar label="Genre Overlap"    value={breakdown.genres}         color="#a78bfa" icon={Heart}   delay={0.05} />
            <Bar label="Artist Overlap"   value={breakdown.artists}        color="#60a5fa" icon={Heart}   delay={0.10} />
            <Bar label="Audio Similarity" value={breakdown.audio}          color="#34d399" icon={Zap}     delay={0.15} />
            <Bar label="Mood Alignment"   value={breakdown.moodAlignment}  color="#f472b6" icon={Zap}     delay={0.20} />
            <Bar label="Discovery Match"  value={breakdown.discoveryMatch} color="#fbbf24" icon={Compass} delay={0.25} />
            {breakdown.eraMatch != null && (
              <Bar label="Era Match"      value={breakdown.eraMatch}       color="#fb923c" icon={Clock}   delay={0.30} />
            )}
          </div>
        </div>
      </div>

      {/* Shared data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
        <div className="p-4 rounded-xl bg-white/3 border border-white/8">
          <p className="text-xs font-semibold text-gray-300 mb-2">Shared Artists</p>
          <PillList items={sharedArtists} color="#a78bfa" />
        </div>
        <div className="p-4 rounded-xl bg-white/3 border border-white/8">
          <p className="text-xs font-semibold text-gray-300 mb-2">Shared Genres</p>
          <PillList items={sharedGenres} color="#60a5fa" />
        </div>
      </div>
    </motion.div>
  )
}
