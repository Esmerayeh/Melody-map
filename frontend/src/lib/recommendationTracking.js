export function buildRecommendationEvent({
  recommendationId,
  requestId,
  sessionId,
  trackKey,
  position,
  surface,
  modelVersion,
  candidateSource,
  dwellMs,
  abandoned = false,
}) {
  return {
    recommendation_id: recommendationId,
    request_id: requestId,
    track_key: trackKey,
    position,
    surface,
    session_id: sessionId,
    model_version: modelVersion,
    candidate_source: candidateSource || (modelVersion?.includes('ranker') ? 'ranker' : modelVersion?.includes('retrieval') ? 'retrieval' : 'heuristic'),
    dwell_ms: dwellMs ?? null,
    abandoned,
  }
}
