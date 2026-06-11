/**
 * obsessionScore.js
 * -----------------
 * Computes an honest obsession score for a given artist based on
 * whatever data is available.
 *
 * Priority chain (12-data-to-visual-metaphor):
 *   1. lastfm_playcount    — artist.playcount from Last.fm API (real play count)
 *   2. listening_events    — frequency in recent listening event stream
 *   3. short_term_dominance — artist appears in short_term and has high rank
 *   4. fallback_significance — artist significance score (label: "Core Gravity", not "Obsession")
 *
 * The basis string is surfaced in the UI so users and developers can see
 * exactly what the obsession score is computed from.
 */

/**
 * computeObsessionScore
 * ---------------------
 * @param {object} artist     - artist node from the galaxy model
 * @param {object} options
 * @param {boolean} options.isLastfm              - profile is from Last.fm
 * @param {number}  [options.playcountMax]         - max playcount in the artist list (for normalisation)
 * @param {Set}     [options.surgeIds]             - Set of short_term-only artist keys
 * @param {number}  [options.shortTermRankNorm]    - normalised position in short_term list (0=first,1=last)
 *
 * @returns {{ score: number, basis: string }}
 */
export function computeObsessionScore(artist, options = {}) {
  const { isLastfm = false, playcountMax = 1, surgeIds = new Set(), shortTermRankNorm = null } = options

  const key = (artist?.id || artist?.label || '').toLowerCase().replace(/^artist:/, '').replace(/\s+/g, '-')

  // ── 1. Last.fm playcount (most honest signal) ─────────────────────────────
  const playcount = artist?.playcount ?? artist?.metrics?.playcount ?? null
  if (isLastfm && typeof playcount === 'number' && playcount > 0 && playcountMax > 0) {
    const score = Math.min(1, playcount / playcountMax)
    return { score: +score.toFixed(3), basis: 'lastfm_playcount' }
  }

  // ── 2. Listening event frequency (if available in metrics) ────────────────
  const eventFreq = artist?.metrics?.listeningFrequency ?? null
  if (typeof eventFreq === 'number' && eventFreq > 0) {
    return { score: +Math.min(1, eventFreq).toFixed(3), basis: 'listening_events' }
  }

  // ── 3. Short-term dominance (surge artist + high rank) ───────────────────
  const isSurge = surgeIds.has(key) || artist?.metrics?.isSurge
  if (isSurge && shortTermRankNorm !== null) {
    // shortTermRankNorm: 0 = top of list (most played), 1 = bottom
    const score = Math.max(0.5, 1.0 - shortTermRankNorm * 0.5)
    return { score: +score.toFixed(3), basis: 'short_term_dominance' }
  }
  if (isSurge) {
    return { score: 0.7, basis: 'short_term_dominance' }
  }

  // ── 4. Fallback: significance only ────────────────────────────────────────
  //    Label as "core-anchor" or "core-gravity" in the UI — never "obsession"
  const sig = artist?.metrics?.significance ?? artist?.significance ?? 0.5
  return { score: +Math.min(1, sig).toFixed(3), basis: 'fallback_significance' }
}

/**
 * findObsessionNode
 * -----------------
 * Selects the best obsession candidate from an array of artist nodes.
 * Returns the node along with its computed obsession score.
 *
 * @param {object[]} artistNodes   - artist-type galaxy nodes
 * @param {object}   options       - same as computeObsessionScore options
 * @returns {{ node, score, basis } | null}
 */
export function findObsessionNode(artistNodes = [], options = {}) {
  if (!artistNodes.length) return null

  const { isLastfm = false } = options

  // If Last.fm: normalise by max playcount
  let playcountMax = 1
  if (isLastfm) {
    playcountMax = Math.max(
      1,
      ...artistNodes.map((n) => n?.playcount ?? n?.metrics?.playcount ?? 0),
    )
  }

  const scored = artistNodes.map((node) => {
    const { score, basis } = computeObsessionScore(node, { ...options, playcountMax })
    return { node, score, basis }
  })

  // Sort by score descending; prefer real data bases over fallback
  scored.sort((a, b) => {
    const basisRank = { lastfm_playcount: 4, listening_events: 3, short_term_dominance: 2, fallback_significance: 1 }
    const ra = basisRank[a.basis] || 0
    const rb = basisRank[b.basis] || 0
    if (ra !== rb) return rb - ra
    return b.score - a.score
  })

  return scored[0] || null
}

/**
 * labelForBasis
 * -------------
 * Returns the HUD label for each obsession basis.
 * Uses "Obsession Field" only when we have real play data.
 */
export function labelForBasis(basis) {
  switch (basis) {
    case 'lastfm_playcount':      return 'Obsession Field'
    case 'listening_events':      return 'Obsession Field'
    case 'short_term_dominance':  return 'Surge Gravity'
    case 'fallback_significance': return 'Core Gravity Field'
    default:                      return 'Core Gravity Field'
  }
}

/**
 * descriptionForBasis
 * -------------------
 * Returns the body text shown in the Auralith panel below the well.
 */
export function descriptionForBasis(basis, artistName = 'this artist') {
  switch (basis) {
    case 'lastfm_playcount':
      return `${artistName} appears more than any other artist in your Last.fm history. This is real play data, not a guess.`
    case 'listening_events':
      return `${artistName} shows the highest listening frequency in your recent event stream.`
    case 'short_term_dominance':
      return `${artistName} entered your orbit recently and has dominated short-term listening. The field is forming.`
    case 'fallback_significance':
    default:
      return `${artistName} sits at the centre of your galaxy by significance. Deeper obsession tracking requires more listening history.`
  }
}
