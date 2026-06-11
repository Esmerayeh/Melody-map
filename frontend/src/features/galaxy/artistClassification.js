/**
 * artistClassification.js
 * -----------------------
 * Pure utility: apply short/long-term timeline classifications to a galaxy model.
 * No external imports — safe to use in Node test runner.
 */

/**
 * applyTimelineClassifications
 * ─────────────────────────────
 * Given a galaxy model and a timelines object from useArtistTimelines,
 * returns a new model with ghost/surge/anchor flags on artist nodes.
 *
 * @param {object}   model
 * @param {object}   timelines  { ghostIds: Set, surgeIds: Set, anchorIds: Set, basis: string }
 * @returns {object} new model with updated node roles
 */
export function applyTimelineClassifications(model, timelines = {}) {
  if (!model?.nodes) return model

  const { ghostIds = new Set(), surgeIds = new Set(), anchorIds = new Set(), basis = 'unknown' } = timelines

  const updatedNodes = model.nodes.map((node) => {
    if (node.type !== 'artist') return node

    // Normalise the key: strip "artist:" prefix, lowercase, hyphenate spaces
    const raw = (node.id || node.label || '')
    const key = raw.toLowerCase().replace(/^artist:/, '').replace(/\s+/g, '-')

    const isGhost  = ghostIds.has(key)  || ghostIds.has(raw)
    const isSurge  = surgeIds.has(key)  || surgeIds.has(raw)
    const isAnchor = anchorIds.has(key) || anchorIds.has(raw)

    if (!isGhost && !isSurge && !isAnchor) return node

    return {
      ...node,
      metrics: {
        ...node.metrics,
        isGhost:  isGhost,
        isSurge:  isSurge,
        isAnchor: isAnchor,
      },
      role: isGhost
        ? 'ghost-star'
        : isSurge
          ? 'surge-star'
          : isAnchor && (node.metrics?.significance ?? 0) > 0.6
            ? 'anchor-star'
            : node.role,
      timelineBasis: basis,
    }
  })

  return { ...model, nodes: updatedNodes }
}
