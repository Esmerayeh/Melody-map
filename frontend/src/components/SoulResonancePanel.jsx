import { motion } from 'framer-motion'
import MusicSoulOrb from './MusicSoulOrb'

export default function SoulResonancePanel({ profile, resonance }) {
  if (!profile) return null

  const modeLabel = resonance?.mode === 'live'
    ? 'Live resonance'
    : resonance
      ? 'Focused reflection'
      : 'Resting core'

  const title = resonance?.label
    ? `Soul Orb × ${resonance.label}`
    : 'Soul Orb'

  const description = resonance?.explanation
    || 'Your Soul Orb is resting in its full-profile state, holding the emotional center of your listening identity.'

  const evidence = resonance?.evidence || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{modeLabel}</p>
          <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-400">
          {resonance?.mode === 'live' ? 'Hover state' : resonance ? 'Selected state' : 'Base state'}
        </span>
      </div>

      <div className="flex flex-col items-center gap-4">
        <MusicSoulOrb
          personality={profile.personality}
          personalityMeta={profile.personalityMeta}
          mbti={profile.mbti}
          mbtiMeta={profile.mbtiMeta}
          audioFeatures={profile.audioFeatures}
          analyticsMetrics={profile.analyticsMetrics}
          confidence={profile.confidence}
          dataQuality={profile.dataQuality}
          genres={profile.genres}
          topArtists={profile.topArtists}
          resonance={resonance}
          size={170}
          showLabels
        />

        <div className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-gray-300">
          <p>{description}</p>
          {!!evidence.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidence.slice(0, 4).map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-400">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
