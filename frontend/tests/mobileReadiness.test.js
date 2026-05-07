import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRecommendationEvent } from '../src/lib/recommendationTracking.js'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(TEST_DIR, '../src')

test('recommendation tracking preserves backend-issued tracing fields', () => {
  const payload = buildRecommendationEvent({
    recommendationId: 'req-1:track-1:0',
    requestId: 'req-1',
    sessionId: 'session-1',
    trackKey: 'track-1',
    position: 0,
    surface: 'discover',
    modelVersion: 'retrieval-ranker-v1',
    candidateSource: 'ranker',
  })

  assert.equal(payload.request_id, 'req-1')
  assert.equal(payload.session_id, 'session-1')
  assert.equal(payload.model_version, 'retrieval-ranker-v1')
  assert.equal(payload.candidate_source, 'ranker')
})

test('recommendation tracking does not fabricate session ids', () => {
  const payload = buildRecommendationEvent({
    recommendationId: 'req-1:track-1:0',
    requestId: 'req-1',
    sessionId: undefined,
    trackKey: 'track-1',
    position: 0,
    surface: 'discover',
    modelVersion: 'heuristic-v1',
  })

  assert.equal(payload.session_id, undefined)
})

test('primary mobile entry points point to the social soulmates route', () => {
  const files = [
    path.join(ROOT, 'pages', 'Dashboard.jsx'),
    path.join(ROOT, 'pages', 'Profile.jsx'),
    path.join(ROOT, 'components', 'BottomNav.jsx'),
    path.join(ROOT, 'components', 'TopBar.jsx'),
  ]

  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /\/soulmates/)
  })
})
