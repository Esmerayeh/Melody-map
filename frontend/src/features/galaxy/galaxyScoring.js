const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value ?? 0))

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
  const audioKeys = ['energy', 'valence', 'danceability']
  const sharedKeys = audioKeys.filter((key) => featuresA[key] != null && featuresB[key] != null)
  const audioScore = sharedKeys.length
    ? sharedKeys.reduce((sum, key) => sum + (1 - Math.abs(featuresA[key] - featuresB[key])), 0) / sharedKeys.length
    : 0

  const popA = clamp((artistA.popularity ?? 50) / 100)
  const popB = clamp((artistB.popularity ?? 50) / 100)
  const popularityScore = 1 - Math.abs(popA - popB)

  return {
    score: (genreScore * 0.55) + (audioScore * 0.3) + (popularityScore * 0.15),
    genreScore,
    audioScore,
    popularityScore,
    sharedGenres,
    confidence: sharedKeys.length ? 0.85 : sharedGenres.length ? 0.6 : 0.45,
  }
}

export function buildArtistMetrics(artist = {}, index = 0, total = 1) {
  const popularity = clamp((artist.popularity ?? 50) / 100)
  const rankingWeight = 1 - (index / Math.max(total - 1, 1))
  const genreBreadth = Math.min((artist.genres || []).length / 4, 1)
  const significance = (popularity * 0.7) + (rankingWeight * 0.3)
  const rarity = 1 - popularity
  const discoveryScore = (rarity * 0.65) + (genreBreadth * 0.35)
  const bridgeScore = Math.min(1, (((artist.genres || []).length - 1) * 0.35) + (rarity * 0.25))

  return {
    centrality: Number(significance.toFixed(3)),
    bridgeScore: Number(bridgeScore.toFixed(3)),
    familiarity: Number(popularity.toFixed(3)),
    discoveryScore: Number(discoveryScore.toFixed(3)),
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
    rarity: Number((1 - weight).toFixed(3)),
    significance: Number((0.5 + weight * 0.5).toFixed(3)),
  }
}
