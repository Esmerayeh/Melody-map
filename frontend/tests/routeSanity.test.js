import test from 'node:test'
import assert from 'node:assert/strict'
import { useRouteReadiness } from '../src/hooks/useRouteReadiness.js'
import {
  normalizeProfileResponse,
  normalizeAestheticResponse,
  normalizeAnalyticsResponse,
  normalizeSoulmateResponse,
} from '../src/services/dataAdapters.js'

test('useRouteReadiness blocks on loading and missing profile', () => {
  const result = useRouteReadiness({ phase: 'loading', profile: null, readiness: {}, tier: 'limited' })
  assert.equal(result.blocked, true)
  assert.equal(result.variant, 'loading')
})

test('useRouteReadiness blocks when required readiness is missing', () => {
  const result = useRouteReadiness({
    phase: 'ready',
    profile: { id: 'x' },
    readiness: { identity: false },
    tier: 'medium',
    require: { identity: true },
  })
  assert.equal(result.blocked, true)
  assert.equal(result.variant, 'partial')
})

test('normalizeProfileResponse respects backend envelope', () => {
  const payload = {
    success: true,
    data: {
      topArtists: [],
      topTracks: [],
      genres: [],
      audioFeatures: {},
      dataQuality: { hasAudioProfile: false },
      confidence: { overall: 0.4 },
      profileTier: 'sparse',
    },
    confidence: { overall: 0.4 },
    dataQuality: { hasAudioProfile: false },
    profileTier: 'sparse',
  }
  const normalized = normalizeProfileResponse(payload, 'spotify')
  assert.equal(normalized.status, 'partial')
  assert.ok(normalized.data)
  assert.equal(normalized.profileTier, 'sparse')
})

test('normalizeAestheticResponse keeps sparse signal when limitedSignal is true', () => {
  const payload = { success: true, data: { palette: [] }, limitedSignal: true }
  const normalized = normalizeAestheticResponse(payload)
  assert.equal(normalized.status, 'sparse')
})

test('normalizeAnalyticsResponse stays sparse when limitedSignal is true', () => {
  const payload = { success: true, data: { analyticsMetrics: null }, limitedSignal: true }
  const normalized = normalizeAnalyticsResponse(payload)
  assert.equal(normalized.status, 'sparse')
})

test('normalizeSoulmateResponse marks ready when score exists', () => {
  const payload = { success: true, data: { overallCompatibility: 72 } }
  const normalized = normalizeSoulmateResponse(payload)
  assert.equal(normalized.status, 'ready')
})
