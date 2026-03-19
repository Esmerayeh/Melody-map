/**
 * personalityEngine.js
 * Pure-function analysis utilities for Music Personality, MBTI, and
 * Advanced Soulmate Compatibility — all computed from profile data.
 */

// ── Clamp helper ───────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v ?? 0.5))

// ─────────────────────────────────────────────────────────────────────────────
// 1. MUSIC PERSONALITY ARCHETYPES
// ─────────────────────────────────────────────────────────────────────────────
const ARCHETYPES = [
  {
    id: 'dreamy',
    label: 'Dreamy',
    emoji: '🌙',
    color: '#a78bfa',
    description: 'Atmospheric, introspective, and beautifully hazy.',
    score: ({ acousticness, valence, energy }) =>
      clamp(acousticness) * 0.5 +
      clamp(valence) * 0.3 * (1 - Math.abs(clamp(valence) - 0.55)) +
      (1 - clamp(energy)) * 0.2,
  },
  {
    id: 'nostalgic',
    label: 'Nostalgic',
    emoji: '🎞️',
    color: '#fbbf24',
    description: 'Warm memories wrapped in slow, organic sound.',
    score: ({ tempo, acousticness }) =>
      (1 - clamp(tempo / 200)) * 0.55 + clamp(acousticness) * 0.45,
  },
  {
    id: 'chaotic',
    label: 'Chaotic',
    emoji: '⚡',
    color: '#ef4444',
    description: 'High-octane, unpredictable, and relentlessly intense.',
    score: ({ energy, tempo }) =>
      clamp(energy) * 0.55 + clamp(tempo / 200) * 0.45,
  },
  {
    id: 'romantic',
    label: 'Romantic',
    emoji: '🌹',
    color: '#f472b6',
    description: 'Tender, emotional, and deeply soulful.',
    score: ({ valence, acousticness, energy }) =>
      clamp(valence) * 0.45 + clamp(acousticness) * 0.35 + (1 - clamp(energy)) * 0.2,
  },
  {
    id: 'melancholic',
    label: 'Melancholic',
    emoji: '🌧️',
    color: '#60a5fa',
    description: 'Beautifully sad — you find meaning in the minor key.',
    score: ({ valence, energy }) =>
      (1 - clamp(valence)) * 0.65 + (1 - clamp(energy)) * 0.35,
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    emoji: '🪐',
    color: '#34d399',
    description: 'Ambient, vast, and instrumental — music as a universe.',
    score: ({ instrumentalness, acousticness, energy }) =>
      clamp(instrumentalness ?? 0.3) * 0.5 +
      clamp(acousticness) * 0.3 +
      (1 - clamp(energy)) * 0.2,
  },
]

/**
 * computePersonality(audioFeatures)
 * Returns top-3 archetypes with normalized percentage scores.
 */
export function computePersonality(af = {}) {
  const input = {
    energy:           clamp(af.energy),
    valence:          clamp(af.valence),
    danceability:     clamp(af.danceability),
    acousticness:     clamp(af.acousticness),
    instrumentalness: clamp(af.instrumentalness ?? 0.2),
    tempo:            af.tempo ?? 120,
  }

  const raw = ARCHETYPES.map((a) => ({ ...a, raw: a.score(input) }))
  const total = raw.reduce((s, a) => s + a.raw, 0) || 1
  const scored = raw
    .map((a) => ({ ...a, pct: Math.round((a.raw / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)

  return scored.slice(0, 3)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MUSIC MBTI
// ─────────────────────────────────────────────────────────────────────────────
const MBTI_TYPES = {
  INFP: { name: 'The Dream Listener',    desc: 'You live inside music. Emotional, introspective, and deeply personal — every song is a feeling.' },
  INFJ: { name: 'The Sonic Sage',        desc: 'Rare and perceptive. You hear what others miss and build profound connections through sound.' },
  INTP: { name: 'The Frequency Analyst', desc: 'You deconstruct music intellectually. Patterns, structures, and sonic architecture fascinate you.' },
  INTJ: { name: 'The Architect of Sound',desc: 'Deliberate and visionary. Your taste is curated with precision and purpose.' },
  ISFP: { name: 'The Velvet Wanderer',   desc: 'Sensory and present. You feel music in your body and let it guide your mood.' },
  ISFJ: { name: 'The Keeper of Melodies',desc: 'Loyal to your favorites. Comfort, warmth, and familiarity define your listening.' },
  ISTP: { name: 'The Sonic Craftsman',   desc: 'Precise and understated. You appreciate technical mastery and raw authenticity.' },
  ISTJ: { name: 'The Faithful Curator',  desc: 'Consistent and reliable. Your library is a well-organized archive of trusted sounds.' },
  ENFP: { name: 'The Eclectic Explorer', desc: 'Boundlessly curious. You jump genres, eras, and moods with infectious enthusiasm.' },
  ENFJ: { name: 'The Communal Conductor',desc: 'Music is social for you. You curate for others and find joy in shared listening.' },
  ENTP: { name: 'The Genre Disruptor',   desc: 'You challenge conventions and love music that breaks the mold.' },
  ENTJ: { name: 'The Sonic Commander',   desc: 'Bold and decisive. Your playlist is a statement, not a suggestion.' },
  ESFP: { name: 'The Dance Floor Oracle',desc: 'Spontaneous and joyful. Music is movement, celebration, and pure presence.' },
  ESFJ: { name: 'The Crowd Pleaser',     desc: 'Warm and inclusive. You love music that brings people together.' },
  ESTP: { name: 'The Adrenaline Chaser', desc: 'Fast, loud, and alive. You need music that matches your pace.' },
  ESTJ: { name: 'The Playlist Director', desc: 'Organized and purposeful. Every track has its place and time.' },
}

/**
 * computeMBTI(profile)
 * Returns { type, name, desc, axes } where axes shows each dimension score.
 */
export function computeMBTI(profile = {}) {
  const af      = profile.audioFeatures || {}
  const genres  = profile.genres        || []
  const artists = profile.topArtists    || []
  const tracks  = profile.topTracks     || []

  // I/E — Introversion vs Extraversion
  // High acousticness + low danceability → Introvert
  const ie = clamp(af.acousticness) * 0.5 + (1 - clamp(af.danceability)) * 0.5
  const I  = ie > 0.5

  // N/S — Intuition vs Sensing
  // Genre diversity → Intuition; narrow focus → Sensing
  const uniqueGenres = new Set(genres.map((g) => (typeof g === 'string' ? g : g.genre))).size
  const genreDiversity = Math.min(uniqueGenres / 15, 1)
  const N = genreDiversity > 0.5

  // T/F — Thinking vs Feeling
  // High instrumentalness → Thinking; high valence/speechiness → Feeling
  const tf = clamp(af.instrumentalness ?? 0.2) * 0.5 + (1 - clamp(af.valence)) * 0.5
  const T  = tf > 0.5

  // J/P — Judging vs Perceiving
  // Listening consistency (low artist spread) → Judging; high variety → Perceiving
  const popularities = artists.map((a) => (a.popularity || 50) / 100)
  const avgPop = popularities.length
    ? popularities.reduce((s, v) => s + v, 0) / popularities.length
    : 0.5
  const spread = popularities.length
    ? Math.sqrt(popularities.reduce((s, v) => s + (v - avgPop) ** 2, 0) / popularities.length)
    : 0.3
  const P = spread > 0.25

  const type = `${I ? 'I' : 'E'}${N ? 'N' : 'S'}${T ? 'T' : 'F'}${P ? 'P' : 'J'}`
  const meta = MBTI_TYPES[type] || { name: 'The Sonic Explorer', desc: 'Your taste defies easy categorization.' }

  return {
    type,
    name: meta.name,
    desc: meta.desc,
    axes: {
      IE: { label: I ? 'Introvert' : 'Extravert', score: Math.round(ie * 100), flipped: !I },
      NS: { label: N ? 'Intuition' : 'Sensing',   score: Math.round(genreDiversity * 100), flipped: !N },
      TF: { label: T ? 'Thinking'  : 'Feeling',   score: Math.round(tf * 100), flipped: !T },
      JP: { label: P ? 'Perceiving': 'Judging',   score: Math.round(spread * 200), flipped: !P },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADVANCED SOULMATE COMPATIBILITY
// ─────────────────────────────────────────────────────────────────────────────
const WEIGHTS = { genre: 0.35, artist: 0.35, audio: 0.30 }

/**
 * computeAdvancedCompatibility(profileA, profileB)
 * Returns a full compatibility report (0–100) with sub-scores.
 */
export function computeAdvancedCompatibility(profileA, profileB) {
  if (!profileA || !profileB) return null

  // Genre overlap
  const genresA = new Set((profileA.genres || []).map((g) => (typeof g === 'string' ? g : g.genre)?.toLowerCase()).filter(Boolean))
  const genresB = new Set((profileB.genres || []).map((g) => (typeof g === 'string' ? g : g.genre)?.toLowerCase()).filter(Boolean))
  const sharedGenres = [...genresA].filter((g) => genresB.has(g))
  const genreOverlap = genresA.size ? sharedGenres.length / Math.max(genresA.size, genresB.size) : 0

  // Artist overlap
  const artistsA = new Set((profileA.topArtists || []).map((a) => a.name?.toLowerCase()).filter(Boolean))
  const artistsB = new Set((profileB.topArtists || []).map((a) => a.name?.toLowerCase()).filter(Boolean))
  const sharedArtists = [...artistsA].filter((a) => artistsB.has(a))
  const artistOverlap = artistsA.size ? sharedArtists.length / Math.max(artistsA.size, artistsB.size) : 0

  // Audio feature similarity (cosine-like)
  const afA = profileA.audioFeatures || {}
  const afB = profileB.audioFeatures || {}
  const audioKeys = ['energy', 'valence', 'danceability', 'acousticness']
  const audioSim = audioKeys.reduce((sum, k) => {
    return sum + (1 - Math.abs(clamp(afA[k]) - clamp(afB[k])))
  }, 0) / audioKeys.length

  // Weighted total
  const total = Math.round(
    (genreOverlap  * WEIGHTS.genre  +
     artistOverlap * WEIGHTS.artist +
     audioSim      * WEIGHTS.audio) * 100
  )

  // Mood alignment — energy + valence delta
  const energyDelta   = Math.abs(clamp(afA.energy)  - clamp(afB.energy))
  const valenceDelta  = Math.abs(clamp(afA.valence) - clamp(afB.valence))
  const moodAlignment = Math.round((1 - (energyDelta + valenceDelta) / 2) * 100)

  // Discovery match — popularity spread similarity
  const popA = (profileA.topArtists || []).map((a) => (a.popularity || 50) / 100)
  const popB = (profileB.topArtists || []).map((a) => (a.popularity || 50) / 100)
  const avgA = popA.length ? popA.reduce((s, v) => s + v, 0) / popA.length : 0.5
  const avgB = popB.length ? popB.reduce((s, v) => s + v, 0) / popB.length : 0.5
  const discoveryMatch = Math.round((1 - Math.abs(avgA - avgB)) * 100)

  // Listening era match — use release_year from tracks if available
  const yearA = (profileA.topTracks || []).map((t) => t.release_year || t.year).filter(Boolean)
  const yearB = (profileB.topTracks || []).map((t) => t.release_year || t.year).filter(Boolean)
  const avgYearA = yearA.length ? yearA.reduce((s, v) => s + v, 0) / yearA.length : 2015
  const avgYearB = yearB.length ? yearB.reduce((s, v) => s + v, 0) / yearB.length : 2015
  const eraMatch = Math.round(Math.max(0, 1 - Math.abs(avgYearA - avgYearB) / 30) * 100)

  return {
    score:          Math.min(100, total),
    sharedGenres:   sharedGenres.slice(0, 8),
    sharedArtists:  sharedArtists.slice(0, 8),
    breakdown: {
      genres:         Math.round(genreOverlap  * 100),
      artists:        Math.round(artistOverlap * 100),
      audio:          Math.round(audioSim      * 100),
      moodAlignment,
      discoveryMatch,
      eraMatch,
    },
  }
}
