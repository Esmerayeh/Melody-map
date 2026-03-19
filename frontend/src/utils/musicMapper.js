/**
 * musicMapper.js — Sonic Identity mapping utilities
 *
 * Converts Spotify audio_features into deterministic 3D coordinates and
 * perceptually-meaningful HSL colors so the Galaxy reflects the actual
 * emotional character of each track.
 *
 * Coordinate system
 * ─────────────────
 *   x  =  valence      (0 = sad/dark  →  1 = happy/bright)   horizontal axis
 *   y  =  energy       (0 = calm/low  →  1 = intense/high)   vertical axis
 *   z  =  danceability (0 = static    →  1 = groovy)         depth axis
 *
 * The raw 0-1 values are scaled to a [-SPREAD, +SPREAD] world-space range
 * so the galaxy fills the scene nicely.
 *
 * Color synthesis
 * ───────────────
 *   Hue        = valence × 260  (blues/purples at 0 → yellows/oranges at 260)
 *   Saturation = 55 + energy × 30  (low-energy tracks are slightly desaturated)
 *   Lightness  = 42 + valence × 18 (sad tracks are darker, happy ones brighter)
 *
 * This produces an intuitive color-coded galaxy:
 *   Melancholic + calm   → deep indigo / slate blue
 *   Melancholic + intense → electric violet / magenta
 *   Happy + calm         → warm amber / gold
 *   Happy + intense      → bright yellow / citrus orange
 */

// World-space spread: tracks are placed in a [-SPREAD, +SPREAD]³ cube
const SPREAD = 10

/**
 * Map a single track's audio features to a 3D position.
 *
 * @param {{ energy?: number, valence?: number, danceability?: number }} features
 * @param {{ popularity?: number }} track  — used to add a small popularity jitter
 *        so tracks with identical features don't perfectly overlap
 * @returns {{ x: number, y: number, z: number }}
 */
export function sonicCoords(features = {}, track = {}) {
  const valence      = features.valence      ?? 0.5
  const energy       = features.energy       ?? 0.5
  const danceability = features.danceability ?? 0.5

  // Center around 0 by mapping [0,1] → [-SPREAD, +SPREAD]
  const x = (valence      - 0.5) * 2 * SPREAD
  const y = (energy       - 0.5) * 2 * SPREAD
  const z = (danceability - 0.5) * 2 * SPREAD

  // Tiny popularity-seeded jitter so co-located tracks don't z-fight
  const pop    = (track.popularity ?? 50) / 100
  const jitter = (pop - 0.5) * 0.6   // ±0.3 units max

  return { x: x + jitter, y: y + jitter * 0.5, z: z - jitter * 0.3 }
}

/**
 * Derive an HSL color string from valence + energy.
 *
 * @param {{ energy?: number, valence?: number }} features
 * @returns {string}  e.g. "hsl(220, 72%, 48%)"
 */
export function sonicColor(features = {}) {
  const valence = features.valence ?? 0.5
  const energy  = features.energy  ?? 0.5

  // Hue: 240 (blue) at valence=0 → 0/360 (red-orange) at valence=1
  // We stop at 60 (yellow) to avoid looping back into reds for happy tracks
  const hue        = Math.round(valence * 260)
  const saturation = Math.round(55 + energy * 30)
  const lightness  = Math.round(42 + valence * 18)

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Assign a quadrant cluster ID (0-3) based on energy + valence.
 * Used for the ClusterExplainer tooltip and edge grouping.
 *
 *   0 = Low-Energy  / Melancholic  (calm, dark)
 *   1 = Low-Energy  / Euphoric     (calm, bright)
 *   2 = High-Energy / Melancholic  (intense, dark)
 *   3 = High-Energy / Euphoric     (intense, bright)
 *
 * @param {{ energy?: number, valence?: number }} features
 * @returns {0|1|2|3}
 */
export function sonicCluster(features = {}) {
  const energy  = features.energy  ?? 0.5
  const valence = features.valence ?? 0.5
  return (energy > 0.5 ? 2 : 0) + (valence > 0.5 ? 1 : 0)
}

/**
 * Full Sonic Identity for a track — convenience wrapper.
 *
 * @param {object} track   — raw track object from musicService
 * @param {object} features — audio_features from Spotify (may be partial)
 * @returns {object}  track enriched with map_coords_3d, sonic_color, cluster_id
 */
/**
 * Build a graph structure { nodes, edges } from galaxyNodes array.
 * galaxyNodes come from the backend music_profile_builder and already
 * contain a `connections` array of target node IDs.
 *
 * @param {Array} galaxyNodes — nodes from musicProfile.galaxyNodes
 * @returns {{ nodes: Array, edges: Array }}
 */
export function buildGalaxyGraph(galaxyNodes = []) {
  const seen = new Set()
  const edges = []

  for (const node of galaxyNodes) {
    for (const targetId of (node.connections || [])) {
      // Deduplicate edges using a canonical key (smaller id first)
      const key = [node.id, targetId].sort().join('--')
      if (!seen.has(key)) {
        seen.add(key)
        edges.push({ id: key, source: node.id, target: targetId })
      }
    }
  }

  return { nodes: galaxyNodes, edges }
}

export function buildSonicIdentity(track, features = {}) {
  const f = {
    energy:       features.energy       ?? (track.popularity ? track.popularity / 100 : 0.5),
    valence:      features.valence      ?? 0.5,
    danceability: features.danceability ?? 0.5,
    tempo:        features.tempo        ?? 120,
  }

  return {
    _id:           track.id,
    title:         track.title,
    artist:        track.artist,
    album_art:     track.album_art,
    spotify_url:   track.spotify_url || track.lastfm_url,
    popularity:    track.popularity,
    cluster_id:    sonicCluster(f),
    map_coords_3d: sonicCoords(f, track),
    sonic_color:   sonicColor(f),
    audio_features: f,
  }
}
