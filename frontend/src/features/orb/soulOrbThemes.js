const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value ?? 0))

export const SOUL_ORB_VARIANTS = {
  idle: {
    label: 'idle',
    pulse: 1,
    glow: 1,
    aura: 1,
    particles: 1,
    rings: 1,
    fluid: 1,
    threadOpacity: 0,
  },
  hover_artist: {
    label: 'hover_artist',
    pulse: 1.06,
    glow: 1.12,
    aura: 1.08,
    particles: 1.08,
    rings: 1.05,
    fluid: 1.08,
    threadOpacity: 0.28,
  },
  focus_artist: {
    label: 'focus_artist',
    pulse: 1.14,
    glow: 1.22,
    aura: 1.18,
    particles: 1.18,
    rings: 1.12,
    fluid: 1.16,
    threadOpacity: 0.46,
  },
  hover_region: {
    label: 'hover_region',
    pulse: 1.02,
    glow: 1.1,
    aura: 1.22,
    particles: 1.05,
    rings: 1.1,
    fluid: 1.05,
    threadOpacity: 0.18,
  },
  focus_region: {
    label: 'focus_region',
    pulse: 1.08,
    glow: 1.2,
    aura: 1.3,
    particles: 1.12,
    rings: 1.18,
    fluid: 1.12,
    threadOpacity: 0.34,
  },
  hover_bridge: {
    label: 'hover_bridge',
    pulse: 1.06,
    glow: 1.16,
    aura: 1.16,
    particles: 1.1,
    rings: 1.18,
    fluid: 1.14,
    threadOpacity: 0.32,
  },
  focus_bridge: {
    label: 'focus_bridge',
    pulse: 1.14,
    glow: 1.26,
    aura: 1.24,
    particles: 1.22,
    rings: 1.28,
    fluid: 1.2,
    threadOpacity: 0.5,
  },
  degraded_signal: {
    label: 'degraded_signal',
    pulse: 0.92,
    glow: 0.76,
    aura: 0.74,
    particles: 0.55,
    rings: 0.72,
    fluid: 0.68,
    threadOpacity: 0,
  },
  discovery_mode: {
    label: 'discovery_mode',
    pulse: 1.08,
    glow: 1.1,
    aura: 1.08,
    particles: 1.28,
    rings: 1.08,
    fluid: 1.14,
    threadOpacity: 0.18,
  },
  soulmate_mode: {
    label: 'soulmate_mode',
    pulse: 1.16,
    glow: 1.26,
    aura: 1.26,
    particles: 1.24,
    rings: 1.22,
    fluid: 1.18,
    threadOpacity: 0.58,
  },
}

function pickBridgePhrase(kind = 'artist', mode = 'live') {
  if (kind === 'edge') return mode === 'focused' ? 'bridge state: two worlds held together' : 'emotional bridge unstable'
  if (kind === 'region') return mode === 'focused' ? 'regional weather settling into orbit' : 'soft field shift detected'
  return mode === 'focused' ? 'luminous ache in rotation' : 'quiet signal drift at dusk'
}

export function getSoulOrbVariant(orbProfile, resonance) {
  if (orbProfile?.formation?.score < 0.32) return 'degraded_signal'
  if (resonance?.kind === 'edge') return resonance.mode === 'focused' ? 'focus_bridge' : 'hover_bridge'
  if (resonance?.kind === 'cluster' || resonance?.kind === 'region') return resonance.mode === 'focused' ? 'focus_region' : 'hover_region'
  if (resonance?.kind === 'artist' || resonance?.kind === 'core') return resonance.mode === 'focused' ? 'focus_artist' : 'hover_artist'
  if ((orbProfile?.listeningStyle?.rarity || 0) > 0.64) return 'discovery_mode'
  return 'idle'
}

export function buildSoulOrbCaption(orbProfile, resonance, variantName) {
  if (variantName === 'degraded_signal') {
    return {
      micro: 'partial signal, softly held',
      detail: 'The entity is forming from incomplete listening data, so it keeps its motion restrained and its reading honest.',
    }
  }

  if (variantName === 'discovery_mode') {
    return {
      micro: 'fragments of stranger songs in orbit',
      detail: 'Your outer listening edge is tinting the orb with rarer, more exploratory motion.',
    }
  }

  if (resonance) {
    const target = resonance.label?.toLowerCase() || 'this signal'
    if (resonance.kind === 'artist' || resonance.kind === 'core') {
      return {
        micro: resonance.mode === 'focused'
          ? `${target} held inside the listening entity`
          : `resonating with ${target}`,
        detail: resonance.explanation,
      }
    }

    if (resonance.kind === 'cluster' || resonance.kind === 'region') {
      return {
        micro: pickBridgePhrase('region', resonance.mode),
        detail: resonance.explanation,
      }
    }

    if (resonance.kind === 'edge') {
      return {
        micro: pickBridgePhrase('edge', resonance.mode),
        detail: resonance.explanation,
      }
    }
  }

  const emotional = orbProfile?.descriptors?.emotional || 'dreamy'
  const motion = orbProfile?.descriptors?.motion || 'slow breathing'
  return {
    micro: orbProfile?.labels?.title?.toLowerCase() || 'quiet signal drift at dusk',
    detail: `${emotional} core held in ${motion}.`,
  }
}

export function buildSoulOrbPalette(orbProfile, resonance, variant) {
  const base = orbProfile.colors
  const auraStrength = variant.aura
  const bridgeBlend = resonance?.kind === 'edge' ? 0.22 : resonance?.kind === 'region' || resonance?.kind === 'cluster' ? 0.14 : 0.08

  return {
    core: base.primary,
    glow: base.secondary,
    ring: base.accent,
    shell: base.aura,
    shadow: base.shadow,
    aura: base.aura,
    thread: resonance?.colors?.accent || base.accent,
    glass: bridgeBlend,
    auraStrength,
  }
}

export function buildSoulOrbBehavior(orbProfile, variant) {
  const degradedFactor = clamp(1 - orbProfile.formation.score * 1.4, 0, 0.9)
  const focusIntensity = clamp(
    ((variant.label.includes('focus') ? 0.8 : variant.label.includes('hover') ? 0.54 : 0.34)
      + orbProfile.formation.complexity * 0.28)
      * (1 - degradedFactor * 0.3),
    0.18,
    1,
  )
  const auraScale = clamp(0.92 + variant.aura * 0.16 + orbProfile.formation.score * 0.12, 0.9, 1.38)
  const shellOpacity = clamp((0.22 + orbProfile.formation.complexity * 0.14) * (1 - degradedFactor * 0.28), 0.14, 0.46)
  const duality = clamp(
    (variant.label === 'soulmate_mode' ? 0.82 : variant.label.includes('bridge') ? 0.54 : 0.16)
      + (variant.label === 'discovery_mode' ? 0.14 : 0),
    0,
    1,
  )

  return {
    ...orbProfile.behavior,
    pulseSpeed: orbProfile.behavior.pulseSpeed * variant.pulse,
    pulseAmplitude: orbProfile.behavior.pulseAmplitude * variant.pulse,
    breatheAmplitude: orbProfile.behavior.breatheAmplitude * variant.aura,
    distort: orbProfile.behavior.distort * variant.fluid,
    distortSpeed: orbProfile.behavior.distortSpeed * variant.fluid,
    glowIntensity: orbProfile.behavior.glowIntensity * variant.glow,
    rotationSpeed: orbProfile.behavior.rotationSpeed * variant.rings,
    rotationWobble: orbProfile.behavior.rotationWobble * variant.rings,
    ringWarp: orbProfile.behavior.ringWarp * variant.rings,
    shellCount: Math.max(1, Math.round(orbProfile.behavior.shellCount * variant.rings)),
    satelliteCount: Math.max(0, Math.round(orbProfile.behavior.satelliteCount * variant.particles)),
    haloOpacity: clamp((0.32 + orbProfile.formation.complexity * 0.3) * variant.aura, 0.18, 0.9),
    particleOpacity: clamp((0.24 + orbProfile.formation.complexity * 0.24) * variant.particles, 0.12, 0.92),
    threadOpacity: variant.threadOpacity,
    focusIntensity,
    auraScale,
    shellOpacity,
    degradedFactor,
    duality,
    noiseScale: clamp(1.7 + orbProfile.formation.complexity * 1.6 + variant.fluid * 0.42, 1.5, 3.8),
    noiseSpeed: clamp(0.14 + orbProfile.behavior.distortSpeed * 0.22 * variant.fluid, 0.08, 0.72),
    coherence: clamp(0.34 + variant.fluid * 0.24 + orbProfile.formation.score * 0.3 - degradedFactor * 0.24, 0.2, 1),
    coreBrightness: clamp(0.54 + variant.glow * 0.18 + orbProfile.formation.score * 0.22, 0.46, 1.08),
    fresnelIntensity: clamp(0.28 + variant.glow * 0.18 + (variant.label.includes('focus') ? 0.14 : 0), 0.24, 0.9),
  }
}
