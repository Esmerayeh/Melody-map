const clamp = (value, min = 0, max = 1) => {
  if (value == null || Number.isNaN(Number(value))) return null
  return Math.max(min, Math.min(max, Number(value)))
}

const average = (values = []) => {
  const valid = values.filter((value) => value != null)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

const averageFeatures = (items = []) => ({
  energy: average(items.map((item) => item?.audioFeatures?.energy)),
  valence: average(items.map((item) => item?.audioFeatures?.valence)),
  danceability: average(items.map((item) => item?.audioFeatures?.danceability)),
  acousticness: average(items.map((item) => item?.audioFeatures?.acousticness)),
  instrumentalness: average(items.map((item) => item?.audioFeatures?.instrumentalness)),
  speechiness: average(items.map((item) => item?.audioFeatures?.speechiness)),
  tempo: average(items.map((item) => item?.audioFeatures?.tempo)),
})

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

const blendNumber = (base, next, ratio) => {
  if (next == null) return base
  if (base == null) return next
  return base + ((next - base) * ratio)
}

const moodDescriptor = (label = '') => {
  const normalized = (label || '').toLowerCase()
  if (normalized.includes('haunted') || normalized.includes('melanch')) return 'darkens and deepens the orb because this region sits in your more nocturnal listening self.'
  if (normalized.includes('romantic')) return 'warms the orb because this region reflects one of your softer, more emotionally open worlds.'
  if (normalized.includes('electric') || normalized.includes('euphoric')) return 'brightens and sharpens the orb because this region carries stronger motion and intensity.'
  if (normalized.includes('nostalg')) return 'softens the orb into amber memory because this region leans into older, warmer emotional signatures.'
  return 'reshapes the orb because this region reveals a distinct emotional climate inside your music identity.'
}

function buildBasePayload({
  kind,
  label,
  subtitle,
  color,
  accent,
  features,
  metrics = {},
  confidence = 0.6,
  evidence = [],
  explanation,
  strength = 0.65,
  mode = 'focused',
}) {
  const energy = clamp(features.energy)
  const valence = clamp(features.valence)
  const danceability = clamp(features.danceability)
  const acousticness = clamp(features.acousticness)
  const syntheticTilt = average([
    acousticness != null ? 1 - acousticness : null,
    clamp(features.speechiness),
  ]) ?? 0.35

  return {
    kind,
    label,
    subtitle,
    mode,
    strength,
    confidence,
    colors: {
      primary: color || '#7c6fff',
      secondary: mixHex(color || '#7c6fff', accent || '#93c5fd', 0.45),
      accent: accent || '#c084fc',
    },
    features,
    metrics,
    influence: {
      pulseSpeed: (danceability ?? 0.45) * 0.35 + (energy ?? 0.4) * 0.28,
      pulseAmplitude: (energy ?? 0.4) * 0.22,
      breatheAmplitude: (Math.abs((valence ?? 0.45) - 0.5) * 0.32) + (metrics.discoveryScore ?? 0) * 0.08,
      distort: syntheticTilt * 0.28 + (metrics.bridgeScore ?? 0) * 0.12,
      rotationSpeed: ((danceability ?? 0.35) * 0.18) + ((metrics.centrality ?? 0.4) * 0.08),
      rotationWobble: ((metrics.bridgeScore ?? 0.2) * 0.24) + ((metrics.discoveryScore ?? 0.2) * 0.1),
      glowIntensity: ((valence ?? 0.45) * 0.26) + ((metrics.centrality ?? 0.35) * 0.18),
      ringWarp: ((metrics.bridgeScore ?? 0.2) * 0.26) + ((metrics.discoveryScore ?? 0.2) * 0.14),
      shellBonus: strength > 0.7 ? 1 : 0,
      satelliteBonus: strength > 0.62 ? 2 : 1,
    },
    evidence,
    explanation,
  }
}

export function mapGalaxySelectionToResonance({ node, cluster, region, edge, model, mode = 'focused' }) {
  const strengthMultiplier = mode === 'live' ? 0.58 : 0.84

  if (node) {
    const role = node.role?.replace(/-/g, ' ') || node.type
    return buildBasePayload({
      kind: node.type,
      label: node.label,
      subtitle: `Resonating with ${role}`,
      color: node.color,
      accent: node.metrics?.bridgeScore > 0.48 ? '#f472b6' : '#93c5fd',
      features: node.audioFeatures || {},
      metrics: node.metrics || {},
      confidence: node.confidence ?? 0.6,
      strength: Math.min(0.94, strengthMultiplier + (node.metrics?.significance || 0.3) * 0.2),
      mode,
      evidence: [
        node.regionLabel ? `${node.regionLabel} mood field` : null,
        node.metrics?.bridgeScore > 0.48 ? 'Bridge artist energy' : null,
        node.metrics?.discoveryScore > 0.55 ? 'Discovery frontier pull' : null,
        node.genres?.[0] ? `${node.genres[0]} influence` : null,
      ].filter(Boolean),
      explanation: node.metrics?.bridgeScore > 0.48
        ? `${node.label} bends the orb into a layered state because it bridges more than one part of your listening universe.`
        : `${node.label} reshapes the orb through its local emotional signature and role inside your galaxy.`,
    })
  }

  if (cluster) {
    const members = (cluster.members || [])
      .map((id) => model?.nodes?.find((entry) => entry.id === id))
      .filter(Boolean)
    const features = averageFeatures(members)
    return buildBasePayload({
      kind: 'cluster',
      label: cluster.label,
      subtitle: `Immersed in ${cluster.label}`,
      color: cluster.color,
      accent: cluster.metrics?.bridgeScore > 0.42 ? '#f9a8d4' : '#93c5fd',
      features,
      metrics: cluster.metrics || {},
      confidence: average(members.map((member) => member.confidence)) ?? 0.68,
      strength: Math.min(0.95, strengthMultiplier + (cluster.metrics?.centrality || 0.35) * 0.18),
      mode,
      evidence: [
        cluster.dominantGenres?.[0] ? `${cluster.dominantGenres[0]} territory` : null,
        cluster.metrics?.bridgeScore > 0.45 ? 'Bridge corridor tension' : null,
        cluster.metrics?.discoveryScore > 0.5 ? 'Frontier cluster pull' : null,
        `${cluster.size || 0} artist bodies`,
      ].filter(Boolean),
      explanation: `${cluster.label} changes the orb because it gathers a whole neighborhood of your listening identity into one emotional field.`,
    })
  }

  if (region) {
    const members = (region.members || [])
      .map((id) => model?.nodes?.find((entry) => entry.id === id))
      .filter(Boolean)
    const features = averageFeatures(members)
    return buildBasePayload({
      kind: 'region',
      label: region.label,
      subtitle: `Touching your ${region.label} core`,
      color: region.color,
      accent: mixHex(region.color, '#f59e0b', 0.4),
      features,
      metrics: {
        centrality: region.coverage || 0.4,
        bridgeScore: average(members.map((member) => member.metrics?.bridgeScore)) ?? 0.2,
        discoveryScore: average(members.map((member) => member.metrics?.discoveryScore)) ?? 0.2,
      },
      confidence: average(members.map((member) => member.confidence)) ?? 0.64,
      strength: Math.min(0.92, strengthMultiplier + (region.coverage || 0.2) * 0.26),
      mode,
      evidence: [
        `${Math.round((region.coverage || 0) * 100)}% local coverage`,
        `${region.members?.length || 0} nearby bodies`,
      ],
      explanation: `This ${region.label} field ${moodDescriptor(region.label)}`,
    })
  }

  if (edge) {
    const source = model?.nodes?.find((entry) => entry.id === edge.source)
    const target = model?.nodes?.find((entry) => entry.id === edge.target)
    const features = averageFeatures([source, target])
    return buildBasePayload({
      kind: 'edge',
      label: edge.type.replace(/_/g, ' '),
      subtitle: edge.type === 'bridge_lane' ? 'Crossing a bridge between worlds' : 'Tracing a live connection',
      color: mixHex(source?.color || '#7c6fff', target?.color || '#93c5fd', 0.5),
      accent: edge.type === 'bridge_lane' ? '#f472b6' : '#c084fc',
      features,
      metrics: {
        centrality: average([source?.metrics?.centrality, target?.metrics?.centrality]) ?? 0.4,
        bridgeScore: edge.type === 'bridge_lane' ? 0.88 : average([source?.metrics?.bridgeScore, target?.metrics?.bridgeScore]) ?? 0.3,
        discoveryScore: average([source?.metrics?.discoveryScore, target?.metrics?.discoveryScore]) ?? 0.25,
      },
      confidence: edge.confidence ?? 0.6,
      strength: Math.min(0.9, strengthMultiplier + (edge.weight || 0.3) * 0.22),
      mode,
      evidence: [
        source?.label ? `Source: ${source.label}` : null,
        target?.label ? `Target: ${target.label}` : null,
        edge.type === 'bridge_lane' ? 'Bridge lane between clusters' : null,
      ].filter(Boolean),
      explanation: edge.type === 'bridge_lane'
        ? 'The orb layers multiple influences here because this connection represents one of your true bridge routes between distinct music worlds.'
        : edge.explanation,
    })
  }

  return null
}

export function blendOrbProfile(baseProfile, resonance) {
  if (!resonance) {
    return {
      ...baseProfile,
      resonance: null,
    }
  }

  const ratio = Math.max(0, Math.min(1, (resonance.strength || 0.6) * (resonance.mode === 'live' ? 0.72 : 1)))
  const behavior = {
    ...baseProfile.behavior,
    pulseSpeed: blendNumber(baseProfile.behavior.pulseSpeed, baseProfile.behavior.pulseSpeed + resonance.influence.pulseSpeed, ratio),
    pulseAmplitude: blendNumber(baseProfile.behavior.pulseAmplitude, baseProfile.behavior.pulseAmplitude + resonance.influence.pulseAmplitude, ratio),
    breatheAmplitude: blendNumber(baseProfile.behavior.breatheAmplitude, baseProfile.behavior.breatheAmplitude + resonance.influence.breatheAmplitude, ratio),
    distort: blendNumber(baseProfile.behavior.distort, baseProfile.behavior.distort + resonance.influence.distort, ratio),
    distortSpeed: blendNumber(baseProfile.behavior.distortSpeed, baseProfile.behavior.distortSpeed + resonance.influence.distort * 0.9, ratio),
    rotationSpeed: blendNumber(baseProfile.behavior.rotationSpeed, baseProfile.behavior.rotationSpeed + resonance.influence.rotationSpeed, ratio),
    rotationWobble: blendNumber(baseProfile.behavior.rotationWobble, baseProfile.behavior.rotationWobble + resonance.influence.rotationWobble, ratio),
    glowIntensity: blendNumber(baseProfile.behavior.glowIntensity, baseProfile.behavior.glowIntensity + resonance.influence.glowIntensity, ratio),
    ringWarp: blendNumber(baseProfile.behavior.ringWarp, baseProfile.behavior.ringWarp + resonance.influence.ringWarp, ratio),
    shellCount: Math.max(baseProfile.behavior.shellCount, baseProfile.behavior.shellCount + Math.round((resonance.influence.shellBonus || 0) * ratio)),
    satelliteCount: Math.max(baseProfile.behavior.satelliteCount, baseProfile.behavior.satelliteCount + Math.round((resonance.influence.satelliteBonus || 0) * ratio)),
  }

  return {
    ...baseProfile,
    colors: {
      primary: mixHex(baseProfile.colors.primary, resonance.colors.primary, ratio * 0.75),
      secondary: mixHex(baseProfile.colors.secondary, resonance.colors.secondary, ratio * 0.7),
      accent: mixHex(baseProfile.colors.accent, resonance.colors.accent, ratio * 0.82),
      shadow: mixHex(baseProfile.colors.shadow, resonance.colors.primary, ratio * 0.22),
      aura: mixHex(baseProfile.colors.aura, resonance.colors.secondary, ratio * 0.68),
    },
    behavior,
    labels: {
      title: baseProfile.labels.title,
      subtitle: resonance.subtitle || baseProfile.labels.subtitle,
    },
    descriptors: {
      ...baseProfile.descriptors,
      emotional: resonance.label ? `${baseProfile.descriptors.emotional} × ${resonance.label.toLowerCase()}` : baseProfile.descriptors.emotional,
    },
    evidence: [
      ...(resonance.evidence || []),
      ...baseProfile.evidence,
    ].slice(0, 5),
    resonance: {
      ...resonance,
      ratio: Number(ratio.toFixed(3)),
    },
  }
}
