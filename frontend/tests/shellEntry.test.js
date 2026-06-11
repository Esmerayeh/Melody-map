/**
 * Lockout-proofing for the protected-shell entry decision.
 *
 * Regression context: commit 5554732 made entry depend on a LIVE bootstrap
 * answer; against a cold-started backend the probe hung, the gate had no
 * timeout, and the user was locked behind "Reload the shell" forever. These
 * tests assert the cold-load state machine terminates in 'enter' or 'login'
 * for EVERY combination of inputs — the gate is only ever a brief, first-ever
 * visitor state.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { PROBE_GATE_MAX_MS, resolveShellEntry } from '../src/app/shellEntry.js'

const ALL_PHASES = [
  'booting', 'probing_session', 'oauth_exchanging', 'profile_hydrating',
  'session_restoring', 'session_ready', 'login_ready', 'no_session', 'error',
]

test('live auth evidence always enters, regardless of phase or timing', () => {
  for (const bootPhase of ALL_PHASES) {
    for (const probeElapsedMs of [0, PROBE_GATE_MAX_MS + 1]) {
      assert.equal(
        resolveShellEntry({ canAccessShell: true, hadRecentSession: false, bootPhase, probeElapsedMs }),
        'enter',
        `canAccessShell must win for phase=${bootPhase}`,
      )
    }
  }
})

test('a returning user (recent-session evidence) NEVER sees the gate', () => {
  for (const bootPhase of ALL_PHASES) {
    for (const probeElapsedMs of [0, PROBE_GATE_MAX_MS + 1]) {
      const entry = resolveShellEntry({ canAccessShell: false, hadRecentSession: true, bootPhase, probeElapsedMs })
      assert.notEqual(entry, 'gate', `returning user gated at phase=${bootPhase}`)
    }
  }
})

test('a returning user enters while the probe hangs or errors (cold backend)', () => {
  for (const bootPhase of ['booting', 'probing_session', 'error', 'session_ready', 'session_restoring']) {
    assert.equal(
      resolveShellEntry({ canAccessShell: false, hadRecentSession: true, bootPhase, probeElapsedMs: 0 }),
      'enter',
      `phase=${bootPhase} must enter optimistically`,
    )
  }
})

test('a returning user routes to login ONLY on a confirmed no-session', () => {
  for (const bootPhase of ['no_session', 'login_ready']) {
    assert.equal(
      resolveShellEntry({ canAccessShell: false, hadRecentSession: true, bootPhase, probeElapsedMs: 0 }),
      'login',
    )
  }
})

test('first-ever visitor: gate only while probing AND under the time cap', () => {
  for (const bootPhase of ['booting', 'probing_session', 'oauth_exchanging', 'profile_hydrating']) {
    assert.equal(
      resolveShellEntry({ canAccessShell: false, hadRecentSession: false, bootPhase, probeElapsedMs: 100 }),
      'gate',
    )
  }
  for (const bootPhase of ['error', 'no_session', 'login_ready', 'session_ready']) {
    assert.notEqual(
      resolveShellEntry({ canAccessShell: false, hadRecentSession: false, bootPhase, probeElapsedMs: 100 }),
      'gate',
      `non-probing phase=${bootPhase} must not gate`,
    )
  }
})

test('the gate self-expires: past the cap, EVERY input terminates in enter or login', () => {
  for (const bootPhase of ALL_PHASES) {
    for (const hadRecentSession of [false, true]) {
      for (const canAccessShell of [false, true]) {
        const entry = resolveShellEntry({
          canAccessShell,
          hadRecentSession,
          bootPhase,
          probeElapsedMs: PROBE_GATE_MAX_MS + 1,
        })
        assert.ok(
          entry === 'enter' || entry === 'login',
          `non-terminal state past cap: phase=${bootPhase} hadSession=${hadRecentSession} canAccess=${canAccessShell} -> ${entry}`,
        )
      }
    }
  }
})
