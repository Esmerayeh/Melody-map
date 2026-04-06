export const EMPTY_OBJECT = Object.freeze({
  id: null,
  type: null,
})

const safePosition = (position = {}) => ({
  x: Number.isFinite(position.x) ? position.x : 0,
  y: Number.isFinite(position.y) ? position.y : 0,
  z: Number.isFinite(position.z) ? position.z : 0,
})

export function slugifyInteraction(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function normalizeGalaxyObject(payload = null) {
  if (!payload?.id || !payload?.type) return null
  return {
    id: payload.id,
    type: payload.type,
    label: payload.label || null,
    clusterId: payload.clusterId || null,
    regionId: payload.regionId || null,
  }
}

export function buildCoreSelection(model, profile) {
  if (!model?.metadata?.core) return null
  return {
    id: 'taste-core',
    type: 'core',
    label: model.metadata.core.label,
    color: model.metadata.core.color,
    position: safePosition(model.metadata.core.position || {}),
    metrics: {
      centrality: model.metadata.core.strength,
      anchorScore: model.metadata.core.strength,
      bridgeScore: 0.24,
      discoveryScore: 0.18,
    },
    confidence: profile?.confidence?.overall?.score ?? 0.64,
    audioFeatures: profile?.audioFeatures || {},
    genres: (profile?.genres || []).slice(0, 4).map((genre) => genre.genre),
    explanation: 'The luminous center of gravity formed by your strongest recurring artists, genres, and emotional tendencies.',
    role: 'taste-core',
    regionLabel: 'core',
  }
}

export function resolveInteractionEntity(model, profile, interaction) {
  if (!model || !interaction?.id || !interaction?.type) {
    return {
      node: null,
      cluster: null,
      region: null,
      edge: null,
    }
  }

  if (interaction.type === 'cluster') {
    return {
      node: null,
      cluster: model.clusters?.find((cluster) => cluster.id === interaction.id) || null,
      region: null,
      edge: null,
    }
  }

  if (interaction.type === 'region') {
    return {
      node: null,
      cluster: null,
      region: model.regions?.find((region) => region.id === interaction.id) || null,
      edge: null,
    }
  }

  if (interaction.type === 'edge') {
    return {
      node: null,
      cluster: null,
      region: null,
      edge: model.edges?.find((edge) => edge.id === interaction.id) || null,
    }
  }

  if (interaction.type === 'core') {
    return {
      node: buildCoreSelection(model, profile),
      cluster: null,
      region: null,
      edge: null,
    }
  }

  return {
    node: model.nodes?.find((node) => node.id === interaction.id) || null,
    cluster: null,
    region: null,
    edge: null,
  }
}
