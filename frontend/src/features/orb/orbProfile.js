const clamp = (value, min = 0, max = 1) => {
  if (value == null || Number.isNaN(Number(value))) return null
  return Math.max(min, Math.min(max, Number(value)))
}

const safeScore = (value) => {
  if (value == null) return null
  return Math.max(0, Math.min(1, Number(value)))
}

const average = (values = []) => {
  const valid = values.filter((value) => value != null)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

const normalizeTempo = (tempo) => {
  if (tempo == null) return null
  return clamp((Number(tempo) - 60) / 140)
}

const hexToRgb = (hex) => {
  const cleaned = (hex || '#7c6fff').replace('#', '')
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((char) => char + char).join('')
    : cleaned
  const parsed = Number.parseInt(normalized, 16)
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

const rgbToHex = ({ r, g, b }) => (
  `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`
)

const mixHex = (colorA, colorB, ratio = 0.5) => {
  const amount = Math.max(0, Math.min(1, ratio))
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  return rgbToHex({
    r: a.r + ((b.r - a.r) * amount),
    g: a.g + ((b.g - a.g) * amount),
    b: a.b + ((b.b - a.b) * amount),
  })
}

// ── Data-driven warm color ramp ──────────────────────────────────────────────
// Hue is driven by the user's REAL valence — never a purple default. The orb
// lives in the warm filmic palette; cool violet appears ONLY when valence is
// genuinely at the floor (deep, joyless listening). Mid valence reads as warm
// peach-rose-gold, NOT lavender. A missing valence falls back to neutral warm.
//
// Stops: valence position -> core hue.
const VALENCE_STOPS = [
  { at: 0.00, color: '#b59cff' }, // extreme-low only: cool violet
  { at: 0.18, color: '#ff6f93' }, // deep rose
  { at: 0.38, color: '#ff8aa8' }, // rose
  { at: 0.55, color: '#ffb88a' }, // warm rose-gold (mid valence lands here)
  { at: 0.75, color: '#ffb35a' }, // amber
  { at: 1.00, color: '#ffd89b' }, // gold (high valence)
]
const NEUTRAL_WARM = '#ffc69b' // valence unknown → filmic amber, never purple

function lightenHex(hex, amount = 0.2) {
  return mixHexLocal(hex, '#ffffff', amount)
}

// Local mixHex alias kept above the export-time hoist of mixHex's definition.
function mixHexLocal(colorA, colorB, ratio) {
  const amount = Math.max(0, Math.min(1, ratio))
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  return rgbToHex({
    r: a.r + ((b.r - a.r) * amount),
    g: a.g + ((b.g - a.g) * amount),
    b: a.b + ((b.b - a.b) * amount),
  })
}

function sampleValenceRamp(valence) {
  if (valence == null) return NEUTRAL_WARM
  const v = Math.max(0, Math.min(1, valence))
  for (let i = 0; i < VALENCE_STOPS.length - 1; i += 1) {
    const lo = VALENCE_STOPS[i]
    const hi = VALENCE_STOPS[i + 1]
    if (v >= lo.at && v <= hi.at) {
      const t = (v - lo.at) / Math.max(hi.at - lo.at, 1e-6)
      return mixHexLocal(lo.color, hi.color, t)
    }
  }
  return VALENCE_STOPS[VALENCE_STOPS.length - 1].color
}

// Build the full warm palette from real signal. Valence drives hue; energy and
// brightness only shift luminosity, never hue.
function deriveSignalColors({ valence, energy, brightness }) {
  const core = sampleValenceRamp(valence)
  // Glow is a brighter, slightly more saturated sibling of the core; higher
  // energy lifts it a touch (more inner light), kept calm.
  const energyLift = energy == null ? 0.12 : 0.08 + energy * 0.16
  const glow = lightenHex(core, energyLift)
  const accent = lightenHex(core, 0.34)
  // Brightness (sonic) raises the whole core's luminosity ceiling.
  const lum = brightness == null ? 0.5 : brightness
  const litCore = lightenHex(core, lum * 0.16)
  return {
    primary: litCore,
    secondary: glow,
    accent,
    shadow: mixHexLocal(core, '#140a08', 0.74), // warm deep charcoal, not blue-black
    aura: mixHexLocal(glow, accent, 0.45),
  }
}

// Public helper for the 2D share cards: the SAME warm valence-driven palette
// the WebGL orb uses, so a card and the live orb always agree. Neutral filmic
// amber when valence is missing — never purple.
export function deriveWarmOrbColors({ audioFeatures = {}, analyticsMetrics = {} } = {}) {
  const valence = clamp(audioFeatures.valence)
  const energy = clamp(audioFeatures.energy)
  const brightness = analyticsMetrics?.sonicBrightness != null
    ? Math.max(0, Math.min(1, Number(analyticsMetrics.sonicBrightness) / 100))
    : null
  return deriveSignalColors({ valence, energy, brightness })
}

const TRAIT_BASES = {
  dreamy: {
    core: '#7c6fff',
    aura: '#93c5fd',
    accent: '#d8b4fe',
    noun: 'dream',
    texture: 'mist-soft',
  },
  nostalgic: {
    core: '#f59e0b',
    aura: '#fdba74',
    accent: '#fcd34d',
    noun: 'memory',
    texture: 'amber-worn',
  },
  chaotic: {
    core: '#f43f5e',
    aura: '#fb7185',
    accent: '#f472b6',
    noun: 'voltage',
    texture: 'fractured',
  },
  romantic: {
    core: '#ec4899',
    aura: '#f9a8d4',
    accent: '#c084fc',
    noun: 'velvet',
    texture: 'silk-lit',
  },
  melancholic: {
    core: '#4f46e5',
    aura: '#60a5fa',
    accent: '#818cf8',
    noun: 'ache',
    texture: 'deep-water',
  },
  cosmic: {
    core: '#6d28d9',
    aura: '#38bdf8',
    accent: '#8b5cf6',
    noun: 'starlight',
    texture: 'void-bound',
  },
}

const MOOD_FAMILIES = {
  melancholic: {
    primary: '#4f46e5',
    secondary: '#60a5fa',
    accent: '#8b5cf6',
    label: 'nocturne',
  },
  romantic: {
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#c084fc',
    label: 'afterglow',
  },
  euphoric: {
    primary: '#fb7185',
    secondary: '#f59e0b',
    accent: '#fcd34d',
    label: 'flare',
  },
  electric: {
    primary: '#22d3ee',
    secondary: '#7c3aed',
    accent: '#f472b6',
    label: 'spark',
  },
  dreamy: {
    primary: '#7c6fff',
    secondary: '#93c5fd',
    accent: '#c084fc',
    label: 'drift',
  },
  nostalgic: {
    primary: '#f59e0b',
    secondary: '#fdba74',
    accent: '#fca5a5',
    label: 'echo',
  },
}

const OPENERS = {
  dreamy: 'Dream-lit',
  nostalgic: 'Amber',
  chaotic: 'Electric',
  romantic: 'Velvet',
  melancholic: 'Minor-key',
  cosmic: 'Stellar',
}

const SECONDARY_NOUNS = {
  dreamy: 'resonance',
  nostalgic: 'memory',
  chaotic: 'fracture',
  romantic: 'hush',
  melancholic: 'ache',
  cosmic: 'drift',
}

const SUFFIX_BY_IDENTITY = {
  introvert: 'in quiet orbit',
  expressive: 'at full bloom',
  structured: 'held in clean rings',
  fluid: 'softly unstable',
  analytical: 'with lucid edges',
  emotional: 'at dusk',
}

function getTraitScore(personality = [], id) {
  const match = (personality || []).find((trait) => trait?.id === id)
  if (!match) return 0
  const pct = match.pct != null ? Number(match.pct) / 100 : 0
  return Math.max(0, Math.min(1, pct))
}

function getPrimaryTraits(personality = []) {
  const traits = Array.isArray(personality) ? personality.filter(Boolean) : []
  return {
    primary: traits[0] || null,
    secondary: traits[1] || traits[0] || null,
    tertiary: traits[2] || null,
  }
}

function deriveMoodFamily(audioFeatures = {}) {
  const energy = clamp(audioFeatures.energy)
  const valence = clamp(audioFeatures.valence)
  const acousticness = clamp(audioFeatures.acousticness)

  if (energy == null || valence == null) return 'dreamy'
  if (energy > 0.72 && valence > 0.62) return 'euphoric'
  if (energy > 0.7 && valence < 0.42) return 'electric'
  if (energy < 0.38 && valence < 0.38) return 'melancholic'
  if (energy < 0.42 && valence > 0.56) return 'romantic'
  if ((acousticness ?? 0) > 0.58) return 'nostalgic'
  return 'dreamy'
}

function deriveIdentityAxes(mbti) {
  const type = typeof mbti === 'string' ? mbti : mbti?.type
  if (!type || type.length < 4) {
    return {
      social: 'introvert',
      emotional: 'emotional',
      structure: 'fluid',
    }
  }
  return {
    social: type.startsWith('E') ? 'expressive' : 'introvert',
    emotional: type[2] === 'T' ? 'analytical' : 'emotional',
    structure: type[3] === 'J' ? 'structured' : 'fluid',
  }
}

function deriveListeningStyle({ analyticsMetrics = {}, genres = [], topArtists = [] }) {
  const diversityFromAnalytics = analyticsMetrics?.diversityScore != null
    ? safeScore(Number(analyticsMetrics.diversityScore) / 100)
    : null
  const brightness = analyticsMetrics?.sonicBrightness != null
    ? safeScore(Number(analyticsMetrics.sonicBrightness) / 100)
    : null
  const avgPopularity = average((topArtists || []).map((artist) => {
    if (artist?.popularity == null) return null
    return Number(artist.popularity) / 100
  }))
  const genreBreadth = Math.min((genres || []).length / 12, 1)
  const diversity = diversityFromAnalytics ?? genreBreadth

  const rarity = avgPopularity == null ? 0.45 : 1 - avgPopularity
  return {
    diversity,
    rarity,
    brightness,
    genreBreadth,
  }
}

function deriveConfidenceState(confidence = {}, dataQuality = {}) {
  const identityScore = typeof confidence?.identity === 'number'
    ? confidence.identity
    : typeof confidence?.identity?.score === 'number'
      ? confidence.identity.score
      : 0
  const audioCoverage = Number(dataQuality?.audioCoverage || 0)
  const score = Math.max(identityScore, audioCoverage * 0.85)
  const label = score >= 0.8 ? 'fully formed' : score >= 0.55 ? 'forming clearly' : score >= 0.3 ? 'partial signal' : 'limited signal'
  return {
    score: Number(score.toFixed(3)),
    label,
    shellCount: score >= 0.8 ? 3 : score >= 0.45 ? 2 : 1,
    satelliteCount: score >= 0.8 ? 6 : score >= 0.55 ? 4 : score >= 0.3 ? 2 : 0,
    complexity: score >= 0.8 ? 1 : score >= 0.55 ? 0.78 : score >= 0.3 ? 0.55 : 0.36,
  }
}

function buildDeterministicLabel({ primaryTrait, secondaryTrait, moodFamily, identityAxes, listeningStyle }) {
  const opener = OPENERS[primaryTrait?.id] || 'Quiet'
  const noun = SECONDARY_NOUNS[secondaryTrait?.id] || 'signal'
  const mood = MOOD_FAMILIES[moodFamily]?.label || 'echo'

  let suffix = SUFFIX_BY_IDENTITY[identityAxes.social]
  if (listeningStyle.rarity > 0.62) suffix = 'off-axis'
  else if (listeningStyle.diversity > 0.65) suffix = 'in shifting orbit'
  else if (identityAxes.structure === 'structured') suffix = SUFFIX_BY_IDENTITY.structured
  else if (identityAxes.emotional === 'analytical') suffix = SUFFIX_BY_IDENTITY.analytical
  else if (identityAxes.emotional === 'emotional') suffix = SUFFIX_BY_IDENTITY.emotional

  return `${opener} ${noun} ${mood === 'echo' ? 'loop' : mood} ${suffix}`
}

export function deriveOrbProfile({
  personality = [],
  personalityMeta = null,
  mbti = null,
  mbtiMeta = null,
  audioFeatures = {},
  analyticsMetrics = {},
  confidence = {},
  dataQuality = {},
  genres = [],
  topArtists = [],
} = {}) {
  const traits = getPrimaryTraits(personality)
  const moodFamily = deriveMoodFamily(audioFeatures)
  const identityAxes = deriveIdentityAxes(mbti)
  const listeningStyle = deriveListeningStyle({ analyticsMetrics, genres, topArtists })
  const formation = deriveConfidenceState(confidence, dataQuality)

  const traitBase = TRAIT_BASES[traits.primary?.id] || TRAIT_BASES.cosmic

  const energy = clamp(audioFeatures.energy)
  const valence = clamp(audioFeatures.valence)
  const danceability = clamp(audioFeatures.danceability)
  const acousticness = clamp(audioFeatures.acousticness)
  const instrumentalness = clamp(audioFeatures.instrumentalness)
  const speechiness = clamp(audioFeatures.speechiness)
  const tempo = normalizeTempo(audioFeatures.tempo)

  const emotionalVolatility = average([
    energy != null ? Math.abs(energy - 0.5) * 2 : null,
    valence != null ? Math.abs(valence - 0.5) * 2 : null,
    getTraitScore(personality, 'chaotic'),
  ]) ?? (1 - formation.score) * 0.4

  const syntheticTilt = average([
    acousticness != null ? 1 - acousticness : null,
    speechiness,
  ]) ?? 0.35

  const pulseSpeed = 0.35 + ((danceability ?? 0.35) * 0.9) + ((tempo ?? 0.35) * 0.35)
  const pulseAmplitude = (0.035 + ((energy ?? 0.3) * 0.045) + ((danceability ?? 0.3) * 0.025)) * formation.complexity
  const breatheAmplitude = (0.05 + emotionalVolatility * 0.08) * formation.complexity
  const distort = (0.14 + (syntheticTilt * 0.18) + (getTraitScore(personality, 'chaotic') * 0.12)) * formation.complexity
  const distortSpeed = 0.45 + pulseSpeed * (syntheticTilt > 0.55 ? 1.7 : 1.2)
  const rotationSpeed = (identityAxes.social === 'expressive' ? 0.32 : 0.18) + ((tempo ?? 0.25) * 0.18)
  const rotationWobble = (identityAxes.structure === 'fluid' ? 0.18 : 0.08) + (getTraitScore(personality, 'chaotic') * 0.18)
  const floatSpeed = 0.42 + ((valence ?? 0.4) * 0.28)
  const brightnessInfluence = listeningStyle.brightness != null ? listeningStyle.brightness : 0.45
  const glowIntensity = (0.55 + ((valence ?? 0.35) * 0.3) + (brightnessInfluence * 0.15)) * formation.complexity
  const ringWarp = (identityAxes.structure === 'fluid' ? 0.22 : 0.08) + (getTraitScore(personality, 'chaotic') * 0.12)

  // Warm, valence-driven palette (no purple default). Brightness lifts the
  // inner-core luminosity; energy gives the glow a touch more inner light.
  const signalColors = deriveSignalColors({
    valence,
    energy,
    brightness: listeningStyle.brightness,
  })

  const evidence = [
    energy != null ? `Energy ${Math.round(energy * 100)}% shapes its pulse` : null,
    valence != null ? `Valence ${Math.round(valence * 100)}% drives the emotional light` : null,
    acousticness != null ? `${acousticness > 0.55 ? 'Organic' : 'Synthetic'} texture comes from acoustic balance` : null,
    analyticsMetrics?.diversityScore != null ? `Diversity ${analyticsMetrics.diversityScore}% informs its outer complexity` : null,
    traits.primary?.label ? `${traits.primary.label} is the dominant trait` : null,
    mbti?.type ? `${mbti.type} shapes its behavioral posture` : null,
  ].filter(Boolean)

  return {
    traits,
    moodFamily,
    identityAxes,
    formation,
    listeningStyle,
    colors: signalColors,
    behavior: {
      pulseSpeed,
      pulseAmplitude,
      breatheAmplitude,
      distort,
      distortSpeed,
      rotationSpeed,
      rotationWobble,
      floatSpeed,
      glowIntensity,
      ringWarp,
      shellCount: formation.shellCount,
      satelliteCount: formation.satelliteCount,
    },
    labels: {
      title: buildDeterministicLabel({
        primaryTrait: traits.primary,
        secondaryTrait: traits.secondary,
        moodFamily,
        identityAxes,
        listeningStyle,
      }),
      subtitle: formation.label,
    },
    descriptors: {
      emotional: moodFamily,
      texture: syntheticTilt > 0.58 ? 'synthetic shimmer' : acousticness != null && acousticness > 0.58 ? 'organic haze' : traitBase.texture,
      motion: pulseSpeed > 0.95 ? 'restless pulse' : pulseSpeed > 0.7 ? 'lithe orbit' : 'slow breathing',
      listening: listeningStyle.rarity > 0.58 ? 'edge-seeking' : listeningStyle.diversity > 0.6 ? 'wide-spectrum' : 'core-focused',
    },
    evidence,
    missingInputs: [
      energy == null ? 'energy' : null,
      valence == null ? 'valence' : null,
      danceability == null ? 'danceability' : null,
      acousticness == null ? 'acousticness' : null,
      mbtiMeta?.value == null && !mbti?.type ? 'mbti' : null,
    ].filter(Boolean),
    confidenceReasons: dataQuality?.degradedReasons || [],
  }
}
