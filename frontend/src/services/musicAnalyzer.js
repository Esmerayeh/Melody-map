/**
 * musicAnalyzer.js — Derived music intelligence engine
 * Converts raw Spotify/Last.fm data into meaningful analytics metrics.
 */

/**
 * Calculate average of a numeric key across an array of objects.
 */
const avg = (arr, key) => {
  const vals = arr.map((x) => x[key]).filter((v) => v != null && !isNaN(v))
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

/**
 * Count genre occurrences from top artists array.
 * Works with both Spotify (artist.genres[]) and Last.fm (artist.tags[]).
 */
export function extractGenres(topArtists = []) {
  const counts = {}
  topArtists.forEach((a) => {
    const genres = a.genres || a.tags || []
    genres.forEach((g) => {
      const key = g.toLowerCase().trim()
      counts[key] = (counts[key] || 0) + 1
    })
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }))
}

/**
 * Derive mood label from energy + valence.
 */
export function deriveMood(energy = 0.5, valence = 0.5) {
  if (energy > 0.7 && valence > 0.6) return 'euphoric'
  if (energy > 0.7 && valence < 0.4) return 'intense'
  if (energy > 0.7) return 'energetic'
  if (energy < 0.35 && valence < 0.35) return 'melancholic'
  if (energy < 0.35 && valence > 0.6) return 'serene'
  if (energy < 0.35) return 'dreamy'
  if (valence > 0.65) return 'uplifting'
  if (valence < 0.35) return 'brooding'
  return 'balanced'
}

/**
 * Nostalgia index — based on average release year of top tracks.
 * Older tracks = higher nostalgia (0–1).
 */
export function calcNostalgiaIndex(topTracks = []) {
  const years = topTracks
    .map((t) => {
      const date = t.release_date || t.album?.release_date || ''
      return date ? parseInt(date.slice(0, 4), 10) : null
    })
    .filter((y) => y && y > 1950 && y <= new Date().getFullYear())

  if (!years.length) return 0.5
  const avgYear = years.reduce((s, y) => s + y, 0) / years.length
  const currentYear = new Date().getFullYear()
  // Map: currentYear → 0, 1970 → 1
  return Math.min(1, Math.max(0, (currentYear - avgYear) / (currentYear - 1970)))
}

/**
 * Listening diversity — how spread out genres are (0 = mono-genre, 1 = very diverse).
 * Uses normalized entropy.
 */
export function calcDiversity(genreList = []) {
  if (!genreList.length) return 0
  const total = genreList.reduce((s, g) => s + g.count, 0)
  if (!total) return 0
  const entropy = genreList.reduce((s, g) => {
    const p = g.count / total
    return s - (p > 0 ? p * Math.log2(p) : 0)
  }, 0)
  const maxEntropy = Math.log2(genreList.length || 1)
  return maxEntropy > 0 ? Math.min(1, entropy / maxEntropy) : 0
}

/**
 * Sonic brightness — combination of valence + high-energy + low-acousticness.
 * Bright = happy, energetic, electronic. Dark = acoustic, low-valence.
 */
export function calcSonicBrightness(features = {}) {
  const v = features.valence ?? 0.5
  const e = features.energy ?? 0.5
  const a = features.acousticness ?? 0.5
  return Math.min(1, (v * 0.45 + e * 0.35 + (1 - a) * 0.2))
}

/**
 * Main analysis function — takes raw data, returns full analytics object.
 *
 * @param {object} params
 * @param {Array}  params.topArtists   — from spotifyAPI.getTopArtists or lastfmAPI.getTopArtists
 * @param {Array}  params.topTracks    — from spotifyAPI.getTopTracks or lastfmAPI.getTopTracks
 * @param {Array}  params.audioFeatures — from spotifyAPI.getAudioFeatures (Spotify only)
 * @returns {object} analytics
 */
export function analyzeMusic({ topArtists = [], topTracks = [], audioFeatures = [] } = {}) {
  const genres = extractGenres(topArtists)

  // Average audio features
  const energy       = avg(audioFeatures, 'energy')       || 0.5
  const valence      = avg(audioFeatures, 'valence')      || 0.5
  const danceability = avg(audioFeatures, 'danceability') || 0.5
  const acousticness = avg(audioFeatures, 'acousticness') || 0.5
  const tempo        = avg(audioFeatures, 'tempo')        || 120
  const speechiness  = avg(audioFeatures, 'speechiness')  || 0.1
  const instrumentalness = avg(audioFeatures, 'instrumentalness') || 0.1

  const avgFeatures = { energy, valence, danceability, acousticness, tempo, speechiness, instrumentalness }

  return {
    dominantGenres:    genres.slice(0, 8),
    mood:              deriveMood(energy, valence),
    energyScore:       Math.round(energy * 100),
    valenceScore:      Math.round(valence * 100),
    danceabilityScore: Math.round(danceability * 100),
    acousticnessScore: Math.round(acousticness * 100),
    tempoAvg:          Math.round(tempo),
    nostalgiaIndex:    Math.round(calcNostalgiaIndex(topTracks) * 100),
    diversityScore:    Math.round(calcDiversity(genres) * 100),
    sonicBrightness:   Math.round(calcSonicBrightness(avgFeatures) * 100),
    avgFeatures,
    // Scatter data: each track as {x: valence, y: energy, label}
    moodScatter: audioFeatures.slice(0, 30).map((f, i) => ({
      x: Math.round((f.valence ?? 0.5) * 100),
      y: Math.round((f.energy  ?? 0.5) * 100),
      label: topTracks[i]?.title || topTracks[i]?.name || `Track ${i + 1}`,
      artist: topTracks[i]?.artist || topTracks[i]?.artists?.[0]?.name || '',
    })),
  }
}
