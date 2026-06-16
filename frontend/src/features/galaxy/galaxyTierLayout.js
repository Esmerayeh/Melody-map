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

// ── Spiral-arm shape controls ────────────────────────────────────────────────
// The galaxy lays its data out along logarithmic spiral arms radiating from the
// core (this replaced the old golden-ring disc). These named knobs ARE the whole
// shape — tune them freely without touching the placement code below. Values are
// in BASE units; the entire layout is multiplied by SPREAD_SCALE at the end, so
// e.g. ARM_OUTER_RADIUS 27 → ~108 units after the 4.0 spread (fills the vastness).
// Exported so the DECORATIVE procedural starfield (buildGalaxyDiskGeometry in
// GalaxyScene) can wind its arms with the EXACT same count/tightness/radii and
// land directly on top of these data-node arms. Retuning these here retunes both
// layers — never fork these numbers into the scene file.
export const ARM_COUNT           = 2     // how many spiral arms (try 2–3)
export const ARM_WIND_TURNS      = 1.1   // how tightly arms wind: turns swept inner→outer (higher = tighter)
export const ARM_INNER_RADIUS    = 4     // base radius where arms begin (keeps the core from piling)
export const ARM_OUTER_RADIUS    = 27    // base radius where arms end (fills the SPREAD_SCALE space)
const INTERARM_SCATTER    = 3.0   // radial fuzz so arms are organic, not razor lines
const ARM_ANGULAR_SCATTER = 0.20  // tangential fuzz (radians) — softens the arm edges
const ARM_THICKNESS_Y     = 2.2   // vertical disc thickness (kept slight → 3D disc, not flat)
const GENRE_SCATTER_MUL   = 0.45  // genres are anchors → less fuzz than the artists around them
const ARTIST_TRAIL        = 0.06  // how far lesser artists trail OUTWARD along their arm (t-space)
const TWO_PI = Math.PI * 2

const round2 = (n) => Number(n.toFixed(2))

// Deterministic pseudo-random in [0,1) from a hash, with a bit-shift channel so a
// single hash yields several independent jitter values (radial / angular / Y).
function rand01(hash, shift = 0) {
  return ((hash >>> shift) % 100000) / 100000
}

// Logarithmic spiral: radius grows EXPONENTIALLY with t while the sweep angle
// grows LINEARLY with t, so angle ∝ ln(radius) — a real log-spiral arm that
// curves gracefully, not a straight spoke. `arm` picks the (evenly spaced) arm,
// `t ∈ [0,1]` is the fractional distance along it (0 = inner/core end, 1 = outer
// tip). Deterministic jitter (by hash) gives organic, fuzzy arms. Returns
// BASE-scale coords; the caller multiplies by SPREAD_SCALE.
// The pure (un-jittered) log-spiral centerline for `arm` at fractional distance
// `t ∈ [0,1]`. Returns BASE-scale coords plus the raw { radius, angle } so callers
// can build a perpendicular offset (arm thickness) themselves. Both the data
// layout (via armSpiralPosition) and the decorative starfield use THIS so the two
// layers wind identically. Caller multiplies by SPREAD_SCALE for world space.
export function armCenterline(arm, t) {
  const tt = Math.max(0, t)
  const armBase = (arm / ARM_COUNT) * TWO_PI
  const phi     = ARM_WIND_TURNS * TWO_PI * tt
  const radius  = ARM_INNER_RADIUS * Math.pow(ARM_OUTER_RADIUS / ARM_INNER_RADIUS, Math.min(tt, 1.12))
  const angle   = armBase + phi
  return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius, radius, angle }
}

function armSpiralPosition(arm, t, hash, scatterMul = 1) {
  const c  = armCenterline(arm, t)
  const jr = (rand01(hash, 0)  - 0.5) * INTERARM_SCATTER * 2 * scatterMul
  const ja = (rand01(hash, 8)  - 0.5) * ARM_ANGULAR_SCATTER * scatterMul
  const jy = (rand01(hash, 16) - 0.5) * ARM_THICKNESS_Y * 2
  const angle = c.angle + ja
  const r     = Math.max(0.5, c.radius + jr)
  return { x: Math.cos(angle) * r, y: jy, z: Math.sin(angle) * r }
}

// Average of valid 3D points — used to RE-DERIVE region/cluster centroids from
// the new spiral node positions so the nebula haze + focus targets stay wrapped
// on the stars they belong to.
function averagePosition(positions) {
  const valid = positions.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
  if (!valid.length) return null
  let sx = 0, sy = 0, sz = 0
  for (const p of valid) { sx += p.x; sy += p.y; sz += p.z }
  return { x: round2(sx / valid.length), y: round2(sy / valid.length), z: round2(sz / valid.length) }
}

// ── Master spread knob ───────────────────────────────────────────────────────
// Single tunable that scales the WHOLE laid-out galaxy uniformly from the
// origin — every node position, plus region/cluster centroids, multiply by
// this. It is a pure similarity scale: the SHAPE (ring, clustering, satellites)
// is identical, just larger, so the galaxy reads as vast with empty space
// between regions. Node sizes, labels, bloom and the centred core are NOT
// scaled. Camera far-bounds in GalaxyScene/useTraversalCamera are sized to
// match this; if you raise it, raise those too. (1.0 = original packed size.)
// At 4.0 the outer galaxy radius is ~112 units. The region nebula haze scales
// by this same constant in GalaxyScene (RegionNebula baseScale + RegionParticles)
// so each blob stays wrapped on its genre's stars.
export const SPREAD_SCALE = 4.0

const scaleSpread = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
  ? {
    ...p,
    x: Number((p.x * SPREAD_SCALE).toFixed(2)),
    y: Number((p.y * SPREAD_SCALE).toFixed(2)),
    z: Number((p.z * SPREAD_SCALE).toFixed(2)),
  }
  : p)

function seededAngle(hash, shift = 0) {
  return (((hash >> shift) % 3600) / 3600) * Math.PI * 2
}

export function applyTierLayout(model) {
  if (!model || !Array.isArray(model.nodes) || model.nodes.length === 0) return model
  if (model.metadata?.tierLayout) return model // already laid out

  const nodes = model.nodes
  const genres = nodes.filter((n) => n.type === 'genre')
  const artists = nodes.filter((n) => n.type === 'artist')

  // ── 1. GENRES — anchor the spiral arms ──────────────────────────────────────
  // Higher-significance genres are placed first; arms are filled round-robin so
  // every arm gets a spread of genres from core (inner) to rim (outer). A genre's
  // slot fixes its { arm, t }, which its artists and tracks inherit so they trail
  // down the SAME arm — flying outward along an arm walks a genre's stars in
  // sequence. Genres start at ARM_INNER_RADIUS, never the origin, so the centre
  // stops being a pile.
  const sortedGenres = [...genres].sort((a, b) =>
    (b.significance || b.metrics?.significance || 0) - (a.significance || a.metrics?.significance || 0))
  const G = sortedGenres.length
  const genreCenter = new Map()       // genre id → base position (track fallback + centroid)
  const genreArmByCluster = new Map() // clusterId → { arm, t }
  const genreArmByLabel = new Map()   // lowercased genre label → { arm, t }

  sortedGenres.forEach((g, i) => {
    const arm = i % ARM_COUNT
    const idxInArm = Math.floor(i / ARM_COUNT)
    const countInArm = Math.max(1, Math.ceil((G - arm) / ARM_COUNT))
    const t = (idxInArm + 0.5) / countInArm // even slot along this arm, 0..1
    const hash = stableHash(g.id || g.label || 'genre')
    const pos = armSpiralPosition(arm, t, hash, GENRE_SCATTER_MUL)
    const rounded = { x: round2(pos.x), y: round2(pos.y), z: round2(pos.z) }
    genreCenter.set(g.id, rounded)
    const info = { arm, t }
    if (g.clusterId) genreArmByCluster.set(g.clusterId, info)
    if (g.label) genreArmByLabel.set(g.label.toLowerCase(), info)
  })

  // ── 2. ARTISTS — trail down their genre's arm ───────────────────────────────
  // Anchors (high significance) sit at the genre's slot; lesser artists trail a
  // little further OUTWARD along the same arm and scatter a touch wider, so the
  // arm reads as a streak of that genre's stars deepening outward.
  const artistPos = new Map()
  artists.forEach((a) => {
    const aHash = stableHash(a.id || a.label || 'artist')
    const armInfo = (a.clusterId && genreArmByCluster.get(a.clusterId))
      || (Array.isArray(a.genres) && a.genres.length && genreArmByLabel.get(String(a.genres[0]).toLowerCase()))
      || { arm: aHash % ARM_COUNT, t: 0.35 + rand01(aHash, 9) * 0.5 } // orphan → scatter on an arm, never the core
    const sig = a.significance ?? a.metrics?.significance ?? 0.5
    const t = armInfo.t + (1 - sig) * ARTIST_TRAIL + (rand01(aHash, 20) - 0.5) * 0.03
    const scatter = 0.5 + (1 - sig) * 1.0 // anchors tight on the arm, lesser fuzzier
    const base = armSpiralPosition(armInfo.arm, t, aHash, scatter)
    artistPos.set(a.id, {
      x: round2(base.x),
      y: round2(base.y + (sig - 0.5) * 1.6), // slight significance-based vertical relief
      z: round2(base.z),
    })
  })

  // ── 3. TRACKS — satellites near their parent artist (or genre) ──────────────
  // Positions are built at base (1.0×) scale, then every body is multiplied by
  // SPREAD_SCALE so the entire spiral inflates uniformly (shape identical).
  const newNodes = nodes.map((node) => {
    let position = node.position
    if (node.type === 'genre') {
      position = genreCenter.get(node.id) || node.position
    } else if (node.type === 'artist') {
      position = artistPos.get(node.id) || node.position
    } else if (node.type === 'track') {
      const direct = node.parentArtistId && artistPos.get(node.parentArtistId)
      const viaGenre = node.parentGenreId && genreCenter.get(node.parentGenreId)
      const hash = stableHash(node.id || node.label || 'track')
      const base = direct || viaGenre
        || armSpiralPosition(hash % ARM_COUNT, 0.3 + rand01(hash, 4) * 0.6, hash) // orphan → on an arm, not the core
      const r = 0.7 + (hash % 5) * 0.16
      const ang = seededAngle(hash, 0)
      position = {
        x: round2(base.x + Math.cos(ang) * r),
        y: round2(base.y + ((hash % 3) - 1) * 0.42),
        z: round2(base.z + Math.sin(ang) * r),
      }
    }
    return position ? { ...node, position: scaleSpread(position) } : node
  })

  // Region/cluster centroids are RE-DERIVED from the new (spiral) node positions
  // — averaging each region/cluster's member stars — so the nebula haze and
  // click-focus targets stay wrapped on the stars they belong to after the
  // re-lay. newNodes positions are already SPREAD_SCALE'd, so these centroids
  // land in the same scaled space. Regions match members by regionLabel, then
  // by anchorArtistIds; a region/cluster with no resolvable members falls back
  // to its scaled builder centroid (so there is never a worse-than-before case).
  const newRegions = Array.isArray(model.regions)
    ? model.regions.map((r) => {
        let members = newNodes.filter((n) => n.regionLabel != null && n.regionLabel === r.label)
        if (!members.length && Array.isArray(r.anchorArtistIds) && r.anchorArtistIds.length) {
          const ids = new Set(r.anchorArtistIds)
          members = newNodes.filter((n) => ids.has(n.id))
        }
        const centroid = averagePosition(members.map((n) => n.position))
        if (centroid) return { ...r, centroid }
        return r?.centroid ? { ...r, centroid: scaleSpread(r.centroid) } : r
      })
    : model.regions
  const newClusters = Array.isArray(model.clusters)
    ? model.clusters.map((c) => {
        const centroid = averagePosition(
          newNodes.filter((n) => n.clusterId != null && n.clusterId === c.id).map((n) => n.position))
        if (centroid) return { ...c, centroid }
        return c?.centroid ? { ...c, centroid: scaleSpread(c.centroid) } : c
      })
    : model.clusters

  return {
    ...model,
    nodes: newNodes,
    regions: newRegions,
    clusters: newClusters,
    metadata: { ...(model.metadata || {}), tierLayout: true },
  }
}
