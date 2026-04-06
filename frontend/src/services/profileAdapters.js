import { computePersonalityDetails, computeMBTIDetails } from '../utils/personalityEngine.js'

export const PROFILE_SCHEMA_VERSION = '2026-03-profile-v2'

export function buildGenreList(artists = []) {
  const counts = new Map()
  artists.forEach((artist) => {
    ;(artist.genres || []).forEach((genre) => {
      const key = String(genre).toLowerCase().trim()
      if (!key) return
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }))
}

export function validateProfilePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'Profile payload was empty or malformed.' }
  }

  const arrayKeys = ['topArtists', 'topTracks', 'genres']
  const badArrayKey = arrayKeys.find((key) => raw[key] != null && !Array.isArray(raw[key]))
  if (badArrayKey) {
    return { ok: false, reason: `Profile field "${badArrayKey}" was not an array.` }
  }

  if (raw.audioFeatures != null && typeof raw.audioFeatures !== 'object') {
    return { ok: false, reason: 'Profile audioFeatures field was malformed.' }
  }

  return { ok: true }
}

export function unwrapProfileResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

export function deriveConfidence(dataQuality = {}, profile = {}, backendConfidence = null) {
  const audioCoverage = Number(dataQuality.audioCoverage || 0)
  const topArtistsCount = Number(dataQuality.topArtistsCount || profile.topArtists?.length || 0)
  const topTracksCount = Number(dataQuality.topTracksCount || profile.topTracks?.length || 0)
  const genresCount = Number(dataQuality.genresCount || profile.genres?.length || 0)
  const hasAudioProfile = dataQuality.hasAudioProfile !== false && audioCoverage > 0

  const analytics = hasAudioProfile ? Math.min(1, (audioCoverage * 0.75) + (topTracksCount / 50) * 0.25) : 0
  const identity = hasAudioProfile
    ? Math.min(1, (audioCoverage * 0.7) + (genresCount / 12) * 0.2 + (topArtistsCount / 50) * 0.1)
    : Math.min(0.45, (genresCount / 12) * 0.35 + (topArtistsCount / 50) * 0.1)
  const galaxy = Math.min(1, (topArtistsCount / 50) * 0.65 + (genresCount / 12) * 0.35)
  const soulmate = Math.min(1, (topArtistsCount / 50) * 0.5 + (genresCount / 12) * 0.2 + (hasAudioProfile ? audioCoverage * 0.3 : 0))
  const overall = Math.max(analytics, identity, galaxy) * 0.5 + Math.min(analytics, identity, galaxy) * 0.5

  const labelFor = (score) => (score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : score > 0 ? 'low' : 'unavailable')

  const derived = {
    overall: Number(overall.toFixed(3)),
    analytics: Number(analytics.toFixed(3)),
    identity: Number(identity.toFixed(3)),
    galaxy: Number(galaxy.toFixed(3)),
    soulmate: Number(soulmate.toFixed(3)),
  }

  const normalizedBackend = backendConfidence && typeof backendConfidence === 'object'
    ? Object.fromEntries(
        ['overall', 'analytics', 'identity', 'galaxy', 'soulmate']
          .filter((key) => backendConfidence[key] != null)
          .map((key) => {
            const raw = backendConfidence[key]
            const score = typeof raw === 'number' ? raw : raw?.score
            return [key, Number(Math.max(0, Math.min(1, score || 0)).toFixed(3))]
          })
      )
    : {}

  const merged = {
    ...derived,
    ...normalizedBackend,
  }
  if (merged.overall == null) {
    merged.overall = Number((((merged.analytics + merged.identity + merged.galaxy) / 3) || 0).toFixed(3))
  }

  return {
    ...merged,
    labels: {
      overall: labelFor(merged.overall),
      analytics: labelFor(merged.analytics),
      identity: labelFor(merged.identity),
      galaxy: labelFor(merged.galaxy),
      soulmate: labelFor(merged.soulmate),
    },
  }
}

export function normalizeProfile(raw, provider) {
  if (!raw) return null

  const fallbackArtists = raw.topArtists || raw.artists || []
  const fallbackGenres = Array.isArray(raw.genres) && raw.genres.length
    ? raw.genres
    : buildGenreList(fallbackArtists)

  const normalized = {
    ...raw,
    topArtists: fallbackArtists,
    topTracks: raw.topTracks || raw.tracks || [],
    savedTracks: raw.savedTracks || [],
    recentlyPlayed: raw.recentlyPlayed || [],
    genres: fallbackGenres,
    audioFeatures: raw.audioFeatures || {},
    analyticsMetrics: raw.analyticsMetrics || null,
    galaxyNodes: raw.galaxyNodes || [],
    aestheticTags: raw.aestheticTags || [],
    userProfile: raw.userProfile || null,
    timeRange: raw.timeRange || 'medium_term',
    provider: raw.provider || provider || raw.dataQuality?.provider || 'spotify',
    dataQuality: raw.dataQuality || null,
    profileSchemaVersion: raw.profileSchemaVersion || PROFILE_SCHEMA_VERSION,
  }

  if (normalized.dataQuality && normalized.dataQuality.hasAudioProfile === false) {
    normalized.analyticsMetrics = null
  }

  const backendPersonalityMeta = raw.personalityMeta && typeof raw.personalityMeta === 'object' ? raw.personalityMeta : null
  const backendMbtiMeta = raw.mbtiMeta && typeof raw.mbtiMeta === 'object' ? raw.mbtiMeta : null
  const personalityDetails = backendPersonalityMeta || computePersonalityDetails({
    audioFeatures: normalized.audioFeatures || {},
    genres: normalized.genres || [],
  })
  const mbtiDetails = backendMbtiMeta || (
    normalized.dataQuality?.hasAudioProfile === false
      ? { value: null, confidence: 0, missingInputs: ['audioFeatures'], inputsUsed: [], methodology: 'music-mbti-v1' }
      : computeMBTIDetails(normalized)
  )

  normalized.personality = raw.personality ?? personalityDetails.traits
  normalized.mbti = raw.mbti ?? mbtiDetails.value
  normalized.confidence = deriveConfidence(normalized.dataQuality || {}, normalized, raw.confidence)
  const identityConfidence = Math.min(
    normalized.confidence.identity ?? 0,
    personalityDetails.confidence ?? normalized.confidence.identity ?? 0,
  )
  normalized.confidence.identity = Number(identityConfidence.toFixed(3))
  normalized.confidence.labels.identity = normalized.confidence.identity >= 0.8
    ? 'high'
    : normalized.confidence.identity >= 0.5
      ? 'medium'
      : normalized.confidence.identity > 0
        ? 'low'
        : 'unavailable'
  normalized.personalityMeta = {
    ...personalityDetails,
    confidence: normalized.confidence.identity,
  }
  normalized.mbtiMeta = {
    ...mbtiDetails,
    confidence: Number(mbtiDetails?.confidence || normalized.confidence.identity || 0),
  }
  normalized.analyticsReadiness = raw.analyticsReadiness || {
    ready: normalized.dataQuality?.hasAudioProfile === true,
    confidence: { score: normalized.confidence.analytics, label: normalized.confidence.labels.analytics },
    reasons: normalized.dataQuality?.hasAudioProfile ? [] : ['audio_profile_missing'],
  }
  normalized.identityReadiness = raw.identityReadiness || {
    ready: Boolean(normalized.genres?.length),
    confidence: { score: normalized.confidence.identity, label: normalized.confidence.labels.identity },
    mbtiReady: Boolean(normalized.mbti?.type),
    reasons: normalized.genres?.length ? [] : ['insufficient_identity_inputs'],
  }
  normalized.soulmateReadiness = raw.soulmateReadiness || {
    ready: Boolean(normalized.topArtists?.length && normalized.genres?.length),
    confidence: { score: normalized.confidence.soulmate, label: normalized.confidence.labels.soulmate },
    mode: normalized.dataQuality?.hasAudioProfile ? 'ready' : 'degraded',
    reasons: normalized.dataQuality?.hasAudioProfile ? [] : ['audio_profile_missing'],
  }
  normalized.isDegraded = Boolean(normalized.dataQuality?.degradedReasons?.length || normalized.dataQuality?.hasAudioProfile === false)
  normalized.canComputeAnalytics = Boolean(normalized.analyticsReadiness?.ready) && Boolean(normalized.analyticsMetrics)
  normalized.canComputeIdentity = Boolean(normalized.identityReadiness?.ready) && Boolean(normalized.personality?.length)
  normalized.canRenderGalaxy = Boolean(normalized.topArtists?.length || normalized.galaxyNodes?.length)

  return normalized
}
