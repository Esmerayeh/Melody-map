import { computeAdvancedCompatibility, computeMBTI, computePersonality } from './personalityEngine'

const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value))
const toScore = (value) => Math.round(clamp(value, 0, 100))
const normalize = (value) => Math.round(clamp(value, 0, 1) * 100)
const slugify = (value) => String(value || '').trim().toLowerCase()

function personalityTraits(profile) {
  return profile?.personality || computePersonality(profile) || []
}

function mbtiProfile(profile) {
  return profile?.mbti || computeMBTI(profile) || null
}

function traitNames(profile) {
  return personalityTraits(profile)
    .map((trait) => slugify(trait?.label || trait?.id))
    .filter(Boolean)
}

function sharedAtmosphere(profileA, profileB) {
  const tagsA = new Set([...(profileA?.aestheticTags || []), profileA?.analyticsMetrics?.mood].map(slugify).filter(Boolean))
  const tagsB = new Set([...(profileB?.aestheticTags || []), profileB?.analyticsMetrics?.mood].map(slugify).filter(Boolean))
  return [...tagsA].filter((tag) => tagsB.has(tag)).slice(0, 6)
}

function bridgeTracks(profileA, profileB) {
  const topTracksA = profileA?.topTracks || []
  const topTracksB = profileB?.topTracks || []
  const namesB = new Set(topTracksB.map((track) => slugify(track?.title || track?.name)))
  const namesA = new Set(topTracksA.map((track) => slugify(track?.title || track?.name)))

  const shared = topTracksA
    .filter((track) => namesB.has(slugify(track?.title || track?.name)))
    .slice(0, 4)
    .map((track) => ({
      title: track.title || track.name,
      artist: track.artist || '',
      score: 100,
      reason: 'mutual favorite',
      source: 'shared',
    }))

  const fromA = topTracksA
    .filter((track) => !namesB.has(slugify(track?.title || track?.name)))
    .slice(0, 4)
    .map((track, index) => ({
      title: track.title || track.name,
      artist: track.artist || '',
      score: 82 - index * 6,
      reason: 'artist bridge',
      source: 'user_a',
    }))

  const fromB = topTracksB
    .filter((track) => !namesA.has(slugify(track?.title || track?.name)))
    .slice(0, 4)
    .map((track, index) => ({
      title: track.title || track.name,
      artist: track.artist || '',
      score: 82 - index * 6,
      reason: 'emotional fit',
      source: 'user_b',
    }))

  return {
    sharedTracks: shared,
    bridgeTracks: [...shared, ...fromA.slice(0, 2), ...fromB.slice(0, 2)].slice(0, 6),
    userAToUserBRecommendations: fromA,
    userBToUserARecommendations: fromB,
  }
}

function archetypeFor(score, tension, discovery) {
  if (score >= 85) return { relationshipArchetype: 'Rare Alignment', archetypeSummary: 'A near-mirrored pairing with unusual emotional clarity.' }
  if (tension >= 68 && discovery >= 65) return { relationshipArchetype: 'Magnetic Contrast', archetypeSummary: 'You intensify each other more than you mirror each other.' }
  if (score >= 72) return { relationshipArchetype: 'Midnight Orbit', archetypeSummary: 'A deep emotional lock with enough difference to keep the orbit alive.' }
  if (discovery >= 55) return { relationshipArchetype: 'Dream & Gravity', archetypeSummary: 'One of you opens the horizon while the other gives it weight.' }
  return { relationshipArchetype: 'Luminous Strangers', archetypeSummary: 'The chemistry is still forming, but the bridge is visible.' }
}

export function computeSoulmateCompatibility(profileA, profileB) {
  const base = computeAdvancedCompatibility(profileA, profileB)
  if (!base) return null

  const mbtiA = mbtiProfile(profileA)
  const mbtiB = mbtiProfile(profileB)
  const sameMbti = mbtiA?.type && mbtiA?.type === mbtiB?.type
  const mbtiCompatibility = sameMbti ? 90 : mbtiA?.type && mbtiB?.type ? 74 : 52
  const emotionalCompatibility = base.breakdown.moodAlignment ?? base.breakdown.audio ?? Math.max(base.score - 8, 0)
  const artistOverlapScore = base.breakdown.artists ?? 0
  const genreOverlapScore = base.breakdown.genres ?? 0
  const songOverlapScore = base.breakdown.tracks ?? 0
  const discoveryCompatibility = base.breakdown.discoveryMatch ?? Math.round((genreOverlapScore * 0.35) + (artistOverlapScore * 0.15) + 38)
  const tensionScore = Math.max(8, 72 - Math.abs(emotionalCompatibility - discoveryCompatibility) - Math.round(artistOverlapScore * 0.25))
  const orbResonanceScore = Math.round(emotionalCompatibility * 0.55 + mbtiCompatibility * 0.2 + (100 - Math.abs(tensionScore - 58)) * 0.25)
  const overallCompatibility = Math.round(
    emotionalCompatibility * 0.25 +
    mbtiCompatibility * 0.17 +
    artistOverlapScore * 0.12 +
    genreOverlapScore * 0.1 +
    songOverlapScore * 0.05 +
    discoveryCompatibility * 0.1 +
    orbResonanceScore * 0.15
  )
  const atmosphere = sharedAtmosphere(profileA, profileB)
  const sharedTraits = [...new Set(traitNames(profileA).filter((trait) => traitNames(profileB).includes(trait)))].slice(0, 4)
  const contrastingTraits = [...new Set([...traitNames(profileA), ...traitNames(profileB)].filter((trait) => !sharedTraits.includes(trait)))].slice(0, 4)
  const bridges = bridgeTracks(profileA, profileB)
  const archetype = archetypeFor(overallCompatibility, tensionScore, discoveryCompatibility)
  const compatibilityTier = overallCompatibility >= 88 ? 'luminous' : overallCompatibility >= 75 ? 'rare' : overallCompatibility >= 60 ? 'aligned' : overallCompatibility >= 45 ? 'emerging' : 'partial'

  return {
    overallCompatibility,
    emotionalCompatibility,
    mbtiCompatibility,
    orbResonanceScore,
    artistOverlapScore,
    genreOverlapScore,
    songOverlapScore,
    discoveryCompatibility,
    tensionScore,
    rarityScore: Math.round((100 - Math.abs(tensionScore - 62)) * 0.4 + discoveryCompatibility * 0.3 + emotionalCompatibility * 0.3),
    rarityLabel: overallCompatibility >= 84 ? 'rare' : overallCompatibility >= 68 ? 'uncommon' : 'common',
    compatibilityTier,
    sharedTraits,
    contrastingTraits,
    sharedArtists: base.sharedArtists || [],
    sharedGenres: base.sharedGenres || [],
    sharedTracks: (bridges.sharedTracks || []).map((track) => track.title),
    bridgeTracks: bridges.bridgeTracks,
    userAToUserBRecommendations: bridges.userAToUserBRecommendations,
    userBToUserARecommendations: bridges.userBToUserARecommendations,
    sharedAtmosphere: atmosphere,
    relationshipArchetype: archetype.relationshipArchetype,
    archetypeSummary: archetype.archetypeSummary,
    orbHarmony: orbResonanceScore >= 78 ? 'mirrored' : tensionScore >= 65 ? 'magnetic' : 'asymmetrical',
    phaseAlignment: Math.round((100 - Math.abs(emotionalCompatibility - mbtiCompatibility)) * 0.7 + 20),
    auraOverlap: atmosphere.slice(0, 4),
    tensionType: tensionScore >= 68 ? 'beautiful tension' : tensionScore >= 48 ? 'complementary' : 'gentle contrast',
    compatibilityNarrative: overallCompatibility >= 75
      ? 'A shared orbit forms with real weight behind it.'
      : 'The chemistry is softer, but the bridge is still there.',
    beautifulTensionNarrative: tensionScore >= 65
      ? 'This is not mismatch. It is beautiful imbalance, where the difference adds charge instead of distance.'
      : 'The contrast here is gentle enough to feel useful rather than destabilizing.',
    mbtiNarrative: mbtiA?.type && mbtiB?.type
      ? `${mbtiA.type} and ${mbtiB.type} meet through emotional structure, not just surface overlap.`
      : 'Identity signal is partial, so this read leans more on listening behavior than type language.',
    orbNarrative: orbResonanceScore >= 78
      ? 'Your fields move with unusual coherence, like separate lights answering the same pull.'
      : 'The orbs stay distinct, but their pulse still reaches across the same field.',
    discoveryNarrative: discoveryCompatibility >= 60
      ? 'You could lead each other somewhere new without losing the emotional thread that already connects you.'
      : 'Discovery is gentler here, but still real enough to follow.',
    sharedAtmosphereNarrative: atmosphere.length
      ? `You both return to ${atmosphere.slice(0, 3).join(', ')}.`
      : 'The overlap arrives more in structure than atmosphere right now.',
    confidence: {
      score: base.confidence?.score ?? 0.55,
      label: base.confidence?.label ?? 'medium',
    },
    note: base.note,
    match_score: overallCompatibility,
    shared_artists: base.sharedArtists || [],
    shared_genres: base.sharedGenres || [],
    shared_tracks: (bridges.sharedTracks || []).map((track) => track.title),
    breakdown: {
      artists: artistOverlapScore,
      genres: genreOverlapScore,
      audio: base.breakdown.audio,
      tracks: songOverlapScore,
      vibe: base.breakdown.vibe,
      mood_alignment: emotionalCompatibility,
      discovery_match: discoveryCompatibility,
      era_match: base.breakdown.eraMatch,
      mbti: mbtiCompatibility,
      orb: orbResonanceScore,
      tension: tensionScore,
    },
    profile_a: profileA,
    profile_b: profileB,
  }
}
