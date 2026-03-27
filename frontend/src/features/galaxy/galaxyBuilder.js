import { describeCluster, describeEdge, describeNode } from './galaxyExplainer'
import { buildArtistMetrics, buildGenreMetrics, genreColor, seededOffset, similarityScore, sonicColor, stableHash } from './galaxyScoring'

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value ?? 0))
const slugify = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

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
    },
    position: node.position || node.map_coords_3d || { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
    color: node.color || node.sonic_color || '#7c6fff',
    size: node.size || (0.3 + clamp((node.popularity ?? 50) / 100)),
    clusterId: node.type === 'genre' ? `cluster:${slugify(node.genre || node.label || 'genre')}` : 'cluster:legacy',
    explanation: 'Legacy galaxy node adapted into the canonical model.',
    spotifyUrl: node.spotify_url || null,
    connections: node.connections || [],
  }
}

export function buildLegacyGalaxyModel(rawNodes = [], source = 'legacy') {
  const nodes = rawNodes.map(normalizeLegacyNode)
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
      })
    } else {
      clusterMap.get(key).size += 1
    }
  })

  const clusters = [...clusterMap.values()].map((cluster) => ({
    ...cluster,
    explanation: describeCluster(cluster),
  }))

  return {
    nodes,
    edges,
    clusters,
    metadata: {
      layoutVersion: 'legacy-adapter-v1',
      generatedAt: new Date().toISOString(),
      source,
      dataQuality: null,
    },
  }
}

export function buildGalaxyModel(profile = null) {
  if (!profile) return buildLegacyGalaxyModel([], 'empty')

  const artists = (profile.topArtists || []).slice(0, 50)
  const genres = (profile.genres || []).slice(0, 12)
  if (!artists.length && profile.galaxyNodes?.length) {
    return buildLegacyGalaxyModel(profile.galaxyNodes, 'profile-galaxyNodes')
  }

  const profileFeatures = profile.audioFeatures || {}
  const topGenreCount = genres[0]?.count || 1
  const genreNodes = genres.map((genre, index) => {
    const angle = (index / Math.max(genres.length, 1)) * Math.PI * 2
    const weight = clamp((genre.count ?? 1) / topGenreCount)
    const radius = 5.5 + (weight * 4.5)
    const vertical = ((stableHash(genre.genre) % 7) - 3) * 0.35
    return {
      id: `genre:${slugify(genre.genre)}`,
      type: 'genre',
      label: genre.genre,
      image: null,
      genres: [genre.genre],
      popularity: Math.round(weight * 100),
      significance: weight,
      rarity: Number((1 - weight).toFixed(3)),
      confidence: 0.9,
      audioFeatures: {},
      metrics: buildGenreMetrics(genre, topGenreCount),
      position: {
        x: Number((Math.cos(angle) * radius).toFixed(2)),
        y: Number(vertical.toFixed(2)),
        z: Number((Math.sin(angle) * radius).toFixed(2)),
      },
      color: genreColor(genre.genre),
      size: Number((0.7 + weight * 1.1).toFixed(2)),
      clusterId: `cluster:${slugify(genre.genre)}`,
      explanation: `${genre.genre} is a primary gravity well because it appears ${genre.count} times across your top artists.`,
      spotifyUrl: null,
      connections: [],
    }
  })

  const genreMap = Object.fromEntries(genreNodes.map((node) => [node.label.toLowerCase(), node]))
  const artistNodes = artists.map((artist, index) => {
    const artistGenres = (artist.genres || []).filter(Boolean)
    const matchedGenres = artistGenres.map((genre) => genreMap[genre.toLowerCase()]).filter(Boolean)
    const dominantGenreNode = matchedGenres[0] || genreNodes[0] || null
    const anchor = averagePosition(matchedGenres.map((node) => node.position))
    const features = artist.audioFeatures || profileFeatures || {}
    const audioVector = {
      x: (clamp(features.valence, 0, 1) - 0.5) * 8,
      y: (clamp(features.energy, 0, 1) - 0.5) * 8,
      z: (clamp(features.danceability, 0, 1) - 0.5) * 8,
    }
    const metrics = buildArtistMetrics(artist, index, artists.length)
    const jitter = seededOffset(artist.id || artist.name || `${index}`, 1.2)
    const radialScale = 0.8 + metrics.discoveryScore * 0.9
    return {
      id: `artist:${artist.id || slugify(artist.name) || index}`,
      type: 'artist',
      label: artist.name || 'Unknown Artist',
      image: artist.image || null,
      genres: artistGenres,
      popularity: artist.popularity ?? 50,
      significance: metrics.significance,
      rarity: metrics.rarity,
      confidence: matchedGenres.length ? 0.82 : 0.58,
      audioFeatures: features,
      metrics,
      position: {
        x: Number((anchor.x * 0.6 + audioVector.x * radialScale + jitter.x).toFixed(2)),
        y: Number((anchor.y * 0.2 + audioVector.y + jitter.y + (metrics.significance - 0.5) * 2.5).toFixed(2)),
        z: Number((anchor.z * 0.6 + audioVector.z * radialScale + jitter.z).toFixed(2)),
      },
      color: sonicColor(features, matchedGenres.length ? 0.82 : 0.58),
      size: Number((0.42 + metrics.significance * 0.9).toFixed(2)),
      clusterId: dominantGenreNode?.clusterId || 'cluster:core',
      explanation: artistGenres.length
        ? `${artist.name} is pulled toward ${artistGenres.slice(0, 2).join(' and ')} while its audio profile nudges its exact position.`
        : `${artist.name} is placed from audio character and significance because genre data is sparse.`,
      spotifyUrl: artist.spotify_url || null,
      connections: [],
    }
  })

  const nodes = [...genreNodes, ...artistNodes]
  const edges = []
  const seen = new Set()

  const pushEdge = (edge) => {
    if (seen.has(edge.id)) return
    edge.explanation = describeEdge(edge)
    seen.add(edge.id)
    edges.push(edge)
  }

  artistNodes.forEach((artistNode) => {
    artistNode.genres.slice(0, 3).forEach((genre, index) => {
      const genreNode = genreMap[genre.toLowerCase()]
      if (!genreNode) return
      pushEdge({
        id: `${artistNode.id}--${genreNode.id}`,
        source: artistNode.id,
        target: genreNode.id,
        type: 'artist_genre',
        weight: Number((0.85 - index * 0.15).toFixed(3)),
        confidence: artistNode.confidence,
        explanation: `${artistNode.label} sits near ${genreNode.label} because that genre is one of its strongest anchors.`,
      })
    })
  })

  for (let i = 0; i < artistNodes.length; i += 1) {
    for (let j = i + 1; j < Math.min(artistNodes.length, 36); j += 1) {
      const a = artistNodes[i]
      const b = artistNodes[j]
      const sim = similarityScore(a, b, profileFeatures)
      if (sim.score < 0.42) continue
      pushEdge({
        id: `${a.id}--${b.id}`,
        source: a.id,
        target: b.id,
        type: sim.sharedGenres.length ? 'shared_genre' : 'audio_similarity',
        weight: Number(sim.score.toFixed(3)),
        confidence: sim.confidence,
        explanation: sim.sharedGenres.length
          ? `${a.label} and ${b.label} are linked by ${sim.sharedGenres.slice(0, 2).join(', ')}.`
          : `${a.label} and ${b.label} occupy a similar sonic pocket even without a strong genre overlap.`,
      })
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
        confidence: 0.72,
        explanation: `${genreNode.label} and ${otherGenreNode.label} repeatedly co-occur across your artist graph.`,
      })
    })
  })

  const clusters = genreNodes.map((genreNode) => {
    const members = artistNodes.filter((node) => node.clusterId === genreNode.clusterId)
    const cluster = {
      id: genreNode.clusterId,
      label: genreNode.label,
      dominantGenres: [genreNode.label, ...members.flatMap((member) => member.genres).filter(Boolean)]
        .filter((genre, index, list) => list.indexOf(genre) === index)
        .slice(0, 4),
      centroid: averagePosition([genreNode.position, ...members.map((member) => member.position)]),
      color: genreNode.color,
      explanation: members.length
        ? `${members.length} artists orbit here because they share this genre gravity well.`
        : 'This anchor is present, but your artists do not strongly cluster here yet.',
      size: members.length,
    }
    return { ...cluster, explanation: describeCluster(cluster) }
  }).sort((a, b) => b.size - a.size)

  const clusterMap = Object.fromEntries(clusters.map((cluster) => [cluster.id, cluster]))
  nodes.forEach((node) => {
    node.explanation = describeNode(node, clusterMap[node.clusterId])
  })

  return {
    nodes,
    edges,
    clusters,
    metadata: {
      layoutVersion: 'canonical-profile-v1',
      generatedAt: new Date().toISOString(),
      source: 'profile',
      dataQuality: profile.dataQuality || null,
    },
  }
}
