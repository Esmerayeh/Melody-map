/**
 * semanticLayout.test.js
 * ----------------------
 * Tests for the SEMANTIC TRUTH sprint.
 *
 * Verifies:
 *   1. Layout determinism       — same profile → same positions
 *   2. Proximity correctness    — similar audio features → closer in 3-D
 *   3. Axis semantics           — high valence → positive X, high energy → positive Y
 *   4. Ghost star classification
 *   5. Surge star classification
 *   6. Obsession score basis
 *   7. featureDistance utility
 *   8. explainProximity utility
 *   9. applyTimelineClassifications
 */
import test  from 'node:test'
import assert from 'node:assert/strict'
import { buildGalaxyModel } from '../src/features/galaxy/galaxyBuilder.js'
import {
  buildSemanticPosition,
  featureDistance,
  explainProximity,
  averageFeatures,
} from '../src/features/galaxy/galaxyScoring.js'
import { applyTimelineClassifications } from '../src/features/galaxy/artistClassification.js'
import { computeObsessionScore, findObsessionNode, labelForBasis } from '../src/features/universe/obsessionScore.js'

// ── helpers ──────────────────────────────────────────────────────────────────
function dist3d(a, b) {
  return Math.sqrt(
    (a.x - b.x) ** 2 +
    (a.y - b.y) ** 2 +
    (a.z - b.z) ** 2,
  )
}

const DREAM_POP_ARTIST = {
  id: 'a-dreamy', name: 'Dreamy Artist',
  popularity: 70, genres: ['dream pop'],
  audioFeatures: { valence: 0.38, energy: 0.25, acousticness: 0.72, danceability: 0.40, instrumentalness: 0.22 },
}
const DANCE_ARTIST = {
  id: 'a-dance', name: 'Dance Artist',
  popularity: 70, genres: ['dance pop'],
  audioFeatures: { valence: 0.78, energy: 0.85, acousticness: 0.12, danceability: 0.88, instrumentalness: 0.04 },
}
const DREAMY_SIMILAR = {
  id: 'a-dreamy2', name: 'Dreamy Similar',
  popularity: 60, genres: ['dream pop'],
  audioFeatures: { valence: 0.36, energy: 0.28, acousticness: 0.70, danceability: 0.38, instrumentalness: 0.20 },
}

const BASE_PROFILE = {
  audioFeatures: { valence: 0.38, energy: 0.25, acousticness: 0.72, danceability: 0.40 },
  genres: [{ genre: 'dream pop', count: 30, weight: 0.9 }, { genre: 'dance pop', count: 10, weight: 0.4 }],
  topArtists: [DREAM_POP_ARTIST, DANCE_ARTIST, DREAMY_SIMILAR],
  topTracks: [],
  dataQuality: { audioCoverage: 0.9 },
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Layout determinism
// ─────────────────────────────────────────────────────────────────────────────
test('buildSemanticPosition is deterministic', () => {
  const features = { valence: 0.38, energy: 0.25, acousticness: 0.72, danceability: 0.40 }
  const p1 = buildSemanticPosition(features, 'artist:velvet-collapse')
  const p2 = buildSemanticPosition(features, 'artist:velvet-collapse')
  assert.strictEqual(p1.x, p2.x, 'x must be deterministic')
  assert.strictEqual(p1.y, p2.y, 'y must be deterministic')
  assert.strictEqual(p1.z, p2.z, 'z must be deterministic')
})

test('buildGalaxyModel produces identical positions on two calls', () => {
  const m1 = buildGalaxyModel(BASE_PROFILE)
  const m2 = buildGalaxyModel(BASE_PROFILE)
  m1.nodes.forEach((node, i) => {
    const n2 = m2.nodes[i]
    assert.strictEqual(node.position.x, n2.position.x, `node ${node.id} x deterministic`)
    assert.strictEqual(node.position.y, n2.position.y, `node ${node.id} y deterministic`)
    assert.strictEqual(node.position.z, n2.position.z, `node ${node.id} z deterministic`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Proximity: similar features → closer together
// ─────────────────────────────────────────────────────────────────────────────
test('artists with similar audio features are placed closer together', () => {
  const model   = buildGalaxyModel(BASE_PROFILE)
  const artistNodes = model.nodes.filter((n) => n.type === 'artist')

  const dreamy    = artistNodes.find((n) => n.id === 'artist:a-dreamy')
  const similar   = artistNodes.find((n) => n.id === 'artist:a-dreamy2')
  const dance     = artistNodes.find((n) => n.id === 'artist:a-dance')

  assert.ok(dreamy,  'dreamy artist must exist in model')
  assert.ok(similar, 'dreamy-similar artist must exist in model')
  assert.ok(dance,   'dance artist must exist in model')

  const distSimilar = dist3d(dreamy.position, similar.position)
  const distDiff    = dist3d(dreamy.position, dance.position)

  assert.ok(
    distSimilar < distDiff,
    `similar pair (${distSimilar.toFixed(2)}) should be closer than different pair (${distDiff.toFixed(2)})`,
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Axis semantics
// ─────────────────────────────────────────────────────────────────────────────
test('high valence → positive X coordinate', () => {
  const bright = buildSemanticPosition({ valence: 0.9, energy: 0.5, acousticness: 0.5, danceability: 0.5 }, 'seed-bright')
  const dark   = buildSemanticPosition({ valence: 0.1, energy: 0.5, acousticness: 0.5, danceability: 0.5 }, 'seed-dark')
  assert.ok(bright.x > dark.x, `bright (x=${bright.x}) should have higher X than dark (x=${dark.x})`)
})

test('high energy → positive Y coordinate', () => {
  const loud  = buildSemanticPosition({ valence: 0.5, energy: 0.9, acousticness: 0.5, danceability: 0.5 }, 'seed-loud')
  const quiet = buildSemanticPosition({ valence: 0.5, energy: 0.1, acousticness: 0.5, danceability: 0.5 }, 'seed-quiet')
  assert.ok(loud.y > quiet.y, `loud (y=${loud.y}) should have higher Y than quiet (y=${quiet.y})`)
})

test('high acousticness → organic side of Z axis', () => {
  const organic    = buildSemanticPosition({ valence: 0.5, energy: 0.5, acousticness: 0.9, danceability: 0.2 }, 'seed-organic')
  const electronic = buildSemanticPosition({ valence: 0.5, energy: 0.5, acousticness: 0.1, danceability: 0.9 }, 'seed-electronic')
  assert.ok(organic.z > electronic.z, `organic z (${organic.z}) should be higher than electronic z (${electronic.z})`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ghost star classification
// ─────────────────────────────────────────────────────────────────────────────
test('applyTimelineClassifications marks ghost artists correctly', () => {
  const model = buildGalaxyModel(BASE_PROFILE)
  const ghostKey = 'a-dreamy'  // "a-dreamy" is in long_term but not short_term
  const timelines = {
    ghostIds:  new Set([ghostKey]),
    surgeIds:  new Set(),
    anchorIds: new Set(['a-dance']),
    basis:     'spotify-timeline-diff',
  }
  const updated = applyTimelineClassifications(model, timelines)
  const ghostNode = updated.nodes.find((n) => n.id === 'artist:a-dreamy')
  assert.ok(ghostNode,                         'ghost artist must exist')
  assert.strictEqual(ghostNode.metrics.isGhost, true,  'isGhost must be true')
  assert.strictEqual(ghostNode.role,            'ghost-star', 'role must be ghost-star')
  assert.strictEqual(ghostNode.metrics.isSurge, false, 'isSurge must be false')
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Surge star classification
// ─────────────────────────────────────────────────────────────────────────────
test('applyTimelineClassifications marks surge artists correctly', () => {
  const model = buildGalaxyModel(BASE_PROFILE)
  const timelines = {
    ghostIds:  new Set(),
    surgeIds:  new Set(['a-dance']),
    anchorIds: new Set(['a-dreamy']),
    basis:     'spotify-timeline-diff',
  }
  const updated   = applyTimelineClassifications(model, timelines)
  const surgeNode = updated.nodes.find((n) => n.id === 'artist:a-dance')
  assert.ok(surgeNode,                          'surge artist must exist')
  assert.strictEqual(surgeNode.metrics.isSurge, true, 'isSurge must be true')
  assert.strictEqual(surgeNode.role,            'surge-star', 'role must be surge-star')
})

test('applyTimelineClassifications leaves non-matched artists unchanged', () => {
  const model = buildGalaxyModel(BASE_PROFILE)
  const timelines = {
    ghostIds:  new Set(['a-dreamy']),
    surgeIds:  new Set(['a-dance']),
    anchorIds: new Set(),
    basis:     'spotify-timeline-diff',
  }
  const updated  = applyTimelineClassifications(model, timelines)
  const untouched = updated.nodes.find((n) => n.id === 'artist:a-dreamy2')
  assert.ok(untouched,                           'untouched artist must exist')
  assert.strictEqual(untouched.metrics.isGhost,  false, 'isGhost must remain false')
  assert.strictEqual(untouched.metrics.isSurge,  false, 'isSurge must remain false')
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Obsession score basis
// ─────────────────────────────────────────────────────────────────────────────
test('computeObsessionScore uses lastfm_playcount when available', () => {
  const artist = { id: 'a1', label: 'Test', playcount: 500, metrics: { significance: 0.6 } }
  const result = computeObsessionScore(artist, { isLastfm: true, playcountMax: 1000 })
  assert.strictEqual(result.basis, 'lastfm_playcount')
  assert.strictEqual(result.score, 0.5)
})

test('computeObsessionScore uses short_term_dominance for surge artists', () => {
  const artist = { id: 'a1', label: 'Test', metrics: { significance: 0.6, isSurge: true } }
  const result = computeObsessionScore(artist, { isLastfm: false, surgeIds: new Set(['a1']) })
  assert.strictEqual(result.basis, 'short_term_dominance')
  assert.ok(result.score >= 0.5, 'surge score should be at least 0.5')
})

test('computeObsessionScore falls back to significance with correct basis', () => {
  const artist = { id: 'a1', label: 'Test', metrics: { significance: 0.75 } }
  const result = computeObsessionScore(artist, {})
  assert.strictEqual(result.basis, 'fallback_significance')
  assert.strictEqual(result.score, 0.75)
})

test('labelForBasis returns Obsession Field only for real play data', () => {
  assert.strictEqual(labelForBasis('lastfm_playcount'),   'Obsession Field')
  assert.strictEqual(labelForBasis('listening_events'),   'Obsession Field')
  assert.strictEqual(labelForBasis('short_term_dominance'), 'Surge Gravity')
  assert.strictEqual(labelForBasis('fallback_significance'), 'Core Gravity Field')
})

test('findObsessionNode selects Last.fm artist when playcount available', () => {
  const artists = [
    { id: 'artist:a1', type: 'artist', label: 'Popular',    playcount: 1200, metrics: { significance: 0.9 } },
    { id: 'artist:a2', type: 'artist', label: 'Less played', playcount: 200,  metrics: { significance: 0.7 } },
  ]
  const result = findObsessionNode(artists, { isLastfm: true })
  assert.ok(result, 'should return a result')
  assert.strictEqual(result.node.label, 'Popular',       'should select highest play count')
  assert.strictEqual(result.basis,      'lastfm_playcount')
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. featureDistance utility
// ─────────────────────────────────────────────────────────────────────────────
test('featureDistance returns 0 for identical features', () => {
  const af = { valence: 0.5, energy: 0.5, acousticness: 0.5, danceability: 0.5 }
  assert.strictEqual(featureDistance(af, af), 0)
})

test('featureDistance is symmetric', () => {
  const a = { valence: 0.3, energy: 0.2, acousticness: 0.8, danceability: 0.3 }
  const b = { valence: 0.7, energy: 0.8, acousticness: 0.2, danceability: 0.7 }
  assert.strictEqual(featureDistance(a, b), featureDistance(b, a))
})

test('featureDistance max ≤ √3 (≈1.732)', () => {
  const a = { valence: 0, energy: 0, acousticness: 1, danceability: 0 }
  const b = { valence: 1, energy: 1, acousticness: 0, danceability: 1 }
  const d = featureDistance(a, b)
  assert.ok(d <= 1.733, `max distance ${d} should not exceed √3 ≈ 1.732`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. explainProximity utility
// ─────────────────────────────────────────────────────────────────────────────
test('explainProximity returns a non-empty string', () => {
  const a = { valence: 0.35, energy: 0.25, acousticness: 0.72, danceability: 0.38 }
  const b = { valence: 0.38, energy: 0.28, acousticness: 0.70, danceability: 0.40 }
  const msg = explainProximity(a, b)
  assert.ok(typeof msg === 'string' && msg.length > 0)
})

test('explainProximity mentions shared dimensions for similar artists', () => {
  const a = { valence: 0.35, energy: 0.22, acousticness: 0.75, danceability: 0.36 }
  const b = { valence: 0.38, energy: 0.25, acousticness: 0.72, danceability: 0.39 }
  const msg = explainProximity(a, b)
  // Should mention at least one shared dimension
  const hasDimension = msg.includes('brightness') || msg.includes('intensity') || msg.includes('texture')
  assert.ok(hasDimension, `explainProximity should mention a dimension: "${msg}"`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. averageFeatures utility
// ─────────────────────────────────────────────────────────────────────────────
test('averageFeatures returns null for empty array', () => {
  const result = averageFeatures([])
  assert.strictEqual(result.valence, null)
})

test('averageFeatures correctly averages multiple feature objects', () => {
  const features = [
    { valence: 0.2, energy: 0.4, acousticness: 0.6, danceability: 0.3 },
    { valence: 0.4, energy: 0.6, acousticness: 0.2, danceability: 0.5 },
  ]
  const avg   = averageFeatures(features)
  const close = (a, b, label) => assert.ok(Math.abs(a - b) < 0.0001, `${label}: ${a} ≈ ${b}`)
  close(avg.valence,      0.3, 'valence')
  close(avg.energy,       0.5, 'energy')
  close(avg.acousticness, 0.4, 'acousticness')
  close(avg.danceability, 0.4, 'danceability')
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Layout metadata is correct
// ─────────────────────────────────────────────────────────────────────────────
test('buildGalaxyModel includes semantic layout metadata', () => {
  const model = buildGalaxyModel(BASE_PROFILE)
  assert.ok(model.metadata.layoutVersion,     'layoutVersion must be set')
  assert.ok(model.metadata.layoutMethod,      'layoutMethod must be set')
  assert.ok(model.metadata.coordinateMeaning, 'coordinateMeaning must be set')
  assert.ok(model.metadata.similarityBasis,   'similarityBasis must be set')
  assert.ok(typeof model.metadata.semanticCoverage === 'number', 'semanticCoverage must be a number')
  assert.ok(model.metadata.semanticCoverage >= 0 && model.metadata.semanticCoverage <= 1,
    'semanticCoverage must be in [0,1]')
})

test('artist nodes have layoutBasis field', () => {
  const model   = buildGalaxyModel(BASE_PROFILE)
  const artists = model.nodes.filter((n) => n.type === 'artist')
  artists.forEach((n) => {
    assert.ok(n.layoutBasis, `artist ${n.id} must have layoutBasis`)
  })
})
