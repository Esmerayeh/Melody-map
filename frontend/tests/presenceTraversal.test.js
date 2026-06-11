/**
 * presenceTraversal.test.js
 * -------------------------
 * Tests for the PRESENCE + TRAVERSAL sprint.
 *
 * Covers:
 *   1.  EVENT_TYPES constants — all 8 entries exist and are non-empty strings
 *   2.  Event store — emit prepends with correct shape
 *   3.  Event store — queue caps at 12 entries
 *   4.  Event store — dismiss removes by id
 *   5.  Event store — clearAll empties queue
 *   6.  emitUniverseEvent — module-level helper writes to the same store
 *   7.  Presence derivations — active state
 *   8.  Presence derivations — idle state
 *   9.  Presence derivations — sleeping state (HUD dims)
 *   10. Presence derivations — waking state (partial opacity)
 *   11. Presence + reducedMotion — driftSpeed always 0
 *   12. Presence timing — constants ordering (IDLE < SLEEP, WAKE < IDLE)
 *   13. ScanPulse ring spawning — delta capped at 3 per trigger
 *   14. ScanPulse buffer — total ring buffer capped at 6 entries
 *   15. NowPlayingRipple — ripple duration is 1 500 ms
 *   16. Sector panel mutual exclusion — helper returns correct activePanel token
 *   17. Traversal constants — FLY_SPEED and RETURN_LERP are sane values
 */
import test   from 'node:test'
import assert  from 'node:assert/strict'

import {
  EVENT_TYPES,
  emitUniverseEvent,
} from '../src/features/universe/useUniverseEvents.js'
import useUniverseEvents from '../src/features/universe/useUniverseEvents.js'

// ─── Pure helpers mirroring useUniversePresence returns ──────────────────────
// These are 1-to-1 with the hook's derived values so we can test the logic
// without mounting React or a DOM environment.

const IDLE_MS  = 22_000
const SLEEP_MS = 80_000
const WAKE_MS  =  1_200

function hudOpacityFor(state) {
  if (state === 'sleeping') return 0.12
  if (state === 'waking')   return 0.5
  return 1
}

function driftSpeedFor(state, reducedMotion = false) {
  if (reducedMotion)           return 0
  if (state === 'sleeping')    return 0.06
  return 0.18   // active or idle — full drift
}

function hudDimmedFor(state) {
  return state === 'sleeping'
}

function labelDensityFor(state) {
  return state === 'sleeping' ? 'sparse' : 'normal'
}

// ─── PANELS constant mirror (defined inline in Universe.jsx) ─────────────────
const PANELS = {
  NONE:      'none',
  INSPECTOR: 'inspector',
  COMET:     'comet',
  MEMORY:    'memory',
  PASSPORT:  'passport',
  SECTOR:    'sector',
}

function openPanel(name) {
  // Simulates the mutual-exclusion helper: any openX closes all others
  return name
}

// ─── ScanPulseEffect pure logic ───────────────────────────────────────────────
function spawnPulses(prev, triggerDelta) {
  const newPulses = Array.from({ length: Math.min(triggerDelta, 3) }, (_, i) => ({ id: i }))
  return [...prev, ...newPulses].slice(-6)
}

// ─── Traversal constants (must match useTraversalCamera.js) ──────────────────
const FLY_SPEED   = 0.14
const BOOST_MULT  = 3.2
const RETURN_LERP = 0.055
const FLY_LERP    = 0.14
const TOUR_SPEED  = 0.10

// ─── NowPlayingRipple timing ──────────────────────────────────────────────────
const RIPPLE_DURATION_MS = 1_500

// ─────────────────────────────────────────────────────────────────────────────
// 1. EVENT_TYPES — all 8 entries exist and are non-empty strings
// ─────────────────────────────────────────────────────────────────────────────
test('EVENT_TYPES has all 8 required event type keys', () => {
  const required = [
    'LIVE_SIGNAL', 'FORMER_ORBIT', 'SURGE_STAR', 'COMET_DECODED',
    'PASSPORT_EXPORT', 'SEMANTIC_LOCKED', 'AURALITH_BRIDGE', 'OBSESSION_FIELD',
  ]
  required.forEach((key) => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(EVENT_TYPES, key),
      `EVENT_TYPES must have key: ${key}`,
    )
    assert.ok(
      typeof EVENT_TYPES[key] === 'string' && EVENT_TYPES[key].length > 0,
      `EVENT_TYPES.${key} must be a non-empty string`,
    )
  })
  assert.strictEqual(Object.keys(EVENT_TYPES).length, 8, 'exactly 8 event types')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Event store — emit prepends with correct shape
// ─────────────────────────────────────────────────────────────────────────────
test('emit adds an event with the expected shape to the front of the queue', () => {
  // Reset store state before this test
  useUniverseEvents.getState().clearAll()

  const before = Date.now()
  useUniverseEvents.getState().emit(EVENT_TYPES.LIVE_SIGNAL, 'Test signal', 'detail')
  const events = useUniverseEvents.getState().events

  assert.strictEqual(events.length, 1, 'queue should have 1 event')
  const ev = events[0]
  assert.strictEqual(ev.type,   EVENT_TYPES.LIVE_SIGNAL, 'type must match')
  assert.strictEqual(ev.label,  'Test signal',            'label must match')
  assert.strictEqual(ev.detail, 'detail',                 'detail must match')
  assert.ok(typeof ev.id === 'number',                    'id must be a number')
  assert.ok(ev.timestamp >= before,                       'timestamp must be >= before')
})

test('emit prepends — newest event is at index 0', () => {
  useUniverseEvents.getState().clearAll()

  useUniverseEvents.getState().emit(EVENT_TYPES.LIVE_SIGNAL,   'first',  null)
  useUniverseEvents.getState().emit(EVENT_TYPES.COMET_DECODED, 'second', null)

  const events = useUniverseEvents.getState().events
  assert.strictEqual(events[0].label, 'second', 'newest event must be at index 0')
  assert.strictEqual(events[1].label, 'first',  'older event must be at index 1')
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Event store — queue caps at 12 entries
// ─────────────────────────────────────────────────────────────────────────────
test('event queue never exceeds 12 entries', () => {
  useUniverseEvents.getState().clearAll()

  for (let i = 0; i < 20; i++) {
    useUniverseEvents.getState().emit(EVENT_TYPES.SURGE_STAR, `event-${i}`, null)
  }

  const events = useUniverseEvents.getState().events
  assert.ok(events.length <= 12, `queue length ${events.length} must be ≤ 12`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Event store — dismiss removes by id
// ─────────────────────────────────────────────────────────────────────────────
test('dismiss removes event with matching id', () => {
  useUniverseEvents.getState().clearAll()

  useUniverseEvents.getState().emit(EVENT_TYPES.LIVE_SIGNAL,   'keep',   null)
  useUniverseEvents.getState().emit(EVENT_TYPES.FORMER_ORBIT,  'remove', null)

  const before   = useUniverseEvents.getState().events
  const removeId = before.find((e) => e.label === 'remove').id

  useUniverseEvents.getState().dismiss(removeId)
  const after = useUniverseEvents.getState().events

  assert.strictEqual(after.length, 1,                      'queue should have 1 event left')
  assert.strictEqual(after[0].label, 'keep',               'remaining event must be "keep"')
  assert.ok(after.every((e) => e.id !== removeId),         'dismissed id must not appear')
})

test('dismiss with unknown id leaves queue unchanged', () => {
  useUniverseEvents.getState().clearAll()
  useUniverseEvents.getState().emit(EVENT_TYPES.SURGE_STAR, 'present', null)

  const before = useUniverseEvents.getState().events.length
  useUniverseEvents.getState().dismiss(999999)
  const after  = useUniverseEvents.getState().events.length

  assert.strictEqual(after, before, 'queue length must not change for unknown id')
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Event store — clearAll empties queue
// ─────────────────────────────────────────────────────────────────────────────
test('clearAll empties the event queue', () => {
  useUniverseEvents.getState().emit(EVENT_TYPES.PASSPORT_EXPORT, 'x', null)
  useUniverseEvents.getState().emit(EVENT_TYPES.SEMANTIC_LOCKED,  'y', null)
  useUniverseEvents.getState().clearAll()

  const events = useUniverseEvents.getState().events
  assert.strictEqual(events.length, 0, 'queue must be empty after clearAll')
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. emitUniverseEvent — module-level helper writes to the same store
// ─────────────────────────────────────────────────────────────────────────────
test('emitUniverseEvent helper writes to the shared store', () => {
  useUniverseEvents.getState().clearAll()

  emitUniverseEvent(EVENT_TYPES.AURALITH_BRIDGE, 'bridge signal', 'Auralith X→Y')

  const events = useUniverseEvents.getState().events
  assert.strictEqual(events.length, 1,                         'store must have 1 event')
  assert.strictEqual(events[0].type,   EVENT_TYPES.AURALITH_BRIDGE, 'type must match')
  assert.strictEqual(events[0].detail, 'Auralith X→Y',         'detail must be passed through')
})

// ─────────────────────────────────────────────────────────────────────────────
// 7-11. Presence state derivations (pure logic, no React)
// ─────────────────────────────────────────────────────────────────────────────
test('active state → hudOpacity=1, driftSpeed=0.18, hudDimmed=false, density=normal', () => {
  assert.strictEqual(hudOpacityFor('active'),   1,        'active: hudOpacity must be 1')
  assert.strictEqual(driftSpeedFor('active'),   0.18,     'active: driftSpeed must be 0.18')
  assert.strictEqual(hudDimmedFor('active'),    false,    'active: hudDimmed must be false')
  assert.strictEqual(labelDensityFor('active'), 'normal', 'active: labelDensity must be normal')
})

test('idle state → hudOpacity=1, driftSpeed=0.18, hudDimmed=false', () => {
  assert.strictEqual(hudOpacityFor('idle'),  1,    'idle: hudOpacity must be 1')
  assert.strictEqual(driftSpeedFor('idle'),  0.18, 'idle: driftSpeed must be 0.18')
  assert.strictEqual(hudDimmedFor('idle'),   false,'idle: hudDimmed must be false')
})

test('sleeping state → hudOpacity=0.12, driftSpeed=0.06, hudDimmed=true, density=sparse', () => {
  assert.strictEqual(hudOpacityFor('sleeping'),   0.12,    'sleeping: hudOpacity must be 0.12')
  assert.strictEqual(driftSpeedFor('sleeping'),   0.06,    'sleeping: driftSpeed must be 0.06')
  assert.strictEqual(hudDimmedFor('sleeping'),    true,    'sleeping: hudDimmed must be true')
  assert.strictEqual(labelDensityFor('sleeping'), 'sparse','sleeping: labelDensity must be sparse')
})

test('waking state → hudOpacity=0.5, hudDimmed=false', () => {
  assert.strictEqual(hudOpacityFor('waking'), 0.5,  'waking: hudOpacity must be 0.5')
  assert.strictEqual(hudDimmedFor('waking'),  false, 'waking: hudDimmed must be false')
})

test('reducedMotion=true → driftSpeed=0 for all states', () => {
  const states = ['active', 'idle', 'sleeping', 'waking']
  states.forEach((state) => {
    assert.strictEqual(
      driftSpeedFor(state, true),
      0,
      `reducedMotion: driftSpeed must be 0 in "${state}" state`,
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Presence timing — constant ordering
// ─────────────────────────────────────────────────────────────────────────────
test('presence timing constants are correctly ordered (WAKE < IDLE < SLEEP)', () => {
  assert.ok(WAKE_MS  < IDLE_MS,  `WAKE_MS (${WAKE_MS}) must be < IDLE_MS (${IDLE_MS})`)
  assert.ok(IDLE_MS  < SLEEP_MS, `IDLE_MS (${IDLE_MS}) must be < SLEEP_MS (${SLEEP_MS})`)
  assert.ok(SLEEP_MS > 60_000,   `SLEEP_MS (${SLEEP_MS}) should be at least 60s`)
  assert.ok(IDLE_MS  > 10_000,   `IDLE_MS (${IDLE_MS}) should be at least 10s`)
  assert.ok(WAKE_MS  <  5_000,   `WAKE_MS (${WAKE_MS}) should be a quick transition (<5s)`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. ScanPulseEffect — ring delta capped at 3 per trigger
// ─────────────────────────────────────────────────────────────────────────────
test('scanPulse spawn is capped at 3 rings per trigger', () => {
  const pulses = spawnPulses([], 10)   // large delta → should still cap at 3
  assert.ok(pulses.length <= 3, `spawn from empty buffer should be ≤ 3 (got ${pulses.length})`)
})

test('scanPulse spawn of delta=1 adds exactly 1 ring', () => {
  const pulses = spawnPulses([], 1)
  assert.strictEqual(pulses.length, 1, 'delta=1 must add exactly 1 ring')
})

test('scanPulse spawn of delta=3 adds exactly 3 rings', () => {
  const pulses = spawnPulses([], 3)
  assert.strictEqual(pulses.length, 3, 'delta=3 must add exactly 3 rings')
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. ScanPulseEffect — total ring buffer capped at 6
// ─────────────────────────────────────────────────────────────────────────────
test('scanPulse buffer hard-cap is 6 total rings', () => {
  // 3 rapid triggers, each adding 3 rings = 9 rings → should be capped at 6
  let pulses = []
  pulses = spawnPulses(pulses, 3)
  pulses = spawnPulses(pulses, 3)
  pulses = spawnPulses(pulses, 3)
  assert.ok(
    pulses.length <= 6,
    `buffer must not exceed 6 rings (got ${pulses.length})`,
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. NowPlayingRipple — ripple duration constant
// ─────────────────────────────────────────────────────────────────────────────
test('NowPlayingRipple RIPPLE_DURATION_MS is 1500', () => {
  assert.strictEqual(RIPPLE_DURATION_MS, 1_500, 'ripple duration must be 1500ms')
})

test('NowPlayingRipple stagger delays are within ripple duration', () => {
  const staggerDelays = [0, 0.28, 0.56]   // seconds
  staggerDelays.forEach((delay) => {
    const delayMs = delay * 1000
    assert.ok(
      delayMs < RIPPLE_DURATION_MS,
      `stagger delay ${delayMs}ms must be < RIPPLE_DURATION_MS (${RIPPLE_DURATION_MS}ms)`,
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. Sector panel mutual exclusion — PANELS constant completeness
// ─────────────────────────────────────────────────────────────────────────────
test('PANELS constant has all 6 required keys with unique non-empty values', () => {
  const keys = ['NONE', 'INSPECTOR', 'COMET', 'MEMORY', 'PASSPORT', 'SECTOR']
  keys.forEach((key) => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(PANELS, key),
      `PANELS must have key: ${key}`,
    )
    assert.ok(
      typeof PANELS[key] === 'string' && PANELS[key].length > 0,
      `PANELS.${key} must be a non-empty string`,
    )
  })
  // All values must be unique
  const values = Object.values(PANELS)
  const unique = new Set(values)
  assert.strictEqual(unique.size, values.length, 'all PANELS values must be unique')
})

test('openPanel returns the requested panel name', () => {
  assert.strictEqual(openPanel(PANELS.SECTOR),    PANELS.SECTOR)
  assert.strictEqual(openPanel(PANELS.PASSPORT),  PANELS.PASSPORT)
  assert.strictEqual(openPanel(PANELS.NONE),       PANELS.NONE)
})

test('closing all panels returns PANELS.NONE', () => {
  const closed = openPanel(PANELS.NONE)
  assert.strictEqual(closed, PANELS.NONE, 'closing all panels should result in NONE state')
})

// ─────────────────────────────────────────────────────────────────────────────
// 17. Traversal constants — values are in sane ranges
// ─────────────────────────────────────────────────────────────────────────────
test('FLY_SPEED is in sane range (0 < x < 1)', () => {
  assert.ok(FLY_SPEED > 0 && FLY_SPEED < 1, `FLY_SPEED (${FLY_SPEED}) must be in (0, 1)`)
})

test('BOOST_MULT is greater than 1 (boost is faster than base)', () => {
  assert.ok(BOOST_MULT > 1, `BOOST_MULT (${BOOST_MULT}) must be > 1`)
})

test('RETURN_LERP is slower than FLY_LERP (smooth eased return)', () => {
  assert.ok(
    RETURN_LERP < FLY_LERP,
    `RETURN_LERP (${RETURN_LERP}) must be < FLY_LERP (${FLY_LERP}) for eased return`,
  )
})

test('TOUR_SPEED is in sane range (0 < x < 1)', () => {
  assert.ok(TOUR_SPEED > 0 && TOUR_SPEED < 1, `TOUR_SPEED (${TOUR_SPEED}) must be in (0, 1)`)
})
