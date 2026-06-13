/**
 * galaxyTierLayout
 * ----------------
 * Re-lays the galaxy into three legible, spatially-separated tiers so the
 * user's music reads as structure, not a pile at the centre.
 *
 * Why this exists: positions arrive from audio-feature semantics, and when the
 * recovered features are all mid-range (valence ~0.53, energy ~0.55) every node
 * lands near the origin in an unreadable clump. This pass keeps every node's
 * data and linkage (clusterId / parentArtistId / parentGenreId) but assigns
 * deterministic, well-separated positions:
 *
 *   GENRES  → distributed across a flattened sphere (golden-angle), big regions
 *             pushed apart so their labels never collide.
 *   ARTISTS → clustered inside their genre's region; high-significance anchors
 *             sit near the genre core, lesser artists further out.
 *   TRACKS  → small satellites near their parent artist.
 *
 * Pure + deterministic (seeded by node id) so positions are stable across
 * renders — the fly-through camera and click-to-focus stay consistent.
 */
// Self-contained deterministic hash (string → uint32) so positions are stable
// across renders without pulling the wider scoring module into this layout pass.
function stableHash(value = '') {
  const str = String(value)
  let hash = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const GENRE_RADIUS = 16      // how far genre regions sit from the core
const DISC_FLATTEN = 0.55    // squash vertically → reads as a galactic disc

function seededAngle(hash, shift = 0) {
  return (((hash >> shift) % 3600) / 3600) * Math.PI * 2
}

export function applyTierLayout(model) {
  if (!model || !Array.isArray(model.nodes) || model.nodes.length === 0) return model
  if (model.metadata?.tierLayout) return model // already laid out

  const nodes = model.nodes
  const genres = nodes.filter((n) => n.type === 'genre')
  const artists = nodes.filter((n) => n.type === 'artist')

  // ── 1. GENRES — separated regions on a flattened golden-angle sphere ────────
  const sortedGenres = [...genres].sort((a, b) => (b.significance || b.metrics?.significance || 0) - (a.significance || a.metrics?.significance || 0))
  const G = sortedGenres.length
  const genreCenter = new Map()      // genre node id → position
  const centerByCluster = new Map()  // clusterId → position
  const centerByLabel = new Map()    // lowercased genre label → position

  sortedGenres.forEach((g, i) => {
    const sig = g.significance ?? g.metrics?.significance ?? 0.5
    // Flattened sphere: y in [-1,1], ring radius from y, golden-angle around.
    const y = G > 1 ? 1 - (i / (G - 1)) * 2 : 0
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GOLDEN * i
    const radius = GENRE_RADIUS * (0.92 + sig * 0.22)
    const pos = {
      x: Number((Math.cos(theta) * ring * radius).toFixed(2)),
      y: Number((y * radius * DISC_FLATTEN).toFixed(2)),
      z: Number((Math.sin(theta) * ring * radius).toFixed(2)),
    }
    genreCenter.set(g.id, pos)
    if (g.clusterId) centerByCluster.set(g.clusterId, pos)
    if (g.label) centerByLabel.set(g.label.toLowerCase(), pos)
  })

  // ── 2. ARTISTS — clustered inside their genre region ────────────────────────
  const artistPos = new Map()
  artists.forEach((a) => {
    const center = (a.clusterId && centerByCluster.get(a.clusterId))
      || (Array.isArray(a.genres) && a.genres.length && centerByLabel.get(String(a.genres[0]).toLowerCase()))
      || { x: 0, y: 0, z: 0 }
    const hash = stableHash(a.id || a.label || 'artist')
    const sig = a.significance ?? a.metrics?.significance ?? 0.5
    // Anchors hug the genre core; lesser artists spread to the region's edge.
    const localR = 2.0 + (1 - sig) * 4.2
    const ang = seededAngle(hash, 0)
    const angY = seededAngle(hash, 5)
    artistPos.set(a.id, {
      x: Number((center.x + Math.cos(ang) * localR).toFixed(2)),
      y: Number((center.y + Math.sin(angY) * localR * 0.45 + (sig - 0.5) * 1.6).toFixed(2)),
      z: Number((center.z + Math.sin(ang) * localR).toFixed(2)),
    })
  })

  // ── 3. TRACKS — satellites near their parent artist (or genre) ──────────────
  const newNodes = nodes.map((node) => {
    if (node.type === 'genre') {
      return { ...node, position: genreCenter.get(node.id) || node.position }
    }
    if (node.type === 'artist') {
      return { ...node, position: artistPos.get(node.id) || node.position }
    }
    if (node.type === 'track') {
      const direct = node.parentArtistId && artistPos.get(node.parentArtistId)
      const viaGenre = node.parentGenreId && genreCenter.get(node.parentGenreId)
      const base = direct || viaGenre || { x: 0, y: 0, z: 0 }
      const hash = stableHash(node.id || node.label || 'track')
      const r = 0.7 + (hash % 5) * 0.16
      const ang = seededAngle(hash, 0)
      return {
        ...node,
        position: {
          x: Number((base.x + Math.cos(ang) * r).toFixed(2)),
          y: Number((base.y + ((hash % 3) - 1) * 0.42).toFixed(2)),
          z: Number((base.z + Math.sin(ang) * r).toFixed(2)),
        },
      }
    }
    return node
  })

  return { ...model, nodes: newNodes, metadata: { ...(model.metadata || {}), tierLayout: true } }
}
