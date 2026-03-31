import test from 'node:test'
import assert from 'node:assert/strict'
import useGalaxyInteractionStore from '../src/features/galaxy/useGalaxyInteractionStore.js'
import { buildGalaxyModeModel } from '../src/features/galaxy/galaxyBuilder.js'
import {
  buildCoreSelection,
  normalizeGalaxyObject,
  resolveInteractionEntity,
} from '../src/features/galaxy/interactionModel.js'

const profile = {
  audioFeatures: { energy: 0.61, valence: 0.44 },
  genres: [{ genre: 'shoegaze' }, { genre: 'dream pop' }],
  confidence: { overall: { score: 0.78 } },
}

const model = {
  nodes: [
    {
      id: 'artist:mbv',
      type: 'artist',
      label: 'My Bloody Valentine',
      clusterId: 'cluster:shoegaze',
      regionLabel: 'dreamy',
      position: { x: 1, y: 2, z: 3 },
      metrics: { anchorScore: 0.83 },
    },
  ],
  clusters: [
    {
      id: 'cluster:shoegaze',
      label: 'Shoegaze Haze',
    },
  ],
  regions: [
    {
      id: 'region:dreamy',
      label: 'dreamy',
      title: 'Dream-pop Fog',
    },
  ],
  edges: [
    {
      id: 'edge:bridge',
      source: 'artist:mbv',
      target: 'artist:other',
    },
  ],
  metadata: {
    core: {
      label: 'Taste Core',
      color: '#9df6c9',
      position: { x: 0, y: 0, z: 0 },
      strength: 0.82,
    },
  },
}

test('normalizeGalaxyObject keeps only stable interaction fields', () => {
  assert.equal(normalizeGalaxyObject(null), null)
  assert.deepEqual(
    normalizeGalaxyObject({
      id: 'artist:mbv',
      type: 'artist',
      label: 'My Bloody Valentine',
      clusterId: 'cluster:shoegaze',
      regionId: 'region:dreamy',
      extra: 'ignored',
    }),
    {
      id: 'artist:mbv',
      type: 'artist',
      label: 'My Bloody Valentine',
      clusterId: 'cluster:shoegaze',
      regionId: 'region:dreamy',
    },
  )
})

test('resolveInteractionEntity resolves node, region, edge, and core selections', () => {
  assert.equal(resolveInteractionEntity(model, profile, { id: 'artist:mbv', type: 'artist' }).node?.label, 'My Bloody Valentine')
  assert.equal(resolveInteractionEntity(model, profile, { id: 'cluster:shoegaze', type: 'cluster' }).cluster?.label, 'Shoegaze Haze')
  assert.equal(resolveInteractionEntity(model, profile, { id: 'region:dreamy', type: 'region' }).region?.title, 'Dream-pop Fog')
  assert.equal(resolveInteractionEntity(model, profile, { id: 'edge:bridge', type: 'edge' }).edge?.id, 'edge:bridge')
  assert.equal(resolveInteractionEntity(model, profile, { id: 'taste-core', type: 'core' }).node?.label, 'Taste Core')
})

test('buildCoreSelection exposes a real orb-ready interaction entity', () => {
  const core = buildCoreSelection(model, profile)
  assert.equal(core.type, 'core')
  assert.equal(core.label, 'Taste Core')
  assert.equal(core.confidence, 0.78)
  assert.deepEqual(core.genres, ['shoegaze', 'dream pop'])
})

test('useGalaxyInteractionStore keeps focus and hover state in sync with constellation rules', () => {
  const store = useGalaxyInteractionStore
  store.getState().resetGalaxyInteraction()

  store.getState().setViewMode('constellation')
  store.getState().setFocusedObject({ id: 'artist:mbv', type: 'artist', label: 'My Bloody Valentine' })
  assert.equal(store.getState().focusedObject.id, 'artist:mbv')
  assert.equal(store.getState().constellationOrigin, 'artist:mbv')

  store.getState().setHoveredObject({ id: 'region:dreamy', type: 'region', label: 'Dream-pop Fog' })
  assert.equal(store.getState().hoveredObject.id, 'region:dreamy')

  store.getState().clearFocusedObject()
  store.getState().clearHoveredObject()
  assert.equal(store.getState().focusedObject, null)
  assert.equal(store.getState().hoveredObject, null)
})

test('useGalaxyInteractionStore updates galaxy mode with mode-aware layer defaults', () => {
  const store = useGalaxyInteractionStore
  store.getState().resetGalaxyInteraction()

  store.getState().toggleMoodRegions()
  store.getState().setGalaxyMode('song')
  assert.equal(store.getState().galaxyMode, 'song')
  assert.equal(store.getState().showTracks, true)
  assert.equal(store.getState().showMoodRegions, false)

  store.getState().setGalaxyMode('genre')
  assert.equal(store.getState().galaxyMode, 'genre')
  assert.equal(store.getState().showTracks, false)

  store.getState().setNodeData([{ id: 'artist:mbv' }])
  store.getState().setLayoutData({ galaxyMode: 'genre', regions: [] })
  assert.equal(store.getState().nodeData.length, 1)
  assert.equal(store.getState().layoutData.galaxyMode, 'genre')
})

test('buildGalaxyModeModel filters the canonical graph by exploration mode', () => {
  const fullModel = {
    ...model,
    nodes: [
      {
        id: 'genre:shoegaze',
        type: 'genre',
        label: 'shoegaze',
        clusterId: 'cluster:shoegaze',
        regionLabel: 'dreamy',
        metrics: { significance: 0.9 },
      },
      {
        id: 'cluster-body:shoegaze',
        type: 'cluster',
        label: 'Shoegaze district',
        clusterId: 'cluster:shoegaze',
        regionLabel: 'dreamy',
        metrics: { significance: 0.8 },
      },
      model.nodes[0],
      {
        id: 'track:only-shallow',
        type: 'track',
        label: 'Only Shallow',
        clusterId: 'cluster:shoegaze',
        regionLabel: 'dreamy',
        parentArtistId: 'artist:mbv',
        metrics: { significance: 0.73, discoveryScore: 0.41 },
        confidence: 0.71,
      },
    ],
    edges: [
      { id: 'artist-genre', source: 'artist:mbv', target: 'genre:shoegaze', type: 'artist_genre', weight: 0.8, confidence: 0.8 },
      { id: 'artist-cluster', source: 'artist:mbv', target: 'cluster-body:shoegaze', type: 'cluster_membership', weight: 0.7, confidence: 0.8 },
      { id: 'artist-shared', source: 'artist:mbv', target: 'artist:mbv', type: 'shared_genre', weight: 0.6, confidence: 0.8 },
    ],
    clusters: [{ id: 'cluster:shoegaze', label: 'Shoegaze Haze', size: 3 }],
  }

  const genreModel = buildGalaxyModeModel(fullModel, 'genre')
  assert.ok(genreModel.nodes.every((node) => ['genre', 'cluster', 'artist'].includes(node.type)))

  const artistModel = buildGalaxyModeModel(fullModel, 'artist')
  assert.ok(artistModel.nodes.every((node) => node.type === 'artist'))
  assert.equal(artistModel.regions.length, 0)

  const songModel = buildGalaxyModeModel(fullModel, 'song')
  assert.ok(songModel.nodes.every((node) => node.type === 'track'))
  assert.ok(songModel.edges.every((edge) => edge.type.startsWith('song_')))
})
