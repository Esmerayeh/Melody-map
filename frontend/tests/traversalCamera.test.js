/**
 * Defensive bounds test for the galaxy fly-through camera. The interactive feel
 * can only be judged live, but the soft-bound math (the safety rail that stops
 * the user flying off into the void) is pure and must hold: zero pull inside
 * the volume, ramping to full pull at the edge, monotonic, clamped to 1.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { softBoundEase } from '../src/features/galaxy/useTraversalCamera.js'

test('no pull while inside the bounded volume', () => {
  assert.equal(softBoundEase(0, 40, 54), 0)
  assert.equal(softBoundEase(40, 40, 54), 0)
  assert.equal(softBoundEase(39.9, 40, 54), 0)
})

test('pull ramps from 0 to 1 across the soft band', () => {
  assert.ok(softBoundEase(47, 40, 54) > 0 && softBoundEase(47, 40, 54) < 1)
  assert.equal(softBoundEase(54, 40, 54), 1)
})

test('pull is clamped to 1 past the max radius (never overshoots)', () => {
  assert.equal(softBoundEase(80, 40, 54), 1)
  assert.equal(softBoundEase(1000, 40, 54), 1)
})

test('pull is monotonic increasing across the band', () => {
  let prev = -1
  for (let d = 40; d <= 54; d += 1) {
    const v = softBoundEase(d, 40, 54)
    assert.ok(v >= prev, `softBoundEase must not decrease at d=${d}`)
    prev = v
  }
})

test('default soft band engages before the absolute edge', () => {
  // With defaults (SOFT_START 160 .. MAX_RADIUS 200, sized to the SPREAD_SCALE
  // galaxy), a camera at 180 units is being eased back but not maxed.
  const v = softBoundEase(180)
  assert.ok(v > 0 && v < 1)
})
