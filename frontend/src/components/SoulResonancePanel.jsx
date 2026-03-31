import { useMemo } from 'react'
import { motion } from 'framer-motion'
import DeferredSoulOrb from './DeferredSoulOrb'
import useGalaxyInteractionStore from '../features/galaxy/useGalaxyInteractionStore'
import { mapGalaxyModeToResonance, mapGalaxySelectionToResonance } from '../features/orb/resonanceEngine'
import { resolveInteractionEntity } from '../features/galaxy/interactionModel.js'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

export default function SoulResonancePanel({ profile, model }) {
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const galaxyMode = useGalaxyInteractionStore((state) => state.galaxyMode)

  const focusedEntity = useMemo(
    () => resolveInteractionEntity(model, profile, focusedObject),
    [focusedObject, model, profile],
  )
  const hoveredEntity = useMemo(
    () => resolveInteractionEntity(model, profile, hoveredObject),
    [hoveredObject, model, profile],
  )

  const selectedResonance = useMemo(() => mapGalaxySelectionToResonance({
    node: focusedEntity.node,
    cluster: focusedEntity.cluster,
    region: focusedEntity.region,
    edge: focusedEntity.edge,
    model,
    mode: 'focused',
  }), [focusedEntity.cluster, focusedEntity.edge, focusedEntity.node, focusedEntity.region, model])

  const resonance = useMemo(() => {
    if (selectedResonance) return selectedResonance
    const hoverResonance = mapGalaxySelectionToResonance({
      node: hoveredEntity.node,
      cluster: hoveredEntity.cluster,
      region: hoveredEntity.region,
      edge: hoveredEntity.edge,
      model,
      mode: 'live',
    })
    if (hoverResonance) return hoverResonance
    return mapGalaxyModeToResonance({ galaxyMode, model, profile })
  }, [galaxyMode, hoveredEntity.cluster, hoveredEntity.edge, hoveredEntity.node, hoveredEntity.region, model, profile, selectedResonance])

  if (!profile) return null

  const modeLabel = resonance?.mode === 'live'
    ? 'live resonance'
    : resonance?.mode === 'ambient'
      ? 'ambient field'
      : resonance
        ? 'held in focus'
        : 'resting glow'

  const title = resonance?.label
    ? `Soul Orb / ${resonance.label}`
    : 'Soul Orb'

  const description = resonance?.explanation
    || 'Your Soul Orb is resting in the center of your listening self, holding the quiet shape of what returns most often.'

  const evidence = resonance?.evidence || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION_TOKENS.panel}
      className="noire-orb-panel p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgba(141,201,255,0.08),transparent_34%)]" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{modeLabel}</p>
          <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
        </div>
        <span className="noire-chip text-[10px]">
          {resonance?.mode === 'live' ? 'touch response' : resonance ? 'held signal' : 'base signal'}
        </span>
      </div>

      <div className="relative flex flex-col items-center gap-4">
        <DeferredSoulOrb
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
          size={210}
          showLabels
        />

        <motion.div
          layout
          transition={MOTION_TOKENS.focus}
          className="noire-info-card w-full p-3 text-sm text-gray-300"
        >
          <p>{description}</p>
          {!!evidence.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidence.slice(0, 4).map((item) => (
                <motion.span key={item} layout transition={MOTION_TOKENS.chip} className="noire-chip text-[11px] text-gray-400">
                  {item}
                </motion.span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
