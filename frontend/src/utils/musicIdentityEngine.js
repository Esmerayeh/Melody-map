const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value ?? 0)))

const mean = (values) => {
  const present = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number)
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null
}

const std = (values) => {
  const present = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number)
  if (present.length < 2) return null
  const avg = mean(present)
  return Math.sqrt(present.reduce((sum, value) => sum + (value - avg) ** 2, 0) / present.length)
}

const entropy = (labels = []) => {
  const clean = labels.map((label) => String(label || '').trim().toLowerCase()).filter(Boolean)
  if (!clean.length) return null
  const counts = new Map()
  clean.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1))
  if (counts.size === 1) return 0
  const total = clean.length
  const value = [...counts.values()].reduce((sum, count) => {
    const p = count / total
    return sum - p * Math.log(p)
  }, 0)
  return clamp(value / Math.log(counts.size))
}

const pct = (value) => Math.round(clamp(value) * 100)

const TYPE_LIBRARY = {
  'Innerworld|Abstract|Immersion|Ritual': 'The Dream Archivist',
  'Innerworld|Abstract|Immersion|Drift': 'The Velvet Wanderer',
  'Innerworld|Abstract|Architecture|Ritual': 'The Astral Curator',
  'Innerworld|Abstract|Architecture|Drift': 'The Signal Alchemist',
  'Innerworld|Tangible|Immersion|Ritual': 'The Memory Diver',
  'Innerworld|Tangible|Immersion|Drift': 'The Nocturne Seeker',
  'Innerworld|Tangible|Architecture|Ritual': 'The Liminal Collector',
  'Innerworld|Tangible|Architecture|Drift': 'The Glasshearted Voyager',
  'Outward Pulse|Abstract|Immersion|Ritual': 'The Fever Bloom',
  'Outward Pulse|Abstract|Immersion|Drift': 'The Soft Chaos Listener',
  'Outward Pulse|Abstract|Architecture|Ritual': 'The Neon Pilgrim',
  'Outward Pulse|Abstract|Architecture|Drift': 'The Sonic Oracle',
  'Outward Pulse|Tangible|Immersion|Ritual': 'The Static Romantic',
  'Outward Pulse|Tangible|Immersion|Drift': 'The Moonlit Cartographer',
  'Outward Pulse|Tangible|Architecture|Ritual': 'The Cathedral Drifter',
  'Outward Pulse|Tangible|Architecture|Drift': 'The Echo Mystic',
}

function genreLabels(profile = {}) {
  return (profile.genres || []).map((item) => item?.genre || item?.name || item).filter(Boolean)
}

function artistNames(profile = {}) {
  return (profile.topArtists || []).map((item) => item?.name || item).filter(Boolean)
}

function featureValues(profile = {}, key) {
  return (profile.audioFeaturesList || []).map((row) => row?.[key]).filter((value) => value != null).map(Number)
}

function metric(id, label, score, evidence, method) {
  if (score == null) {
    return { id, label, score: null, pct: null, available: false, evidence: ['More Spotify signal is needed for this metric.'], method }
  }
  return { id, label, score: Number(clamp(score).toFixed(3)), pct: pct(score), available: true, evidence: evidence.filter(Boolean).slice(0, 4), method }
}

function axis(id, left, right, leftScore, evidenceLeft, evidenceRight, method) {
  if (leftScore == null) {
    return { id, left, right, direction: 'Still forming', score: null, balance: null, evidence: ['More Spotify signal is needed for this axis.'], method }
  }
  const normalized = clamp(leftScore)
  const leansLeft = normalized >= 0.5
  return {
    id,
    left,
    right,
    direction: leansLeft ? left : right,
    score: pct(Math.max(normalized, 1 - normalized)),
    balance: Number(((normalized - 0.5) * 2).toFixed(3)),
    evidence: (leansLeft ? evidenceLeft : evidenceRight).filter(Boolean).slice(0, 4),
    method,
  }
}

export function computeMusicIdentityDetails(profile = {}) {
  const af = profile.audioFeatures || {}
  const genres = genreLabels(profile)
  const artists = artistNames(profile)
  const popularities = (profile.topArtists || []).map((artist) => artist?.popularity).filter((value) => value != null).map((value) => value / 100)
  const energyValues = featureValues(profile, 'energy')
  const valenceValues = featureValues(profile, 'valence')
  const danceValues = featureValues(profile, 'danceability')

  const availableAudio = ['energy', 'valence', 'danceability', 'acousticness', 'instrumentalness', 'speechiness', 'tempo']
    .filter((key) => af[key] != null)
  if (availableAudio.length < 3 || genres.length < 2 || artists.length < 2) {
    return {
      value: {
        schemaVersion: '2026-05-sonic-field-v1',
        framework: 'Sonic Field Model',
        notDiagnosis: true,
        type: {
          id: 'forming',
          name: 'Your identity is still forming',
          tagline: 'The field needs more Spotify signal before it can name itself.',
          description: 'Melody Map will not invent a full identity from weak data.',
          shareLine: 'My music identity is still forming.',
          strengths: ['early signal honesty'],
          shadows: ['limited Spotify evidence'],
        },
        axes: [],
        metrics: [],
        topMetrics: [],
        poeticLine: 'Your identity is still forming. Melody Map needs more Spotify listening history before it can make a precise reading without guessing.',
        confidence: { score: 0, label: 'unavailable', lowData: true, missing: ['audioFeaturesList', 'genres', 'topArtists'] },
      },
      confidence: 0,
      missingInputs: ['audioFeaturesList', 'genres', 'topArtists'].filter((key) => {
        if (key === 'genres') return genres.length < 2
        if (key === 'topArtists') return artists.length < 2
        return availableAudio.length < 3
      }),
      inputsUsed: availableAudio,
      methodology: 'sonic-field-v1',
    }
  }

  const avgPopularity = mean(popularities)
  const genreEntropy = entropy(genres)
  const featureSpread = mean([std(energyValues), std(valenceValues), std(danceValues)])
  const recurrenceMass = clamp(((profile.spotifyEvidence?.repeatContext?.trackOverlapShare || 0) * 1.8) + ((profile.spotifyEvidence?.repeatContext?.recurringArtists?.length || 0) / 12))
  const emotionalGravity = mean([af.valence != null ? 1 - af.valence : null, af.acousticness, af.instrumentalness, recurrenceMass])
  const atmosphericDensity = mean([af.acousticness, af.instrumentalness, featureSpread != null ? 1 - clamp(featureSpread * 3) : null])
  const sonicCuriosity = mean([genreEntropy, avgPopularity != null ? 1 - avgPopularity : null, af.instrumentalness, featureSpread])
  const driftVelocity = mean([featureSpread, sonicCuriosity, 1 - recurrenceMass])
  const pulseSignature = mean([af.danceability, af.tempo != null ? clamp(af.tempo / 200) : null, af.energy])
  const liminality = mean([featureSpread, genreEntropy])
  const shadowFrequency = mean([af.valence != null ? 1 - af.valence : null, af.acousticness, af.instrumentalness, recurrenceMass])

  const metrics = [
    metric('emotional_gravity', 'Emotional gravity', emotionalGravity, [`Audio valence and acoustic texture are measured from Spotify top tracks.`, artists.length ? `Artist anchors include ${artists.slice(0, 4).join(', ')}.` : null], 'mean(inverse valence, acousticness, instrumentalness, recurrence mass)'),
    metric('atmospheric_density', 'Atmospheric density', atmosphericDensity, [`Genres include ${genres.slice(0, 5).join(', ')}.`, `Audio texture comes from acousticness and instrumentalness.`], 'mean(acousticness, instrumentalness, inverse feature spread)'),
    metric('sonic_curiosity', 'Sonic curiosity', sonicCuriosity, [`Genre entropy is ${pct(genreEntropy)}% across Spotify genre anchors.`], 'mean(genre entropy, inverse popularity, instrumentalness, variance)'),
    metric('comfort_orbit', 'Comfort orbit', recurrenceMass, [`Recurrence is derived from repeated tracks and recurring artists.`], 'track overlap share plus recurring artist mass'),
    metric('drift_velocity', 'Drift velocity', driftVelocity, [`Feature spread is ${pct(featureSpread)}% across available Spotify audio rows.`], 'proxy mean(feature spread, curiosity, inverse recurrence)'),
    metric('pulse_signature', 'Pulse signature', pulseSignature, [`Danceability, tempo, and energy form the rhythmic center.`], 'mean(danceability, tempo, energy)'),
    metric('liminality', 'Liminality', liminality, [`Genre entropy and audio variance show how often the profile lives between states.`], 'mean(feature spread, genre entropy)'),
    metric('shadow_frequency', 'Shadow frequency', shadowFrequency, [`Low-valence pull and repeated anchors shape the darker undertone.`], 'mean(inverse valence, acousticness, instrumentalness, recurrence)'),
  ]

  const innerworld = mean([af.acousticness, af.danceability != null ? 1 - af.danceability : null, af.instrumentalness, avgPopularity != null ? 1 - avgPopularity : null, recurrenceMass])
  const abstract = mean([genreEntropy, af.instrumentalness, featureSpread, sonicCuriosity])
  const immersion = mean([featureSpread, atmosphericDensity, emotionalGravity, shadowFrequency])
  const ritual = mean([recurrenceMass, driftVelocity != null ? 1 - driftVelocity : null])

  const axes = [
    axis('innerworld_outward_pulse', 'Innerworld', 'Outward Pulse', innerworld, ['Higher acoustic or private texture pulls the field inward.'], ['Energy, danceability, or popularity push the field outward.'], 'weighted Spotify acousticness, danceability, instrumentalness, popularity, recurrence'),
    axis('abstract_tangible', 'Abstract', 'Tangible', abstract, ['Genre entropy and sonic variance point toward abstraction.'], ['Lower entropy and recurrence point toward tangible anchors.'], 'weighted genre entropy, instrumentalness, variance, curiosity'),
    axis('immersion_architecture', 'Immersion', 'Architecture', immersion, ['Emotional gravity and atmospheric density lead the reading.'], ['Pulse consistency and structure lead the reading.'], 'weighted emotional spread, atmosphere, recurrence, pulse'),
    axis('ritual_drift', 'Ritual', 'Drift', ritual, ['Comfort orbit and recurrence pull toward ritual.'], ['Novelty, variance, and low recurrence pull toward drift.'], 'weighted recurrence mass and inverse drift velocity'),
  ]

  const key = axes.map((item) => item.direction).join('|')
  const name = TYPE_LIBRARY[key] || 'The Listening Self'
  const topMetrics = metrics.filter((item) => item.available).sort((a, b) => b.score - a.score).slice(0, 3)
  const confidence = Math.min(1, (availableAudio.length / 7) * 0.55 + Math.min(1, genres.length / 12) * 0.25 + Math.min(1, artists.length / 20) * 0.2)

  return {
    value: {
      schemaVersion: '2026-05-sonic-field-v1',
      framework: 'Sonic Field Model',
      notDiagnosis: true,
      type: {
        id: key.toLowerCase().replaceAll(' ', '_').replaceAll('|', '_'),
        name,
        tagline: topMetrics[0]?.label ? `Your strongest pull is ${topMetrics[0].label.toLowerCase()}.` : 'Your music field is taking shape.',
        description: `This Music Identity is derived from Spotify anchors like ${artists.slice(0, 3).join(', ')} and genre gravity around ${genres.slice(0, 4).join(', ')}.`,
        shareLine: `My music identity is ${name}.`,
        strengths: topMetrics.map((item) => item.label),
        shadows: ['Watch where repetition becomes a closed room.'],
      },
      axes,
      metrics,
      topMetrics,
      sonicField: {
        vector: {
          energy: af.energy ?? null,
          valence: af.valence ?? null,
          danceability: af.danceability ?? null,
          acousticness: af.acousticness ?? null,
          instrumentalness: af.instrumentalness ?? null,
          genreEntropy,
          recurrenceMass,
        },
      },
      poeticLine: `Your music identity reads as ${name} because ${topMetrics[0]?.label.toLowerCase() || 'your strongest signal'} keeps recurring around Spotify anchors like ${artists.slice(0, 3).join(', ')}.`,
      confidence: {
        score: Number(confidence.toFixed(3)),
        label: confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
        lowData: false,
        missing: [],
      },
    },
    confidence: Number(confidence.toFixed(3)),
    missingInputs: [],
    inputsUsed: [...availableAudio, 'genres', 'topArtists'],
    methodology: 'sonic-field-v1',
  }
}

export function computeMusicIdentity(profile = {}) {
  return computeMusicIdentityDetails(profile).value
}
