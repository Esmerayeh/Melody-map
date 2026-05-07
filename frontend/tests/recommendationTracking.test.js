import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRecommendationEvent } from '../src/lib/recommendationTracking.js'

test('buildRecommendationEvent creates a valid recommendation payload', () => {
  const payload = buildRecommendationEvent({
    recommendationId: 'rec1',
    requestId: 'req1',
    sessionId: 'sess1',
    trackKey: 'track1',
    position: 0,
    surface: 'discover',
    modelVersion: 'ranker-v1',
  })
  assert.equal(payload.recommendation_id, 'rec1')
  assert.equal(payload.request_id, 'req1')
  assert.equal(payload.session_id, 'sess1')
  assert.equal(payload.track_key, 'track1')
  assert.equal(payload.candidate_source, 'ranker')
})
