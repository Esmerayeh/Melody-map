import { useMemo } from 'react'
import { deriveOrbProfile } from './orbProfile'
import { blendOrbProfile } from './resonanceEngine'
import {
  SOUL_ORB_VARIANTS,
  buildSoulOrbBehavior,
  buildSoulOrbCaption,
  buildSoulOrbPalette,
  getSoulOrbVariant,
} from './soulOrbThemes'

export default function useSoulOrbController({
  personality,
  personalityMeta,
  mbti,
  mbtiMeta,
  audioFeatures,
  analyticsMetrics,
  confidence,
  dataQuality,
  genres,
  topArtists,
  resonance,
  liveSignal,
  mode = null,
}) {
  return useMemo(() => {
    const baseProfile = deriveOrbProfile({
      personality,
      personalityMeta,
      mbti,
      mbtiMeta,
      audioFeatures,
      analyticsMetrics,
      confidence,
      dataQuality,
      genres,
      topArtists,
    })

    const blendedProfile = blendOrbProfile(baseProfile, resonance)
    const variantName = mode === 'soulmate'
      ? 'soulmate_mode'
      : getSoulOrbVariant(blendedProfile, resonance)
    const variant = SOUL_ORB_VARIANTS[variantName] || SOUL_ORB_VARIANTS.idle
    const palette = buildSoulOrbPalette(blendedProfile, resonance, variant)
    const baseBehavior = buildSoulOrbBehavior(blendedProfile, variant)
    const sessionIntensity = Math.max(0, Math.min(1, liveSignal?.sessionIntensity || 0))
    const noveltyScore = Math.max(0, Math.min(1, liveSignal?.noveltyScore || 0))
    const repeatScore = Math.max(0, Math.min(1, liveSignal?.repeatScore || 0))
    const eventCount = liveSignal?.eventCount || 0
    const behavior = {
      ...baseBehavior,
      pulseSpeed: baseBehavior.pulseSpeed * (1 + sessionIntensity * 0.22),
      glowIntensity: baseBehavior.glowIntensity * (1 + sessionIntensity * 0.18),
      rotationSpeed: baseBehavior.rotationSpeed * (1 + noveltyScore * 0.2),
      particleOpacity: Math.min(0.98, baseBehavior.particleOpacity + sessionIntensity * 0.12),
      duality: Math.min(1, baseBehavior.duality + noveltyScore * 0.08),
      coherence: Math.min(1, baseBehavior.coherence + repeatScore * 0.05),
      focusIntensity: Math.min(1, baseBehavior.focusIntensity + sessionIntensity * 0.08),
      noiseSpeed: baseBehavior.noiseSpeed * (1 + sessionIntensity * 0.16),
      satelliteCount: Math.max(baseBehavior.satelliteCount, baseBehavior.satelliteCount + Math.round(eventCount / 6)),
    }
    const caption = buildSoulOrbCaption(blendedProfile, resonance, variantName)

    return {
      ...blendedProfile,
      variant: variantName,
      palette,
      behavior,
      caption,
      shader: {
        pulse: behavior.coreBrightness,
        stateMix: behavior.coherence,
        focusIntensity: behavior.focusIntensity,
        degradedFactor: behavior.degradedFactor,
        noiseScale: behavior.noiseScale,
        noiseSpeed: behavior.noiseSpeed,
        shellOpacity: behavior.shellOpacity,
        fresnelIntensity: behavior.fresnelIntensity,
        auraScale: behavior.auraScale,
        duality: behavior.duality,
      },
      threads: {
        visible: variant.threadOpacity > 0,
        opacity: variant.threadOpacity,
        count: resonance?.kind === 'edge' ? 2 : resonance ? 1 : 0,
      },
      liveSignal: {
        eventCount,
        sessionIntensity,
        noveltyScore,
        repeatScore,
      },
      caption: {
        ...caption,
        detail: eventCount
          ? `${caption.detail} Recent listening is actively shaping the entity through ${eventCount} live event${eventCount === 1 ? '' : 's'}.`
          : caption.detail,
      },
    }
  }, [
    analyticsMetrics,
    audioFeatures,
    confidence,
    dataQuality,
    genres,
    mbti,
    mbtiMeta,
    mode,
    personality,
    personalityMeta,
    resonance,
    liveSignal,
    topArtists,
  ])
}
