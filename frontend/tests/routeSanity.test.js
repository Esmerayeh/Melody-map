import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { useRouteReadiness } from '../src/hooks/useRouteReadiness.js'
import {
  normalizeProfileResponse,
  normalizeAestheticResponse,
  normalizeAnalyticsResponse,
  normalizeSoulmateResponse,
} from '../src/services/dataAdapters.js'
import { computeMBTIDetails } from '../src/utils/personalityEngine.js'
import { clearSpotifyStorage } from '../src/services/spotifySession.js'

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

test('MBTI returns null when signal is below minimum thresholds', () => {
  const profile = {
    audioFeatures: { acousticness: 0.4, danceability: 0.5, instrumentalness: 0.1, valence: 0.6 },
    genres: ['indie'],
    topArtists: [{ popularity: 40 }],
  }
  const result = computeMBTIDetails(profile)
  assert.equal(result.value, null)
  assert.ok(result.missingInputs.includes('genres_min'))
  assert.ok(result.missingInputs.includes('topArtists_min'))
})

test('clearSpotifyStorage removes provider keys safely', () => {
  const store = {}
  global.window = {
    localStorage: {
      setItem: (k, v) => { store[k] = v },
      getItem: (k) => store[k] ?? null,
      removeItem: (k) => { delete store[k] },
    },
  }
  window.localStorage.setItem('spotify_token', 'token')
  window.localStorage.setItem('spotify_refresh_token', 'refresh')
  window.localStorage.setItem('spotify_token_expiry', '123')
  clearSpotifyStorage()
  assert.equal(window.localStorage.getItem('spotify_token'), null)
  assert.equal(window.localStorage.getItem('spotify_refresh_token'), null)
  assert.equal(window.localStorage.getItem('spotify_token_expiry'), null)
})

test('public profile comparison identifier normalizer keeps safe slug', () => {
  const input = 'https://melodymap.site/soulmate/echo-veil'
  const trimmed = String(input || '').trim()
  let value = ''
  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/soulmate\/([^/?#]+)/i)
    value = decodeURIComponent(pathMatch?.[1] || '').trim()
  } catch {
    value = trimmed.replace(/^\/?soulmate\//i, '').trim()
  }
  assert.equal(value, 'echo-veil')
})

test('Spotify callback source reads only auth_code and clears query params', () => {
  const source = fs.readFileSync(path.resolve('src/pages/SpotifySuccess.jsx'), 'utf8')
  assert.match(source, /params\.get\('auth_code'\)/)
  assert.doesNotMatch(source, /params\.get\('token'\)/)
  assert.doesNotMatch(source, /params\.get\('refresh_token'\)/)
  assert.match(source, /window\.history\.replaceState\(\{\}, '', window\.location\.pathname\)/)
})

test('Last.fm callback source reads only auth_code and clears query params', () => {
  const source = fs.readFileSync(path.resolve('src/pages/LastfmSuccess.jsx'), 'utf8')
  assert.match(source, /params\.get\('auth_code'\)/)
  assert.doesNotMatch(source, /params\.get\('session'\)/)
  assert.match(source, /window\.history\.replaceState\(\{\}, '', window\.location\.pathname\)/)
})
