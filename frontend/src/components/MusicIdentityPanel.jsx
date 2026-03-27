/**
 * MusicIdentityPanel
 * Displays Music Personality Report + Music MBTI in a unified card.
 * Reads profile.personality and profile.mbti — both computed once in
 * useMusicProfile's normalizeProfile. No duplicate computation here.
 */
import { motion } from 'framer-motion'
import { Brain, Sparkles } from 'lucide-react'

function TraitBar({ label, emoji, pct, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 28 }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-gray-300 font-medium">
          <span>{emoji}</span> {label}
        </span>
        <span className="font-black" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </motion.div>
  )
}

function AxisRow({ axis, data, delay = 0 }) {
  const pct = Math.min(100, Math.max(0, data.score))
  const color = data.flipped ? '#60a5fa' : '#a78bfa'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3"
    >
      <span className="text-xs text-gray-500 w-4 font-mono shrink-0">{axis}</span>
      <span className="text-xs font-semibold w-20 shrink-0" style={{ color }}>{data.label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right font-mono">{pct}%</span>
    </motion.div>
  )
}

export default function MusicIdentityPanel({ profile }) {
  const personality = profile?.personality
  const personalityMeta = profile?.personalityMeta
  const mbti = profile?.mbti
  const mbtiMeta = profile?.mbtiMeta
  const dataQuality = profile?.dataQuality
  const confidence = profile?.confidence

  if (!profile) return null

  if (!mbti && !personality?.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Music Identity</p>
        <p className="text-sm text-gray-600">Identity is unavailable until we have enough genre or audio signal to support it honestly.</p>
        <p className="text-xs text-gray-500 mt-2">
          Genres: {dataQuality?.genresCount || 0} • Audio coverage: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%
        </p>
      </div>
    )
  }

  const topTrait = personality?.[0] || {
    color: '#a78bfa',
    description: 'Your listening identity is still taking shape.',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, ${topTrait.color}0d, rgba(0,0,0,0.4))`,
        border: `1px solid ${topTrait.color}25`,
      }}
    >
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: `${topTrait.color}12` }}
      />

      <div className="p-5 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${topTrait.color}20`, border: `1px solid ${topTrait.color}30` }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: topTrait.color }} />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Music Personality</p>
          </div>

          {personality?.length ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3 text-[11px] text-gray-500">
                <span>Confidence: {confidence?.labels?.identity || 'unavailable'}</span>
                <span>•</span>
                <span>Genres: {dataQuality?.genresCount || 0}</span>
                <span>•</span>
                <span>Audio tracks: {dataQuality?.audioFeaturesCount || 0}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">You are:</p>
              <div className="space-y-3 mb-4">
                {personality.map((trait, i) => (
                  <TraitBar
                    key={trait.id}
                    label={trait.label}
                    emoji={trait.emoji}
                    pct={trait.pct}
                    color={trait.color}
                    delay={i * 0.08}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed italic">
                "{topTrait.description}"
              </p>
              {personalityMeta?.missingInputs?.length > 0 && (
                <p className="text-[11px] text-gray-600 mt-3">
                  Missing inputs: {personalityMeta.missingInputs.slice(0, 3).join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 leading-relaxed">
              We need a little more listening variety before your personality traits become reliable.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)' }}
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Music Identity</p>
          </div>

          {mbti ? (
            <>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
                className="inline-flex items-center gap-2 mb-3"
              >
                <span
                  className="text-3xl font-black tracking-widest"
                  style={{
                    background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {mbti.type}
                </span>
                <span className="text-sm text-gray-400 font-semibold">· {mbti.name}</span>
              </motion.div>

              <p className="text-xs text-gray-400 leading-relaxed mb-4">{mbti.desc}</p>

              <div className="space-y-2">
                {Object.entries(mbti.axes).map(([axis, data], i) => (
                  <AxisRow key={axis} axis={axis[0]} data={data} delay={0.15 + i * 0.06} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-sm text-gray-300 mb-2">MBTI-style identity needs stronger signal coverage.</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Audio coverage: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%.
                We can still show your personality traits, but the four-letter type stays hidden until the profile is more complete.
              </p>
              {mbtiMeta?.missingInputs?.length > 0 && (
                <p className="text-[11px] text-gray-600 mt-2">
                  Missing inputs: {mbtiMeta.missingInputs.slice(0, 4).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
