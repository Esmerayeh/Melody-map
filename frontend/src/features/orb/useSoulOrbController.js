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
    const behavior = buildSoulOrbBehavior(blendedProfile, variant)
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
    topArtists,
  ])
}
