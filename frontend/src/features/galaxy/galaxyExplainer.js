export function describeCluster(cluster = {}) {
  const genres = (cluster.dominantGenres || []).slice(0, 3).join(', ') || 'mixed influences'
  const sizeText = cluster.size > 0 ? `${cluster.size} nearby bodies` : 'a sparse frontier'
  return `${cluster.label} is anchored by ${genres} and gathers ${sizeText}. ${cluster.explanation || ''}`.trim()
}

export function describeNode(node = {}, cluster = null) {
  const reasons = []
  if (node.type === 'genre') {
    reasons.push(`This anchor represents the genre "${node.label}".`)
    reasons.push('It acts like a gravity well for artists that repeatedly point back to that sound.')
  } else {
    reasons.push('Positioned from emotional brightness, intensity, and movement using your listening profile.')
    if (node.metrics?.bridgeScore > 0.45) reasons.push('It acts like a bridge artist between multiple taste neighborhoods.')
    if (node.metrics?.discoveryScore > 0.55) {
      reasons.push('Its radial distance is pushed outward because it reads as a discovery or fringe influence.')
    } else {
      reasons.push('It stays closer to the core because it behaves like a familiar pillar of your taste.')
    }
  }
  if (cluster?.label) reasons.push(`Cluster: ${cluster.label}.`)
  if (node.explanation) reasons.push(node.explanation)
  return reasons.join(' ')
}

export function describeEdge(edge = {}) {
  if (edge.explanation) return edge.explanation
  if (edge.type === 'artist_genre') return 'This edge ties an artist to a genre anchor that strongly shapes its position.'
  if (edge.type === 'shared_genre') return 'These artists are linked because they occupy overlapping genre territory.'
  if (edge.type === 'audio_similarity') return 'These artists sit near each other because their audio signatures point in a similar direction.'
  if (edge.type === 'genre_affinity') return 'These genre anchors are connected because they repeatedly co-occur across your top artists.'
  return 'This connection reflects a meaningful neighborhood relationship in your galaxy.'
}

export function getNebulaColors(model) {
  const dominant = model?.clusters?.[0]
  if (!dominant) return ['#1d1b3a', '#5b21b6']
  return [dominant.color || '#7c6fff', '#0b1024']
}
