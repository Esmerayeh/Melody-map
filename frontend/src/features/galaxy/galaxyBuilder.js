import { describeCluster, describeEdge, describeMoodRegion, describeNode } from './galaxyExplainer.js'
import {
  buildArtistMetrics,
  buildClusterMetrics,
  buildGenreMetrics,
  buildTrackMetrics,
  deriveMoodRegion,
  genreColor,
  seededOffset,
  similarityScore,
  sonicColor,
  stableHash,
  buildSemanticPosition,
  averageFeatures,
} from './galaxyScoring.js'

export const GALAXY_LAYOUT_VERSION = 'canonical-galaxy-v3'

// ── Axis coordinate meanings (exposed in metadata so Auralith can explain distances)
export const COORDINATE_MEANING = {
  x: 'valence — emotional brightness: dark/melancholic (−) ↔ bright/joyful (+)',
  y: 'energy — intensity: quiet/ambient (−) ↔ loud/intense (+)',
  z: 'texture — organic/still (−) ↔ electronic/kinetic (+)',
}
export const SIMILARITY_BASIS = 'euclidean distance in [valence, energy, organic-texture] audio-feature space'
export const LAYOUT_METHOD    = 'audio-feature-projection-v1'

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value ?? 0))
const slugify = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const finite = (value) => (Number.isFinite(value) ? value : 0)
const clamp3d = (position = {}, limit = 18) => ({
  x: clamp(finite(position.x), -limit, limit),
  y: clamp(finite(position.y), -limit, limit),
  z: clamp(finite(position.z), -limit, limit),
})
const average = (values = []) => {
  const valid = values.filter((value) => value != null && !Number.isNaN(Number(value)))
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length
}

function averagePosition(points = []) {
  if (!points.length) return { x: 0, y: 0, z: 0 }
  const total = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
    z: acc.z + point.z,
  }), { x: 0, y: 0, z: 0 })
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  }
}

function sanitizeNode(node = {}) {
  const baseSize = Number(node.size ?? 0.5)
  const size = node.type === 'track'
    ? clamp(baseSize, 0.1, 0.45)
    : node.type === 'cluster'
      ? clamp(baseSize, 0.4, 1.2)
      : node.type === 'genre'
        ? clamp(baseSize, 0.5, 1.25)
        : clamp(baseSize, 0.18, 0.95)
  return {
    ...node,
    position: clamp3d(node.position || { x: 0, y: 0, z: 0 }),
    size: Number(size.toFixed(2)),
  }
}

function sanitizeRegion(region = {}) {
  if (!region.centroid) return null
  const centroid = clamp3d(region.centroid, 16)
  if (!Number.isFinite(centroid.x) || !Number.isFinite(centroid.y) || !Number.isFinite(centroid.z)) return null
  return {
    ...region,
    centroid,
    coverage: clamp(region.coverage, 0, 1),
  }
}

function normalizeLegacyNode(node = {}) {
  return {
    id: node.id || node._id,
    type: node.type || 'artist',
    label: node.label || node.title || node.artist || 'Unknown',
    image: node.image || node.album_art || null,
    genres: node.genres || (node.genre ? [node.genre] : []),
    popularity: node.popularity ?? 50,
    significance: clamp((node.popularity ?? 50) / 100),
    rarity: Number((1 - clamp((node.popularity ?? 50) / 100)).toFixed(3)),
    confidence: node.type === 'genre' ? 0.8 : 0.55,
    audioFeatures: node.audio_features || {},
    metrics: {
      centrality: clamp((node.popularity ?? 50) / 100),
      bridgeScore: 0.2,
      familiarity: clamp((node.popularity ?? 50) / 100),
      discoveryScore: Number((1 - clamp((node.popularity ?? 50) / 100)).toFixed(3)),
      frontierScore: Number((1 - clamp((node.popularity ?? 50) / 100)).toFixed(3)),
      anchorScore: clamp((node.popularity ?? 50) / 100),
    },
    position: node.position || node.map_coords_3d || { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
    color: node.color || node.sonic_color || '#e0a35c',
    size: node.size || (0.3 + clamp((node.popularity ?? 50) / 100)),
    clusterId: node.type === 'genre' ? `cluster:${slugify(node.genre || node.label || 'genre')}` : 'cluster:legacy',
    regionLabel: 'legacy',
    explanation: node.explanation || 'Legacy galaxy node adapted into the canonical model.',
    spotifyUrl: node.spotify_url || null,
    connections: node.connections || [],
    detailLevel: node.type === 'genre' ? 'macro' : 'mid',
    role: node.type === 'genre' ? 'anchor' : 'star',
  }
}

export function buildLegacyGalaxyModel(rawNodes = [], source = 'legacy') {
  const nodes = rawNodes.map(normalizeLegacyNode).map(sanitizeNode)
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]))
  const edges = []
  const seen = new Set()

  nodes.forEach((node) => {
    ;(node.connections || []).forEach((targetId) => {
      if (!nodeMap[targetId]) return
      const key = [node.id, targetId].sort().join('--')
      if (seen.has(key)) return
      seen.add(key)
      const edge = {
        id: key,
        source: node.id,
        target: targetId,
        type: node.type === 'genre' && nodeMap[targetId].type === 'genre' ? 'genre_affinity' : 'artist_genre',
        weight: 0.5,
        confidence: 0.55,
      }
      edge.explanation = describeEdge(edge)
      edges.push(edge)
    })
  })

  const clusterMap = new Map()
  nodes.forEach((node) => {
    const key = node.clusterId || 'cluster:legacy'
    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        id: key,
        label: key.replace('cluster:', '').replace(/-/g, ' ') || 'Legacy cluster',
        dominantGenres: node.genres || [],
        centroid: { ...node.position },
        color: node.color,
        explanation: 'Adapted from a legacy galaxy payload.',
        size: 1,
        metrics: buildClusterMetrics([node], 0.45),
      })
    } else {
      clusterMap.get(key).size += 1
    }
  })

  const clusters = [...clusterMap.values()]
    .map((cluster) => ({
      ...cluster,
      centroid: clamp3d(cluster.centroid || { x: 0, y: 0, z: 0 }, 14),
      explanation: describeCluster(cluster),
    }))

  return {
    nodes,
    edges,
    clusters,
    metadata: {
      layoutVersion: 'legacy-adapter-v1',
      galaxyDataVersion: GALAXY_LAYOUT_VERSION,
      generatedAt: new Date().toISOString(),
      source,
      dataQuality: null,
      confidence: null,
      density: {
        anchors: nodes.filter((node) => node.type === 'genre').length,
        stars: nodes.filter((node) => node.type === 'artist').length,
      },
    },
  }
}

/**
 * buildGenreAnchors
 * -----------------
 * Places genre nodes in semantic space derived from their member artists'
 * audio features.  If no artist features are available for a genre, falls
 * back to the ring layout (same as before) so the result degrades gracefully.
 *
 * This makes genre nebulae semantically true:
 *   - Dream pop (low energy, high acousticness) → quiet, organic quadrant
 *   - Dance music (high energy, high danceability) → intense, kinetic quadrant
 */
function buildGenreAnchors(genres = [], profileFeatures = {}, artists = []) {
  const topGenreCount = genres[0]?.count || 1

  // Build a lookup: genre slug → audio features of member artists
  const genreFeatureMap = new Map()
  artists.forEach((artist) => {
    const af = artist.audioFeatures || {}
    if (Object.keys(af).length === 0) return
    ;(artist.genres || []).forEach((genre) => {
      const key = genre.toLowerCase()
      if (!genreFeatureMap.has(key)) genreFeatureMap.set(key, [])
      genreFeatureMap.get(key).push(af)
    })
  })

  return genres.slice(0, 14).map((genre, index) => {
    const weight    = clamp((genre.count ?? 1) / topGenreCount)
    const genreKey  = genre.genre.toLowerCase()
    const memberFeatures = genreFeatureMap.get(genreKey) || []
    const avgFeatures    = memberFeatures.length >= 2
      ? averageFeatures(memberFeatures)
      : null

    let position
    if (avgFeatures && avgFeatures.valence != null && avgFeatures.energy != null) {
      // SEMANTIC: position from average audio features of member artists
      const sem = buildSemanticPosition(
        { ...avgFeatures, ...Object.fromEntries(Object.entries(profileFeatures).filter(([, v]) => v != null)) },
        `genre:${genre.genre}`,
        { jitterScale: 0.7, radialBoost: 1.0 },
      )
      // Genre nodes cluster slightly outward from artist positions for visibility
      position = {
        x: Number((sem.x * 0.88 + seededOffset(`genre-spread:${genre.genre}`, 0.5).x).toFixed(2)),
        y: Number((sem.y * 0.88 + seededOffset(`genre-spread:${genre.genre}`, 0.5).y).toFixed(2)),
        z: Number((sem.z * 0.88 + seededOffset(`genre-spread:${genre.genre}`, 0.5).z).toFixed(2)),
      }
    } else {
      // FALLBACK: deterministic ring for genres without enough artist feature data
      const angle       = (index / Math.max(genres.length, 1)) * Math.PI * 2
      const radius      = 9 + weight * 5
      const orbital     = seededOffset(`genre:${genre.genre}`, 0.9)
      const verticalBias = ((profileFeatures.energy ?? 0.5) - 0.5) * 4
      position = {
        x: Number((Math.cos(angle) * radius + orbital.x).toFixed(2)),
        y: Number((verticalBias * 0.18 + orbital.y * 0.7).toFixed(2)),
        z: Number((Math.sin(angle) * radius + orbital.z).toFixed(2)),
      }
    }

    return {
      id: `genre:${slugify(genre.genre)}`,
      type: 'genre',
      label: genre.genre,
      image: null,
      genres: [genre.genre],
      popularity: Math.round(weight * 100),
      significance: weight,
      rarity: Number((1 - weight).toFixed(3)),
      confidence: avgFeatures ? 0.92 : 0.72,
      audioFeatures: avgFeatures || {},
      metrics: buildGenreMetrics(genre, topGenreCount),
      position,
      color: genreColor(genre.genre),
      size: Number((0.95 + weight * 1.6).toFixed(2)),
      clusterId: `cluster:${slugify(genre.genre)}`,
      regionLabel: 'genre-field',
      explanation: avgFeatures
        ? `${genre.genre} is positioned in the galaxy from the average audio signature of your ${genre.genre} artists — not randomly.`
        : `${genre.genre} appears here from listening frequency. More audio data would sharpen its position.`,
      spotifyUrl: null,
      connections: [],
      detailLevel: 'macro',
      role: 'anchor',
      layoutBasis: avgFeatures ? 'semantic-audio-features' : 'deterministic-ring-fallback',
    }
  })
}

/**
 * buildArtistStars
 * ----------------
 * Positions artists using audio-feature-driven semantic coordinates.
 *
 * Layout formula (by priority):
 *   1. Semantic position from artist's own audio features         (80%)
 *   2. Weighted pull toward matching genre centroid               (20%)
 *   3. Small deterministic jitter to prevent exact overlap
 *   4. Frontier push for discovery artists (moves them outward)
 *
 * When audio features are absent, falls back to genre centroid +
 * profile-level features with a slightly larger jitter.
 *
 * This means:
 *   - Artists with similar [valence, energy, texture] cluster together
 *   - The distance between any two artist nodes reflects audio similarity
 *   - Genre biomes remain coherent because genres share feature space
 */
function buildArtistStars(artists = [], genreNodes = [], profileFeatures = {}) {
  const genreMap = Object.fromEntries(genreNodes.map((node) => [node.label.toLowerCase(), node]))

  return artists.slice(0, 50).map((artist, index) => {
    const artistGenres    = (artist.genres || []).filter(Boolean)
    const matchedGenres   = artistGenres.map((genre) => genreMap[genre.toLowerCase()]).filter(Boolean)
    const dominantGenreNode = matchedGenres[0] || genreNodes[0] || null
    const genreCentroid   = averagePosition(matchedGenres.map((node) => node.position))

    // Resolve audio features: own → genre average → profile average
    const ownFeatures     = artist.audioFeatures || {}
    const hasOwnFeatures  = Object.keys(ownFeatures).some((k) => ownFeatures[k] != null)
    const features        = hasOwnFeatures ? ownFeatures : (profileFeatures || {})
    const featureBasis    = hasOwnFeatures ? 'artist_audio_features' : 'profile_average_fallback'

    const metrics       = buildArtistMetrics(artist, index, artists.length)
    const regionLabel   = deriveMoodRegion(features)

    // Radial boost: frontier/discovery artists sit further from centre
    const radialBoost   = 0.85 + metrics.discoveryScore * 0.65
    // Jitter: smaller than before so audio features dominate
    const jitterScale   = hasOwnFeatures ? 0.75 : 1.1

    // Semantic core position (PRIMARY — 80%)
    const sem = buildSemanticPosition(features, artist.id || artist.name || `artist-${index}`, {
      jitterScale,
      radialBoost,
    })

    // Genre centroid attraction (SECONDARY — 20% pull when matched genre exists)
    const genrePull = matchedGenres.length > 0 ? 0.20 : 0

    const position = {
      x: Number((sem.x * (1 - genrePull) + genreCentroid.x * genrePull).toFixed(2)),
      y: Number((sem.y * (1 - genrePull) + genreCentroid.y * genrePull + (metrics.significance - 0.5) * 1.2).toFixed(2)),
      z: Number((sem.z * (1 - genrePull) + genreCentroid.z * genrePull).toFixed(2)),
    }

    return {
      id: `artist:${artist.id || slugify(artist.name) || index}`,
      type: 'artist',
      label: artist.name || 'Unknown Artist',
      image: artist.image || null,
      genres: artistGenres,
      popularity: artist.popularity ?? 50,
      significance: metrics.significance,
      rarity: metrics.rarity,
      confidence: matchedGenres.length ? 0.84 : 0.6,
      audioFeatures: features,
      metrics,
      position,
      color: sonicColor(features, matchedGenres.length ? 0.84 : 0.62),
      size: Number((0.34 + metrics.significance * 0.95 + metrics.bridgeScore * 0.18).toFixed(2)),
      clusterId: dominantGenreNode?.clusterId || 'cluster:core',
      regionLabel,
      explanation: hasOwnFeatures
        ? `${artist.name} is placed from its own audio signature — valence ${+((features.valence ?? 0.5).toFixed(2))}, energy ${+((features.energy ?? 0.5).toFixed(2))}. Nearby artists share these characteristics.`
        : `${artist.name} is positioned from genre affinity and profile-level audio signals.`,
      layoutBasis: featureBasis,
      spotifyUrl: artist.spotify_url || null,
      connections: [],
      detailLevel: metrics.significance > 0.7 ? 'macro' : metrics.discoveryScore > 0.55 ? 'micro' : 'mid',
      role: metrics.bridgeScore > 0.5 ? 'bridge-star' : metrics.significance > 0.72 ? 'anchor-star' : 'star',
      // Surge/ghost flags preserved from raw profile data
      metrics: {
        ...metrics,
        isSurge: artist.metrics?.isSurge || false,
        isGhost: artist.metrics?.isGhost || false,
      },
    }
  })
}

function buildTrackSatellites(tracks = [], artistNodes = [], genreNodes = []) {
  const artistMap = new Map(artistNodes.map((node) => [node.label.toLowerCase(), node]))
  const genreMap = Object.fromEntries(genreNodes.map((node) => [node.label.toLowerCase(), node]))
  return tracks.slice(0, 36).map((track, index) => {
    const primaryArtist = artistMap.get((track.artist || '').toLowerCase()) || null
    const artistGenres = primaryArtist?.genres || []
    const genreAnchor = artistGenres.map((genre) => genreMap[genre.toLowerCase()]).filter(Boolean)[0] || null
    const anchor = primaryArtist?.position || genreAnchor?.position || { x: 0, y: 0, z: 0 }
    const metrics = buildTrackMetrics(track, index, tracks.length)
    const offset = seededOffset(`track:${track.id || track.title || index}`, 0.85 + metrics.discoveryScore)
    return {
      id: `track:${track.id || slugify(`${track.title}-${track.artist}`) || index}`,
      type: 'track',
      label: track.title || 'Unknown Track',
      image: track.album_art || null,
      genres: artistGenres,
      popularity: track.popularity ?? null,
      significance: metrics.significance,
      rarity: metrics.rarity,
      confidence: primaryArtist ? 0.74 : 0.5,
      audioFeatures: track.audio_features || primaryArtist?.audioFeatures || {},
      metrics,
      position: {
        x: Number((anchor.x + offset.x * 1.35 + (metrics.discoveryScore * 2.3)).toFixed(2)),
        y: Number((anchor.y + offset.y * 1.1 - 0.3).toFixed(2)),
        z: Number((anchor.z + offset.z * 1.35).toFixed(2)),
      },
      color: sonicColor(track.audio_features || primaryArtist?.audioFeatures || {}, 0.65),
      size: Number((0.12 + metrics.significance * 0.22).toFixed(2)),
      clusterId: primaryArtist?.clusterId || genreAnchor?.clusterId || 'cluster:frontier',
      regionLabel: deriveMoodRegion(track.audio_features || primaryArtist?.audioFeatures || {}),
      explanation: primaryArtist
        ? `${track.title} appears as a satellite because it sharpens the world around ${primaryArtist.label}.`
        : `${track.title} sits on the edge because it lacks a strong artist anchor in the visible map.`,
      spotifyUrl: track.spotify_url || null,
      connections: [],
      detailLevel: metrics.significance > 0.68 ? 'mid' : 'micro',
      role: 'satellite',
      parentArtistId: primaryArtist?.id || null,
      parentGenreId: genreAnchor?.id || null,
    }
  })
}

function buildClusterBodies(genreNodes = [], artistNodes = []) {
  return genreNodes.map((genreNode) => {
    const members = artistNodes.filter((node) => node.clusterId === genreNode.clusterId)
    const metrics = buildClusterMetrics(members, genreNode.metrics?.significance || 0.5)
    const centroid = averagePosition([genreNode.position, ...members.map((node) => node.position)])
    return {
      id: `cluster-body:${slugify(genreNode.label)}`,
      type: 'cluster',
      label: `${genreNode.label} district`,
      image: null,
      genres: [genreNode.label],
      popularity: Math.round((metrics.significance || 0.5) * 100),
      significance: metrics.significance,
      rarity: metrics.rarity,
      confidence: members.length ? 0.86 : 0.62,
      audioFeatures: {},
      metrics,
      position: {
        x: Number((centroid.x * 0.92).toFixed(2)),
        y: Number((centroid.y * 0.92).toFixed(2)),
        z: Number((centroid.z * 0.92).toFixed(2)),
      },
      color: genreNode.color,
      size: Number((0.55 + Math.min(1.8, members.length / 14)).toFixed(2)),
      clusterId: genreNode.clusterId,
      regionLabel: members[0]?.regionLabel || 'cosmic',
      explanation: members.length
        ? `${members.length} artist stars gather here, making this one of your clearest music neighborhoods.`
        : 'This region exists as a genre gravity well, but few artists currently orbit it closely.',
      spotifyUrl: null,
      connections: [],
      detailLevel: 'macro',
      role: 'cluster-core',
      memberIds: members.map((node) => node.id),
    }
  })
}

function buildMoodRegions(nodes = []) {
  const regionTitle = (label) => {
    const normalized = String(label || '').toLowerCase()
    if (normalized === 'dreamy') return 'Dream-pop Fog'
    if (normalized === 'haunted') return 'Mournful Indie River'
    if (normalized === 'romantic') return 'Indie Folk Meadow'
    if (normalized === 'electric') return 'Velvet Static Belt'
    if (normalized === 'euphoric') return 'Luminous Indie Arc'
    if (normalized === 'nostalgic') return 'Silver Echo Field'
    if (normalized === 'nocturnal') return 'Nocturne Bloom'
    return 'Cosmic Drift'
  }

  const moods = new Map()
  nodes
    .filter((node) => node.type === 'artist' || node.type === 'track')
    .forEach((node) => {
      const key = node.regionLabel || 'cosmic'
      if (!moods.has(key)) moods.set(key, [])
      moods.get(key).push(node)
    })

  const total = nodes.filter((node) => node.type === 'artist' || node.type === 'track').length || 1
  return [...moods.entries()]
    .map(([label, members]) => ({
      id: `region:${slugify(label)}`,
      label,
      title: regionTitle(label),
      color: members[0]?.color || '#e0a35c',
      centroid: averagePosition(members.map((member) => member.position)),
      coverage: Number((members.length / total).toFixed(3)),
      members: members.map((member) => member.id),
      anchorArtistIds: members
        .filter((member) => member.type === 'artist')
        .sort((a, b) => (b.metrics?.anchorScore || 0) - (a.metrics?.anchorScore || 0))
        .slice(0, 4)
        .map((member) => member.id),
      bridgeArtistIds: members
        .filter((member) => member.type === 'artist' && (member.metrics?.bridgeScore || 0) > 0.45)
        .slice(0, 3)
        .map((member) => member.id),
      explanation: `${label} mood field created from ${members.length} nearby bodies.`,
    }))
    .sort((a, b) => b.coverage - a.coverage)
    .map((region) => sanitizeRegion(region))
    .filter(Boolean)
    .map((region) => ({ ...region, explanation: describeMoodRegion(region) }))
}

function buildEdges({ genreNodes, clusterBodies, artistNodes, trackNodes, profileFeatures }) {
  const edges = []
  const seen = new Set()

  const pushEdge = (edge) => {
    if (seen.has(edge.id)) return
    seen.add(edge.id)
    edge.explanation = describeEdge(edge)
    edges.push(edge)
  }

  const genreMap = Object.fromEntries(genreNodes.map((node) => [node.label.toLowerCase(), node]))
  const clusterMap = Object.fromEntries(clusterBodies.map((node) => [node.clusterId, node]))

  artistNodes.forEach((artistNode) => {
    artistNode.genres.slice(0, 3).forEach((genre, index) => {
      const genreNode = genreMap[genre.toLowerCase()]
      if (!genreNode) return
      pushEdge({
        id: `${artistNode.id}--${genreNode.id}`,
        source: artistNode.id,
        target: genreNode.id,
        type: 'artist_genre',
        weight: Number((0.84 - index * 0.14).toFixed(3)),
        confidence: artistNode.confidence,
      })
    })

    const clusterNode = clusterMap[artistNode.clusterId]
    if (clusterNode) {
      pushEdge({
        id: `${artistNode.id}--${clusterNode.id}`,
        source: artistNode.id,
        target: clusterNode.id,
        type: 'cluster_membership',
        weight: Number((0.58 + artistNode.metrics.significance * 0.22).toFixed(3)),
        confidence: artistNode.confidence,
      })
    }
  })

  trackNodes.forEach((trackNode) => {
    if (trackNode.parentArtistId) {
      pushEdge({
        id: `${trackNode.id}--${trackNode.parentArtistId}`,
        source: trackNode.id,
        target: trackNode.parentArtistId,
        type: 'track_artist',
        weight: Number((0.45 + trackNode.metrics.significance * 0.35).toFixed(3)),
        confidence: trackNode.confidence,
      })
    }
    if (trackNode.parentGenreId) {
      pushEdge({
        id: `${trackNode.id}--${trackNode.parentGenreId}`,
        source: trackNode.id,
        target: trackNode.parentGenreId,
        type: 'track_genre',
        weight: Number((0.28 + trackNode.metrics.significance * 0.28).toFixed(3)),
        confidence: Math.max(0.45, trackNode.confidence - 0.08),
      })
    }
  })

  for (let i = 0; i < artistNodes.length; i += 1) {
    for (let j = i + 1; j < artistNodes.length; j += 1) {
      const a = artistNodes[i]
      const b = artistNodes[j]
      const sim = similarityScore(a, b, profileFeatures)
      if (sim.score < 0.48) continue
      pushEdge({
        id: `${a.id}--${b.id}`,
        source: a.id,
        target: b.id,
        type: sim.sharedGenres.length ? 'shared_genre' : 'audio_similarity',
        weight: Number(sim.score.toFixed(3)),
        confidence: sim.confidence,
      })
      if (a.clusterId !== b.clusterId && (a.metrics.bridgeScore > 0.48 || b.metrics.bridgeScore > 0.48) && sim.score > 0.58) {
        pushEdge({
          id: `${a.id}--${b.id}--bridge`,
          source: a.id,
          target: b.id,
          type: 'bridge_lane',
          weight: Number((sim.score * 0.92).toFixed(3)),
          confidence: Number(Math.max(sim.confidence, 0.7).toFixed(3)),
        })
      }
    }
  }

  genreNodes.forEach((genreNode, index) => {
    const relatedArtists = artistNodes.filter((artist) => artist.genres.some((genre) => genre.toLowerCase() === genreNode.label.toLowerCase()))
    genreNodes.slice(index + 1).forEach((otherGenreNode) => {
      const otherArtists = artistNodes.filter((artist) => artist.genres.some((genre) => genre.toLowerCase() === otherGenreNode.label.toLowerCase()))
      const overlap = relatedArtists.filter((artist) => otherArtists.some((other) => other.id === artist.id)).length
      if (!overlap) return
      pushEdge({
        id: `${genreNode.id}--${otherGenreNode.id}`,
        source: genreNode.id,
        target: otherGenreNode.id,
        type: 'genre_affinity',
        weight: Number(Math.min(1, overlap / 4).toFixed(3)),
        confidence: 0.74,
      })
    })
  })

  return edges
}

export function buildGalaxyModel(profile = null) {
  if (!profile) return buildLegacyGalaxyModel([], 'empty')

  const artists = (profile.topArtists || []).slice(0, 50)
  const tracks = (profile.topTracks || []).slice(0, 50)
  const genres = (profile.genres || []).slice(0, 14)
  if (!artists.length && profile.galaxyNodes?.length) {
    return buildLegacyGalaxyModel(profile.galaxyNodes, 'profile-galaxyNodes')
  }

  const profileFeatures = profile.audioFeatures || {}
  // Pass artists so genre nodes can be positioned from their members' audio features
  const genreNodesBase  = buildGenreAnchors(genres, profileFeatures, artists)
  const artistNodesBase = buildArtistStars(artists, genreNodesBase, profileFeatures)
  const coreArtists = artistNodesBase
    .filter((node) => node.metrics.anchorScore > 0.68)
    .slice(0, 8)
  const corePosition = averagePosition(coreArtists.map((node) => node.position))
  const profileTier = !artistNodesBase.length
    ? 'partial'
    : (profile.dataQuality?.audioCoverage || 0) > 0.55 && genres.length >= 4
      ? 'rich'
      : artistNodesBase.length >= 12
        ? 'medium'
        : 'partial'

  const sparseMode = profileTier === 'partial'
    || profileTier === 'limited'
    || (profile.confidence?.galaxy ?? 0) < 0.45

  const genreNodes = sparseMode ? genreNodesBase.slice(0, 6) : genreNodesBase
  const artistNodes = sparseMode ? artistNodesBase.slice(0, 18) : artistNodesBase
  const clusterBodies = buildClusterBodies(genreNodes, artistNodes)
  const trackNodes = sparseMode ? [] : buildTrackSatellites(tracks, artistNodes, genreNodes)
  const nodes = [...genreNodes, ...clusterBodies, ...artistNodes, ...trackNodes].map(sanitizeNode)
  const edgesBase = buildEdges({ genreNodes, clusterBodies, artistNodes, trackNodes, profileFeatures })
  const keepIds = new Set(nodes.map((node) => node.id))
  const edges = sparseMode
    ? edgesBase
        .filter((edge) => keepIds.has(edge.source) && keepIds.has(edge.target))
        .filter((edge) => ['artist_genre', 'genre_affinity', 'shared_genre', 'bridge_lane'].includes(edge.type))
        .slice(0, 120)
    : edgesBase
  const moodRegions = buildMoodRegions(nodes)
  const slimRegions = sparseMode ? moodRegions.filter((region) => (region.coverage || 0) > 0.12).slice(0, 4) : moodRegions

  const clusters = clusterBodies
    .map((clusterNode) => {
      const members = artistNodes.filter((node) => node.clusterId === clusterNode.clusterId)
      const cluster = {
        id: clusterNode.clusterId,
        label: clusterNode.label.replace(/\sdistrict$/i, ''),
        dominantGenres: [clusterNode.genres?.[0], ...members.flatMap((member) => member.genres).filter(Boolean)]
          .filter((genre, index, list) => genre && list.indexOf(genre) === index)
          .slice(0, 5),
        centroid: averagePosition([clusterNode.position, ...members.map((member) => member.position)]),
        color: clusterNode.color,
        explanation: clusterNode.explanation,
        size: members.length,
        metrics: clusterNode.metrics,
        regionLabel: clusterNode.regionLabel,
      }
      return { ...cluster, explanation: describeCluster(cluster) }
    })
    .sort((a, b) => b.size - a.size)

  const clusterMap = Object.fromEntries(clusters.map((cluster) => [cluster.id, cluster]))
  nodes.forEach((node) => {
    node.explanation = describeNode(node, clusterMap[node.clusterId])
  })

  // Measure how many artists have own audio features (layout quality indicator)
  const semanticCoverage = artistNodesBase.length > 0
    ? Number((artistNodesBase.filter((n) => n.layoutBasis === 'artist_audio_features').length / artistNodesBase.length).toFixed(3))
    : 0

  return {
    nodes,
    edges,
    clusters,
    regions: slimRegions,
    metadata: {
      layoutVersion: 'audio-feature-semantic-v1',
      layoutMethod: LAYOUT_METHOD,
      coordinateMeaning: COORDINATE_MEANING,
      similarityBasis: SIMILARITY_BASIS,
      semanticCoverage,
      galaxyDataVersion: GALAXY_LAYOUT_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'profile',
      dataQuality: profile.dataQuality || null,
      confidence: profile.confidence || null,
      density: {
        anchors: genreNodes.length + clusterBodies.length,
        artistStars: artistNodes.length,
        trackSatellites: trackNodes.length,
        edges: edges.length,
        regions: slimRegions.length,
      },
      profileTier,
      sparseMode,
      core: {
        label: 'Taste Core',
        position: corePosition,
        color: coreArtists[0]?.color || '#8b5cf6',
        supportingArtists: coreArtists.slice(0, 5).map((artist) => artist.id),
        strength: Number((average(coreArtists.map((artist) => artist.metrics?.anchorScore)) || 0.52).toFixed(3)),
      },
      focusPresets: {
        coreTaste: artistNodes.filter((node) => node.metrics.anchorScore > 0.72).slice(0, 6).map((node) => node.id),
        bridgeArtists: artistNodes.filter((node) => node.metrics.bridgeScore > 0.48).slice(0, 8).map((node) => node.id),
        discoveryFrontier: artistNodes.filter((node) => node.metrics.discoveryScore > 0.58).slice(0, 10).map((node) => node.id),
        strangeEdge: trackNodes.filter((node) => node.metrics.discoveryScore > 0.62).slice(0, 10).map((node) => node.id),
      },
      viewModes: ['identity', 'constellation', 'mood', 'discovery', 'genre'],
    },
  }
}

function buildSongSimilarityEdges(nodes = []) {
  const tracks = nodes.filter((node) => node.type === 'track').slice(0, 28)
  const edges = []
  const seen = new Set()

  for (let i = 0; i < tracks.length; i += 1) {
    for (let j = i + 1; j < tracks.length; j += 1) {
      const left = tracks[i]
      const right = tracks[j]
      const sameArtist = left.parentArtistId && left.parentArtistId === right.parentArtistId
      const sameRegion = left.regionLabel && left.regionLabel === right.regionLabel
      const sameCluster = left.clusterId && left.clusterId === right.clusterId
      if (!sameArtist && !sameRegion && !sameCluster) continue
      const key = `${left.id}--${right.id}--song`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({
        id: key,
        source: left.id,
        target: right.id,
        type: sameArtist ? 'song_artist_affinity' : sameRegion ? 'song_mood_affinity' : 'song_cluster_affinity',
        weight: sameArtist ? 0.82 : sameRegion ? 0.64 : 0.54,
        confidence: average([left.confidence, right.confidence]) ?? 0.58,
        explanation: sameArtist
          ? `${left.label} and ${right.label} share the same artist gravity.`
          : sameRegion
            ? `${left.label} and ${right.label} drift in the same emotional weather.`
            : `${left.label} and ${right.label} sit in the same listening neighborhood.`,
      })
    }
  }

  return edges.slice(0, 120)
}

// ── Scene safety guard ───────────────────────────────────────────────────────
// A single normalization pass applied to whatever model reaches the 3D scene,
// regardless of which builder produced it (client, legacy, or server artifact).
// One node with a non-finite position or invalid color must never be able to
// throw and take down the whole galaxy (which a render error otherwise would).
const isFiniteVec = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
const isValidColor = (c) => typeof c === 'string' && c.trim().length > 0

export function guardGalaxyModel(model) {
  if (!model) return model
  const rawNodes = model.nodes || []
  const kept = []
  let dropped = 0
  for (const node of rawNodes) {
    if (!isFiniteVec(node.position)) { dropped += 1; continue }
    kept.push(isValidColor(node.color) ? node : { ...node, color: '#e0a35c' })
  }
  if (dropped > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[GALAXY_GUARD] dropped ${dropped} node(s) with non-finite position`)
  }
  const keepIds = new Set(kept.map((node) => node.id))
  const edges = (model.edges || []).filter((edge) => keepIds.has(edge.source) && keepIds.has(edge.target))
  const regions = (model.regions || []).filter((region) => isFiniteVec(region.centroid))
  return { ...model, nodes: kept, edges, regions }
}

export function buildGalaxyModeModel(model, galaxyMode = 'universal') {
  if (!model) return null

  const allNodes = model.nodes || []
  const allEdges = model.edges || []
  const allRegions = model.regions || []
  const allClusters = model.clusters || []

  const keepIds = new Set()
  let nodes = allNodes
  let edges = allEdges
  let regions = allRegions
  let clusters = allClusters

  if (galaxyMode === 'genre') {
    const genreNodes = allNodes.filter((node) => node.type === 'genre' || node.type === 'cluster')
    const artistNodes = allNodes
      .filter((node) => node.type === 'artist')
      .sort((left, right) => ((right.metrics?.anchorScore || 0) + (right.metrics?.significance || 0)) - ((left.metrics?.anchorScore || 0) + (left.metrics?.significance || 0)))
      .slice(0, 24)
    nodes = [...genreNodes, ...artistNodes]
    nodes.forEach((node) => keepIds.add(node.id))
    edges = allEdges.filter((edge) => (
      keepIds.has(edge.source)
      && keepIds.has(edge.target)
      && ['artist_genre', 'genre_affinity', 'cluster_membership', 'shared_genre', 'bridge_lane'].includes(edge.type)
    ))
    regions = allRegions.filter((region) => (region.coverage || 0) > 0.08).slice(0, 6)
  } else if (galaxyMode === 'artist') {
    nodes = allNodes.filter((node) => node.type === 'artist')
    nodes.forEach((node) => keepIds.add(node.id))
    edges = allEdges.filter((edge) => (
      keepIds.has(edge.source)
      && keepIds.has(edge.target)
      && ['shared_genre', 'audio_similarity', 'bridge_lane'].includes(edge.type)
    ))
    regions = []
    clusters = allClusters.filter((cluster) => cluster.size > 1)
  } else if (galaxyMode === 'song') {
    nodes = allNodes
      .filter((node) => node.type === 'track')
      .sort((left, right) => ((right.metrics?.significance || 0) + (right.metrics?.discoveryScore || 0)) - ((left.metrics?.significance || 0) + (left.metrics?.discoveryScore || 0)))
      .slice(0, 28)
    nodes.forEach((node) => keepIds.add(node.id))
    edges = buildSongSimilarityEdges(nodes)
    regions = []
    clusters = []
  } else {
    nodes = allNodes
    edges = allEdges
    regions = allRegions
    clusters = allClusters
  }

  return {
    ...model,
    nodes,
    edges,
    regions,
    clusters,
    metadata: {
      ...model.metadata,
      galaxyMode,
      modeDensity: {
        nodes: nodes.length,
        edges: edges.length,
        regions: regions.length,
        clusters: clusters.length,
      },
    },
  }
}
