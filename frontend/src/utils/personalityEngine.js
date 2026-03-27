/**
 * personalityEngine.js
 * Pure-function analysis utilities for Music Personality, MBTI, and
 * Advanced Soulmate Compatibility — all computed from profile data.
 */

// ── Clamp helper ───────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const normalizeTempo = (tempo) => (tempo == null ? null : clamp(tempo / 200))
const weightedAverage = (parts = []) => {
  const present = parts.filter((part) => part?.value != null && part?.weight > 0)
  if (!present.length) return null
  const weightSum = present.reduce((sum, part) => sum + part.weight, 0) || 1
  return present.reduce((sum, part) => sum + (part.value * part.weight), 0) / weightSum
}

const GENRE_ARCHETYPE_HINTS = {
  dreamy: ['shoegaze', 'dream pop', 'ambient', 'slowcore', 'post-rock'],
  nostalgic: ['indie', 'folk', 'lo-fi', 'singer-songwriter'],
  chaotic: ['hyperpop', 'edm', 'punk', 'metal', 'trap', 'drum and bass'],
  romantic: ['r&b', 'soul', 'neo-soul', 'jazz'],
  melancholic: ['emo', 'darkwave', 'sadcore', 'goth', 'slowcore'],
  cosmic: ['ambient', 'electronic', 'synthwave', 'experimental', 'drone'],
}

function getGenreText(profile = {}) {
  return (profile.genres || [])
    .map((genre) => (typeof genre === 'string' ? genre : genre?.genre))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getGenreBonus(profile, archetypeId) {
  const genreText = getGenreText(profile)
  if (!genreText) return 0

  const hints = GENRE_ARCHETYPE_HINTS[archetypeId] || []
  const hits = hints.filter((hint) => genreText.includes(hint)).length
  return Math.min(1, hits / Math.max(hints.length, 1))
}

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
    score: ({ acousticness, valence, energy }) => weightedAverage([
      { value: acousticness != null ? clamp(acousticness) : null, weight: 0.5 },
      { value: valence != null ? clamp(valence) * (1 - Math.abs(clamp(valence) - 0.55)) : null, weight: 0.3 },
      { value: energy != null ? (1 - clamp(energy)) : null, weight: 0.2 },
    ]),
  },
  {
    id: 'nostalgic',
    label: 'Nostalgic',
    emoji: '🎞️',
    color: '#fbbf24',
    description: 'Warm memories wrapped in slow, organic sound.',
    score: ({ tempo, acousticness }) => weightedAverage([
      { value: normalizeTempo(tempo) != null ? (1 - normalizeTempo(tempo)) : null, weight: 0.55 },
      { value: acousticness != null ? clamp(acousticness) : null, weight: 0.45 },
    ]),
  },
  {
    id: 'chaotic',
    label: 'Chaotic',
    emoji: '⚡',
    color: '#ef4444',
    description: 'High-octane, unpredictable, and relentlessly intense.',
    score: ({ energy, tempo }) => weightedAverage([
      { value: energy != null ? clamp(energy) : null, weight: 0.55 },
      { value: normalizeTempo(tempo), weight: 0.45 },
    ]),
  },
  {
    id: 'romantic',
    label: 'Romantic',
    emoji: '🌹',
    color: '#f472b6',
    description: 'Tender, emotional, and deeply soulful.',
    score: ({ valence, acousticness, energy }) => weightedAverage([
      { value: valence != null ? clamp(valence) : null, weight: 0.45 },
      { value: acousticness != null ? clamp(acousticness) : null, weight: 0.35 },
      { value: energy != null ? (1 - clamp(energy)) : null, weight: 0.2 },
    ]),
  },
  {
    id: 'melancholic',
    label: 'Melancholic',
    emoji: '🌧️',
    color: '#60a5fa',
    description: 'Beautifully sad — you find meaning in the minor key.',
    score: ({ valence, energy }) => weightedAverage([
      { value: valence != null ? (1 - clamp(valence)) : null, weight: 0.65 },
      { value: energy != null ? (1 - clamp(energy)) : null, weight: 0.35 },
    ]),
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    emoji: '🪐',
    color: '#34d399',
    description: 'Ambient, vast, and instrumental — music as a universe.',
    score: ({ instrumentalness, acousticness, energy }) => weightedAverage([
      { value: instrumentalness != null ? clamp(instrumentalness) : null, weight: 0.5 },
      { value: acousticness != null ? clamp(acousticness) : null, weight: 0.3 },
      { value: energy != null ? (1 - clamp(energy)) : null, weight: 0.2 },
    ]),
  },
]

/**
 * computePersonality(audioFeatures)
 * Returns top-3 archetypes with normalized percentage scores.
 */
export function computePersonalityDetails(profileOrFeatures = {}) {
  const profile = profileOrFeatures.audioFeatures ? profileOrFeatures : { audioFeatures: profileOrFeatures }
  const af = profile.audioFeatures || {}
  const audioKeys = ['energy', 'valence', 'danceability', 'acousticness', 'tempo', 'instrumentalness']
  const presentAudioKeys = audioKeys.filter((key) => af[key] != null)
  const hasAudioSignals = presentAudioKeys.length > 0
  const hasGenreSignals = (profile.genres || []).length > 0
  const missingInputs = audioKeys.filter((key) => af[key] == null)

  if (!hasAudioSignals && !hasGenreSignals) {
    return {
      traits: null,
      confidence: 0,
      missingInputs,
      inputsUsed: [],
      methodology: 'music-personality-archetypes-v1',
    }
  }

  const input = {
    energy:           af.energy ?? null,
    valence:          af.valence ?? null,
    danceability:     af.danceability ?? null,
    acousticness:     af.acousticness ?? null,
    instrumentalness: af.instrumentalness ?? null,
    tempo:            af.tempo ?? null,
  }

  const raw = ARCHETYPES.map((a) => {
      const audioScore = hasAudioSignals ? a.score(input) : null
      const genreScore = getGenreBonus(profile, a.id)
      const blended = weightedAverage([
        { value: audioScore, weight: hasAudioSignals ? 0.75 : 0 },
        { value: hasGenreSignals ? genreScore : null, weight: hasGenreSignals ? 0.25 : 0 },
      ])
      return {
        ...a,
        raw: blended ?? 0,
      }
    })
  const total = raw.reduce((s, a) => s + a.raw, 0) || 1
  const scored = raw
    .map((a) => ({ ...a, pct: Math.round((a.raw / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)

  const confidence = hasAudioSignals
    ? Math.min(1, (presentAudioKeys.length / audioKeys.length) * 0.8 + (hasGenreSignals ? 0.2 : 0))
    : Math.min(0.45, (profile.genres || []).length / 12)

  return {
    traits: scored.slice(0, 3),
    confidence: Number(confidence.toFixed(3)),
    missingInputs,
    inputsUsed: [
      ...(hasAudioSignals ? presentAudioKeys : []),
      ...(hasGenreSignals ? ['genres'] : []),
    ],
    methodology: 'music-personality-archetypes-v1',
  }
}

export function computePersonality(profileOrFeatures = {}) {
  return computePersonalityDetails(profileOrFeatures).traits
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
export function computeMBTIDetails(profile = {}) {
  const af      = profile.audioFeatures || {}
  const genres  = profile.genres        || []
  const artists = profile.topArtists    || []
  const inputKeys = ['acousticness', 'danceability', 'instrumentalness', 'valence']
  const availableKeys = inputKeys.filter((key) => af[key] != null)
  const hasAudioSignals = availableKeys.length > 0
  const popularities = artists
    .map((artist) => artist?.popularity)
    .filter((value) => value != null)
    .map((value) => value / 100)

  if (!hasAudioSignals || genres.length === 0 || artists.length === 0 || popularities.length === 0) {
    return {
      value: null,
      confidence: 0,
      missingInputs: [
        ...inputKeys.filter((key) => af[key] == null),
        ...(genres.length === 0 ? ['genres'] : []),
        ...(artists.length === 0 ? ['topArtists'] : []),
        ...(popularities.length === 0 ? ['artistPopularity'] : []),
      ],
      inputsUsed: availableKeys,
      methodology: 'music-mbti-v1',
    }
  }

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
  const avgPop = popularities.reduce((s, v) => s + v, 0) / popularities.length
  const spread = Math.sqrt(popularities.reduce((s, v) => s + (v - avgPop) ** 2, 0) / popularities.length)
  const P = spread > 0.25

  const type = `${I ? 'I' : 'E'}${N ? 'N' : 'S'}${T ? 'T' : 'F'}${P ? 'P' : 'J'}`
  const meta = MBTI_TYPES[type] || { name: 'The Sonic Explorer', desc: 'Your taste defies easy categorization.' }

  const confidence = Math.min(1, (availableKeys.length / inputKeys.length) * 0.7 + Math.min(1, genres.length / 12) * 0.15 + Math.min(1, artists.length / 50) * 0.15)

  return {
    value: {
      type,
      name: meta.name,
      desc: meta.desc,
      axes: {
        IE: { label: I ? 'Introvert' : 'Extravert', score: Math.round(ie * 100), flipped: !I },
        NS: { label: N ? 'Intuition' : 'Sensing',   score: Math.round(genreDiversity * 100), flipped: !N },
        TF: { label: T ? 'Thinking'  : 'Feeling',   score: Math.round(tf * 100), flipped: !T },
        JP: { label: P ? 'Perceiving': 'Judging',   score: Math.round(spread * 200), flipped: !P },
      },
    },
    confidence: Number(confidence.toFixed(3)),
    missingInputs: inputKeys.filter((key) => af[key] == null),
    inputsUsed: [...availableKeys, 'genres', 'topArtists'],
    methodology: 'music-mbti-v1',
  }
}

export function computeMBTI(profile = {}) {
  return computeMBTIDetails(profile).value
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

  // Audio feature similarity only uses keys that exist on both profiles.
  // Missing audio should reduce certainty, not collapse to a fake neutral match.
  const afA = profileA.audioFeatures || {}
  const afB = profileB.audioFeatures || {}
  const audioKeys = ['energy', 'valence', 'danceability', 'acousticness']
  const sharedAudioKeys = audioKeys.filter((key) => afA[key] != null && afB[key] != null)
  const audioSim = sharedAudioKeys.length
    ? sharedAudioKeys.reduce((sum, key) => sum + (1 - Math.abs(clamp(afA[key]) - clamp(afB[key]))), 0) / sharedAudioKeys.length
    : null

  const activeWeights = [
    { key: 'genre', value: genreOverlap, weight: WEIGHTS.genre },
    { key: 'artist', value: artistOverlap, weight: WEIGHTS.artist },
    ...(audioSim != null ? [{ key: 'audio', value: audioSim, weight: WEIGHTS.audio }] : []),
  ]
  const totalWeight = activeWeights.reduce((sum, item) => sum + item.weight, 0) || 1
  const weightedScore = activeWeights.reduce((sum, item) => sum + (item.value * item.weight), 0) / totalWeight
  const total = Math.round(weightedScore * 100)

  // Mood alignment — energy + valence delta
  const hasMoodSignals = afA.energy != null && afB.energy != null && afA.valence != null && afB.valence != null
  const energyDelta   = hasMoodSignals ? Math.abs(clamp(afA.energy)  - clamp(afB.energy)) : null
  const valenceDelta  = hasMoodSignals ? Math.abs(clamp(afA.valence) - clamp(afB.valence)) : null
  const moodAlignment = hasMoodSignals ? Math.round((1 - (energyDelta + valenceDelta) / 2) * 100) : null

  // Discovery match — popularity spread similarity
  const popA = (profileA.topArtists || []).map((a) => a?.popularity).filter((value) => value != null).map((value) => value / 100)
  const popB = (profileB.topArtists || []).map((a) => a?.popularity).filter((value) => value != null).map((value) => value / 100)
  const avgA = popA.length ? popA.reduce((s, v) => s + v, 0) / popA.length : null
  const avgB = popB.length ? popB.reduce((s, v) => s + v, 0) / popB.length : null
  const discoveryMatch = avgA != null && avgB != null ? Math.round((1 - Math.abs(avgA - avgB)) * 100) : null

  // Listening era match — use release_year from tracks if available
  const parseTrackYear = (track) => {
    const direct = track?.release_year || track?.year
    if (direct != null && Number.isFinite(Number(direct))) return Number(direct)
    const releaseDate = track?.release_date || ''
    const parsed = Number.parseInt(String(releaseDate).slice(0, 4), 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  const yearA = (profileA.topTracks || []).map(parseTrackYear).filter((value) => value != null)
  const yearB = (profileB.topTracks || []).map(parseTrackYear).filter((value) => value != null)
  const avgYearA = yearA.length ? yearA.reduce((s, v) => s + v, 0) / yearA.length : null
  const avgYearB = yearB.length ? yearB.reduce((s, v) => s + v, 0) / yearB.length : null
  const eraMatch = avgYearA != null && avgYearB != null
    ? Math.round(Math.max(0, 1 - Math.abs(avgYearA - avgYearB) / 30) * 100)
    : null

  return {
    score:          Math.min(100, total),
    sharedGenres:   sharedGenres.slice(0, 8),
    sharedArtists:  sharedArtists.slice(0, 8),
    breakdown: {
      genres:         Math.round(genreOverlap  * 100),
      artists:        Math.round(artistOverlap * 100),
      audio:          audioSim != null ? Math.round(audioSim * 100) : null,
      moodAlignment,
      discoveryMatch,
      eraMatch,
    },
    note: audioSim == null ? 'Compared using artist and genre overlap because one profile is missing audio feature coverage.' : null,
  }
}
