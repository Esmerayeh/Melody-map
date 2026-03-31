import { motion } from 'framer-motion'
import { Brain, Sparkles } from 'lucide-react'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

function TraitBar({ label, emoji, pct, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...MOTION_TOKENS.focusSettle, delay }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-gray-300">
          <span>{emoji}</span>
          {label}
        </span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.08, duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </motion.div>
  )
}

function AxisRow({ axis, data, delay = 0 }) {
  const pct = Math.min(100, Math.max(0, data.score))
  const color = data.flipped ? '#8fc0ff' : '#c09bff'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_TOKENS.panel, delay }}
      className="flex items-center gap-3"
    >
      <span className="w-4 shrink-0 font-mono text-xs text-gray-500">{axis}</span>
      <span className="w-20 shrink-0 text-xs font-semibold" style={{ color }}>{data.label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.08, duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs text-gray-500">{pct}%</span>
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
      <div className="noire-info-card p-6 text-center">
        <p className="page-header-kicker mb-2">Inner music self</p>
        <p className="text-sm text-gray-400">The signal is still too thin for a full inner reading.</p>
        <p className="mt-2 text-xs text-gray-500">
          atmospheres: {dataQuality?.genresCount || 0} / deep signal: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%
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
      transition={MOTION_TOKENS.focusSettle}
      className="noire-orb-panel overflow-hidden"
    >
      <div
        className="absolute top-0 right-0 h-48 w-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: `${topTrait.color}12` }}
      />

      <div className="relative z-10 grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
        <div className="noire-info-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl border"
              style={{ background: `${topTrait.color}18`, borderColor: `${topTrait.color}28` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: topTrait.color }} />
            </div>
            <p className="page-header-kicker">Sonic identity</p>
          </div>

          {personality?.length ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span>clarity: {confidence?.labels?.identity || 'soft signal'}</span>
                <span>/</span>
                <span>atmospheres: {dataQuality?.genresCount || 0}</span>
                <span>/</span>
                <span>deep signal: {dataQuality?.audioFeaturesCount || 0}</span>
              </div>

              <p className="mb-3 text-xs text-gray-500">what returns most often:</p>

              <div className="space-y-3">
                {personality.map((trait, index) => (
                  <TraitBar
                    key={trait.id}
                    label={trait.label}
                    emoji={trait.emoji}
                    pct={trait.pct}
                    color={trait.color}
                    delay={index * 0.08}
                  />
                ))}
              </div>

              <p className="mt-4 text-xs italic leading-relaxed text-gray-400">
                “{topTrait.description}”
              </p>

              {personalityMeta?.missingInputs?.length > 0 && (
                <p className="mt-3 text-[11px] text-gray-500">
                  missing inputs: {personalityMeta.missingInputs.slice(0, 3).join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-gray-500">
              A little more listening variety will help the pattern settle into focus.
            </p>
          )}
        </div>

        <div className="noire-info-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Brain className="h-4 w-4 text-purple-300" />
            </div>
            <p className="page-header-kicker">Inner music self</p>
          </div>

          {mbti ? (
            <>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...MOTION_TOKENS.focusSettle, delay: 0.1 }}
                className="mb-3 inline-flex items-center gap-2"
              >
                <span className="text-gradient-aurora text-4xl font-semibold tracking-[0.18em]">{mbti.type}</span>
                <span className="text-sm font-medium text-gray-400">· {mbti.name}</span>
              </motion.div>

              <p className="mb-4 text-sm leading-relaxed text-gray-400">{mbti.desc}</p>

              <div className="space-y-2.5">
                {Object.entries(mbti.axes).map(([axis, data], index) => (
                  <AxisRow key={axis} axis={axis[0]} data={data} delay={0.14 + index * 0.05} />
                ))}
              </div>
            </>
          ) : (
            <div className="noire-panel-soft p-4">
              <p className="mb-2 text-sm text-gray-300">The four-letter reading needs a steadier signal first.</p>
              <p className="text-xs leading-relaxed text-gray-500">
                Deep signal: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%. We can trace the softer contours, but the full type stays quiet until the profile is more complete.
              </p>
              {mbtiMeta?.missingInputs?.length > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">
                  missing inputs: {mbtiMeta.missingInputs.slice(0, 4).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
