export function describeCluster(cluster = {}) {
  const genres = (cluster.dominantGenres || []).slice(0, 3).join(', ') || 'mixed influences'
  const sizeText = cluster.size > 0 ? `${cluster.size} nearby bodies` : 'a sparse frontier'
  const frontierText = cluster.metrics?.discoveryScore > 0.55
    ? 'This neighborhood sits closer to your discovery frontier.'
    : 'This neighborhood belongs to your core listening mass.'
  const bridgeText = cluster.metrics?.bridgeScore > 0.45
    ? 'It also behaves like a corridor between multiple taste worlds.'
    : ''
  return `${cluster.label} is anchored by ${genres} and gathers ${sizeText}. ${frontierText} ${bridgeText} ${cluster.explanation || ''}`.trim()
}

export function describeNode(node = {}, cluster = null) {
  const reasons = []
  if (node.type === 'genre') {
    reasons.push(`This anchor represents the genre "${node.label}".`)
    reasons.push('It acts like a gravity well for artists that repeatedly point back to that sound.')
    if (node.metrics?.significance > 0.8) reasons.push('It is one of the dominant constellations in your map.')
  } else if (node.type === 'cluster') {
    reasons.push('This body summarizes an entire music neighborhood.')
    reasons.push('Its size and glow reflect how much of your listening identity gathers here.')
    if (node.metrics?.bridgeScore > 0.45) reasons.push('It also works as a transition zone between nearby worlds.')
  } else if (node.type === 'track') {
    reasons.push('This is a satellite track orbiting the artist and genre world it most strongly reinforces.')
    if (node.metrics?.discoveryScore > 0.55) reasons.push('It lives further out because it behaves like a rarer or more exploratory listen.')
  } else {
    reasons.push('Positioned from emotional brightness, intensity, and movement using your listening profile.')
    if (node.metrics?.bridgeScore > 0.45) reasons.push('It acts like a bridge artist between multiple taste neighborhoods.')
    if (node.metrics?.discoveryScore > 0.55) {
      reasons.push('Its radial distance is pushed outward because it reads as a discovery or fringe influence.')
    } else {
      reasons.push('It stays closer to the core because it behaves like a familiar pillar of your taste.')
    }
    if (node.metrics?.anchorScore > 0.72) reasons.push('It is luminous because it behaves like a major anchor in your identity.')
  }
  if (node.regionLabel) reasons.push(`Mood region: ${node.regionLabel}.`)
  if (cluster?.label) reasons.push(`Cluster: ${cluster.label}.`)
  if (node.explanation) reasons.push(node.explanation)
  return reasons.join(' ')
}

export function describeEdge(edge = {}) {
  if (edge.explanation) return edge.explanation
  if (edge.type === 'cluster_membership') return 'This edge tethers a body to the larger neighborhood that best explains its role in your map.'
  if (edge.type === 'artist_genre') return 'This edge ties an artist to a genre anchor that strongly shapes its position.'
  if (edge.type === 'track_artist') return 'This edge ties a satellite track to the artist star it most strongly reinforces.'
  if (edge.type === 'track_genre') return 'This edge shows which genre territory most strongly colors this track satellite.'
  if (edge.type === 'shared_genre') return 'These artists are linked because they occupy overlapping genre territory.'
  if (edge.type === 'audio_similarity') return 'These artists sit near each other because their audio signatures point in a similar direction.'
  if (edge.type === 'bridge_lane') return 'This link marks a bridge route between two worlds that repeatedly meet in your taste.'
  if (edge.type === 'genre_affinity') return 'These genre anchors are connected because they repeatedly co-occur across your top artists.'
  return 'This connection reflects a meaningful neighborhood relationship in your galaxy.'
}

function normalizeNebulaColor(color = '#8B7CFF') {
  const normalized = String(color || '').toLowerCase()
  if (
    normalized.includes('120') ||
    normalized.includes('91') ||
    normalized.includes('117') ||
    normalized.includes('green') ||
    normalized.includes('#34d399') ||
    normalized.includes('#9df6c9')
  ) {
    return '#8B7CFF'
  }
  return color || '#8B7CFF'
}

export function getNebulaColors(model) {
  const dominant = model?.clusters?.[0]
  if (!dominant) return ['#111022', '#5A46D6']
  return [normalizeNebulaColor(dominant.color || '#8B7CFF'), '#0B0B17']
}

export function describeMoodRegion(region = {}) {
  if (!region?.label) return null
  const title = region.title || region.label
  const coverage = region.coverage != null ? `${Math.round(region.coverage * 100)}%` : null
  return `${title}${coverage ? ` spans about ${coverage} of the visible galaxy` : ''} because your listening repeatedly lands in this emotional climate.`
}
