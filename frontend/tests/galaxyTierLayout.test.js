/**
 * The galaxy must read as three separated tiers — genres apart, artists inside
 * their genre, tracks by their artist — not a pile at the centre. This locks
 * the layout invariants: genre separation, artist→genre containment, track→
 * artist proximity, idempotency, and graceful handling of sparse data.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { applyTierLayout } from '../src/features/galaxy/galaxyTierLayout.js'

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

function sampleModel() {
  const genres = ['rock', 'indie', 'dream pop', 'shoegaze'].map((g, i) => ({
    id: `genre:${g}`, type: 'genre', label: g, clusterId: `cluster:${g}`,
    significance: 1 - i * 0.2, position: { x: 0, y: 0, z: 0 },
  }))
  const artists = [
    { id: 'artist:blur', type: 'artist', label: 'Blur', clusterId: 'cluster:rock', genres: ['rock'], significance: 0.9, position: { x: 0, y: 0, z: 0 } },
    { id: 'artist:mazzy', type: 'artist', label: 'Mazzy Star', clusterId: 'cluster:dream pop', genres: ['dream pop'], significance: 0.7, position: { x: 0, y: 0, z: 0 } },
    { id: 'artist:slowdive', type: 'artist', label: 'Slowdive', clusterId: 'cluster:shoegaze', genres: ['shoegaze'], significance: 0.4, position: { x: 0, y: 0, z: 0 } },
  ]
  const tracks = [
    { id: 'track:tender', type: 'track', label: 'Tender', parentArtistId: 'artist:blur', significance: 0.6, position: { x: 0, y: 0, z: 0 } },
  ]
  return { nodes: [...genres, ...artists, ...tracks], edges: [], metadata: {} }
}

test('genre regions are spatially separated, not piled at the centre', () => {
  const out = applyTierLayout(sampleModel())
  const genres = out.nodes.filter((n) => n.type === 'genre')
  for (let i = 0; i < genres.length; i += 1) {
    // every genre sits well away from the origin
    assert.ok(dist(genres[i].position, { x: 0, y: 0, z: 0 }) > 8, `${genres[i].label} too close to core`)
    for (let j = i + 1; j < genres.length; j += 1) {
      assert.ok(dist(genres[i].position, genres[j].position) > 6, `${genres[i].label}/${genres[j].label} labels would collide`)
    }
  }
})

test('artists are placed inside their own genre region', () => {
  const out = applyTierLayout(sampleModel())
  const byId = Object.fromEntries(out.nodes.map((n) => [n.id, n]))
  const checks = [['artist:blur', 'genre:rock'], ['artist:mazzy', 'genre:dream pop'], ['artist:slowdive', 'genre:shoegaze']]
  for (const [aId, gId] of checks) {
    const a = byId[aId], g = byId[gId]
    // nearest genre to the artist is its own genre
    const nearest = out.nodes
      .filter((n) => n.type === 'genre')
      .map((n) => [n.id, dist(a.position, n.position)])
      .sort((x, y) => x[1] - y[1])[0][0]
    assert.equal(nearest, gId, `${aId} should sit nearest ${gId}`)
    assert.ok(dist(a.position, g.position) < 8, `${aId} too far from its genre`)
  }
})

test('tracks satellite their parent artist', () => {
  const out = applyTierLayout(sampleModel())
  const byId = Object.fromEntries(out.nodes.map((n) => [n.id, n]))
  assert.ok(dist(byId['track:tender'].position, byId['artist:blur'].position) < 2.5)
})

test('layout is idempotent (already-laid-out models pass through)', () => {
  const once = applyTierLayout(sampleModel())
  const twice = applyTierLayout(once)
  assert.equal(twice, once) // same reference — short-circuited by metadata flag
})

test('empty / missing models are returned untouched', () => {
  assert.equal(applyTierLayout(null), null)
  const empty = { nodes: [], metadata: {} }
  assert.equal(applyTierLayout(empty), empty)
})
