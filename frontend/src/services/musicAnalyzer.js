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

  // CREDIBILITY GUARD: Spotify retired the audio-features endpoint, so for most
  // accounts `audioFeatures` arrives empty. The `|| 0.5` fallbacks above keep the
  // internal visual math safe, but emitting them as user-facing scores produced
  // the "mushy middle" — every taste read floored to ~50% Energy / 50% Valence /
  // "balanced", which reads as a broken demo and breaks the "this is YOU" spell.
  // When there is no real audio signal, the audio-DERIVED metrics are null so the
  // (already null-guarding) UI hides them instead of fabricating a number. The
  // genre- and recency-derived metrics below stay — those are still real signal.
  const hasAudio = audioFeatures.some((f) => f && (f.energy != null || f.valence != null))
  const score = (value) => (hasAudio ? Math.round(value * 100) : null)

  return {
    dominantGenres:    genres.slice(0, 8),
    mood:              hasAudio ? deriveMood(energy, valence) : null,
    energyScore:       score(energy),
    valenceScore:      score(valence),
    danceabilityScore: score(danceability),
    acousticnessScore: score(acousticness),
    tempoAvg:          hasAudio ? Math.round(tempo) : null,
    nostalgiaIndex:    Math.round(calcNostalgiaIndex(topTracks) * 100), // from release dates — real
    diversityScore:    Math.round(calcDiversity(genres) * 100),         // from genre spread — real
    sonicBrightness:   hasAudio ? Math.round(calcSonicBrightness(avgFeatures) * 100) : null,
    hasAudioFeatures:  hasAudio,
    avgFeatures,
    // Scatter data: one point per track that actually carries audio features.
    // Empty (not a cloud of fabricated 50/50 points) when features are missing.
    moodScatter: audioFeatures
      .slice(0, 30)
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f && f.valence != null && f.energy != null)
      .map(({ f, i }) => ({
        x: Math.round(f.valence * 100),
        y: Math.round(f.energy * 100),
        label: topTracks[i]?.title || topTracks[i]?.name || `Track ${i + 1}`,
        artist: topTracks[i]?.artist || topTracks[i]?.artists?.[0]?.name || '',
      })),
  }
}
