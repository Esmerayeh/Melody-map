const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value ?? 0))

const average = (values = []) => {
  const valid = values.filter((value) => value != null)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function stableHash(input = '') {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function seededOffset(seed, scale = 1) {
  const n = stableHash(seed)
  const x = ((n % 997) / 997) - 0.5
  const y = (((n >> 3) % 991) / 991) - 0.5
  const z = (((n >> 7) % 983) / 983) - 0.5
  return { x: x * scale, y: y * scale, z: z * scale }
}

/**
 * buildSemanticPosition
 * ─────────────────────
 * Converts audio features into a deterministic 3-D galaxy coordinate.
 *
 * Axis semantics:
 *   x = valence   — emotional brightness (dark/melancholic ←0.5→ bright/joyful)
 *   y = energy    — intensity            (quiet/ambient   ←0.5→ loud/intense)
 *   z = texture   — 0.6×acousticness + 0.4×(1-danceability)
 *                   (electronic/kinetic  ←0.5→ organic/still)
 *
 * Scale: ±SCALE_X/Y/Z units from the galaxy centre.
 *
 * @param {object} features  audio feature object { valence, energy, acousticness, danceability }
 * @param {string} jitterSeed  stable string for deterministic jitter (artist ID or name)
 * @param {object} options
 * @param {number} [options.jitterScale=0.9]   visual scatter — keep small so semantics dominate
 * @param {number} [options.radialBoost=1.0]   discovery/frontier push multiplier
 * @returns {{ x, y, z, _basis }}
 */
export function buildSemanticPosition(features = {}, jitterSeed = '', options = {}) {
  const { jitterScale = 0.9, radialBoost = 1.0 } = options

  const v = clamp(features.valence       ?? 0.5)  // 0 = dark, 1 = bright
  const e = clamp(features.energy        ?? 0.5)  // 0 = quiet, 1 = intense
  const a = clamp(features.acousticness  ?? 0.5)  // 0 = electronic, 1 = acoustic
  const d = clamp(features.danceability  ?? 0.5)  // 0 = static, 1 = kinetic
  const organic = a * 0.6 + (1 - d) * 0.4         // 0 = synthetic/kinetic, 1 = organic/still

  const jitter = seededOffset(jitterSeed || 'default', jitterScale)

  return {
    x: Number(((v - 0.5) * 18 * radialBoost + jitter.x).toFixed(2)),
    y: Number(((e - 0.5) * 15 * radialBoost + jitter.y).toFixed(2)),
    z: Number(((organic - 0.5) * 13 * radialBoost + jitter.z).toFixed(2)),
    // basis exposed so Auralith can explain why two stars are near each other
    _basis: { valence: +v.toFixed(3), energy: +e.toFixed(3), acousticness: +a.toFixed(3), danceability: +d.toFixed(3), organic: +organic.toFixed(3) },
  }
}

/**
 * averageFeatures
 * ───────────────
 * Compute the mean of each audio feature dimension across an array of
 * feature objects.  Used to derive a genre's representative sonic position.
 */
export function averageFeatures(featureArray = []) {
  const keys = ['valence', 'energy', 'acousticness', 'danceability', 'instrumentalness']
  const result = {}
  keys.forEach((key) => {
    const valid = featureArray.map((f) => f?.[key]).filter((v) => v != null && !Number.isNaN(v))
    result[key] = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null
  })
  return result
}

/**
 * featureDistance
 * ───────────────
 * Euclidean distance in audio-feature space: [valence, energy, organic].
 * Returns 0 (identical) – √3 (maximally different).
 * Used for Auralith galaxy explanations.
 */
export function featureDistance(a = {}, b = {}) {
  const va = clamp(a.valence ?? 0.5), vb = clamp(b.valence ?? 0.5)
  const ea = clamp(a.energy  ?? 0.5), eb = clamp(b.energy  ?? 0.5)
  const oa = (clamp(a.acousticness ?? 0.5) * 0.6 + (1 - clamp(a.danceability ?? 0.5)) * 0.4)
  const ob = (clamp(b.acousticness ?? 0.5) * 0.6 + (1 - clamp(b.danceability ?? 0.5)) * 0.4)
  return +Math.sqrt((va-vb)**2 + (ea-eb)**2 + (oa-ob)**2).toFixed(4)
}

/**
 * explainProximity
 * ────────────────
 * Returns a human-readable sentence explaining why two nodes are close.
 */
export function explainProximity(featA = {}, featB = {}) {
  const axes = [
    { key: 'valence',      label: 'emotional brightness', aName: 'dark', bName: 'bright' },
    { key: 'energy',       label: 'intensity',            aName: 'quiet', bName: 'loud'  },
    { key: 'acousticness', label: 'texture',              aName: 'electronic', bName: 'acoustic' },
  ]
  const shared = []
  axes.forEach(({ key, label, aName, bName }) => {
    const va = featA[key] ?? 0.5
    const vb = featB[key] ?? 0.5
    if (Math.abs(va - vb) < 0.18) {
      const side = va < 0.38 ? aName : va > 0.62 ? bName : 'mid-range'
      shared.push(`${label} (both ${side})`)
    }
  })
  if (shared.length === 0) return 'They share a general sonic neighbourhood despite surface differences.'
  return `They occupy the same region of ${shared.join(' and ')} in the audio-feature space.`
}

export function sonicColor(features = {}, confidence = 1) {
  const valence = features.valence ?? 0.5
  const energy = features.energy ?? 0.5
  const hue = Math.round(valence * 260)
  const saturation = Math.round(45 + energy * 30 + confidence * 10)
  const lightness = Math.round(35 + valence * 16 + confidence * 8)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function genreColor(label = '') {
  const hue = stableHash(label.toLowerCase()) % 360
  return `hsl(${hue}, 72%, 58%)`
}

export function similarityScore(artistA = {}, artistB = {}, profileFeatures = {}) {
  const genresA = new Set((artistA.genres || []).map((genre) => genre.toLowerCase()))
  const genresB = new Set((artistB.genres || []).map((genre) => genre.toLowerCase()))
  const sharedGenres = [...genresA].filter((genre) => genresB.has(genre))
  const genreScore = genresA.size || genresB.size
    ? sharedGenres.length / Math.max(genresA.size, genresB.size, 1)
    : 0

  const featuresA = artistA.audioFeatures || profileFeatures || {}
  const featuresB = artistB.audioFeatures || profileFeatures || {}
  const audioKeys = ['energy', 'valence', 'danceability', 'acousticness', 'instrumentalness']
  const sharedKeys = audioKeys.filter((key) => featuresA[key] != null && featuresB[key] != null)
  const audioScore = sharedKeys.length
    ? sharedKeys.reduce((sum, key) => sum + (1 - Math.abs(featuresA[key] - featuresB[key])), 0) / sharedKeys.length
    : 0

  const popA = clamp((artistA.popularity ?? 50) / 100)
  const popB = clamp((artistB.popularity ?? 50) / 100)
  const popularityScore = 1 - Math.abs(popA - popB)
  const bridgeScore = 1 - Math.abs((artistA.metrics?.bridgeScore ?? 0.2) - (artistB.metrics?.bridgeScore ?? 0.2))
  const discoveryScore = 1 - Math.abs((artistA.metrics?.discoveryScore ?? 0.2) - (artistB.metrics?.discoveryScore ?? 0.2))

  return {
    score: (genreScore * 0.4) + (audioScore * 0.3) + (popularityScore * 0.12) + (bridgeScore * 0.1) + (discoveryScore * 0.08),
    genreScore,
    audioScore,
    popularityScore,
    bridgeScore,
    discoveryScore,
    sharedGenres,
    confidence: sharedKeys.length >= 3 ? 0.9 : sharedKeys.length ? 0.72 : sharedGenres.length ? 0.6 : 0.45,
  }
}

export function buildArtistMetrics(artist = {}, index = 0, total = 1) {
  const popularity = clamp((artist.popularity ?? 50) / 100)
  const rankingWeight = 1 - (index / Math.max(total - 1, 1))
  const genreBreadth = Math.min((artist.genres || []).length / 4, 1)
  const significance = (popularity * 0.6) + (rankingWeight * 0.4)
  const rarity = 1 - popularity
  const discoveryScore = (rarity * 0.6) + (genreBreadth * 0.25) + ((1 - rankingWeight) * 0.15)
  const bridgeScore = Math.min(1, (((artist.genres || []).length - 1) * 0.32) + (rarity * 0.18) + (genreBreadth * 0.2))
  const frontierScore = Math.min(1, (rarity * 0.55) + ((1 - popularity) * 0.2) + (genreBreadth * 0.25))
  const anchorScore = Math.min(1, (significance * 0.75) + ((1 - rarity) * 0.25))

  return {
    centrality: Number(significance.toFixed(3)),
    bridgeScore: Number(bridgeScore.toFixed(3)),
    familiarity: Number(popularity.toFixed(3)),
    discoveryScore: Number(discoveryScore.toFixed(3)),
    frontierScore: Number(frontierScore.toFixed(3)),
    anchorScore: Number(anchorScore.toFixed(3)),
    rarity: Number(rarity.toFixed(3)),
    significance: Number(significance.toFixed(3)),
  }
}

export function buildGenreMetrics(genre = {}, topCount = 1) {
  const weight = clamp((genre.count ?? 1) / Math.max(topCount, 1))
  return {
    centrality: Number((0.55 + weight * 0.45).toFixed(3)),
    bridgeScore: Number((weight * 0.4).toFixed(3)),
    familiarity: Number(weight.toFixed(3)),
    discoveryScore: Number((1 - weight * 0.5).toFixed(3)),
    frontierScore: Number((0.25 + (1 - weight) * 0.45).toFixed(3)),
    anchorScore: Number((0.5 + weight * 0.5).toFixed(3)),
    rarity: Number((1 - weight).toFixed(3)),
    significance: Number((0.5 + weight * 0.5).toFixed(3)),
  }
}

export function buildTrackMetrics(track = {}, index = 0, total = 1) {
  const popularity = clamp((track.popularity ?? 40) / 100)
  const rankingWeight = 1 - (index / Math.max(total - 1, 1))
  const significance = (rankingWeight * 0.6) + (popularity * 0.4)
  const rarity = 1 - popularity
  return {
    centrality: Number(significance.toFixed(3)),
    bridgeScore: Number((rarity * 0.18).toFixed(3)),
    familiarity: Number(popularity.toFixed(3)),
    discoveryScore: Number((rarity * 0.55 + (1 - rankingWeight) * 0.45).toFixed(3)),
    frontierScore: Number((rarity * 0.6).toFixed(3)),
    anchorScore: Number((significance * 0.55).toFixed(3)),
    rarity: Number(rarity.toFixed(3)),
    significance: Number(significance.toFixed(3)),
  }
}

export function buildClusterMetrics(members = [], genreWeight = 0.5) {
  const centrality = average(members.map((member) => member.metrics?.centrality)) ?? 0
  const bridgeScore = average(members.map((member) => member.metrics?.bridgeScore)) ?? 0
  const discoveryScore = average(members.map((member) => member.metrics?.discoveryScore)) ?? 0
  const rarity = average(members.map((member) => member.metrics?.rarity)) ?? 0
  const significance = clamp((centrality * 0.55) + (genreWeight * 0.45))
  return {
    centrality: Number(centrality.toFixed(3)),
    bridgeScore: Number(bridgeScore.toFixed(3)),
    discoveryScore: Number(discoveryScore.toFixed(3)),
    rarity: Number(rarity.toFixed(3)),
    significance: Number(significance.toFixed(3)),
  }
}

export function deriveMoodRegion(features = {}) {
  const energy = features.energy
  const valence = features.valence
  const acousticness = features.acousticness

  if (energy == null || valence == null) return 'cosmic'
  if (energy > 0.72 && valence > 0.62) return 'euphoric'
  if (energy > 0.72 && valence < 0.4) return 'electric'
  if (energy < 0.36 && valence < 0.35) return 'haunted'
  if (energy < 0.4 && valence > 0.6) return 'romantic'
  if ((acousticness ?? 0) > 0.58) return 'nostalgic'
  if (valence < 0.4) return 'nocturnal'
  return 'dreamy'
}
