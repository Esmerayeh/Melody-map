/**
 * shellEntry.js
 * -------------
 * The ONE decision for "does a protected route render the app, the brief
 * boot gate, or the login page". Pure function + a tiny evidence flag, so the
 * cold-load state machine is unit-testable and can be proven to terminate.
 *
 * Design rule (learned the hard way): the door opens on EVIDENCE, not on a
 * live backend answer. A user who had a session recently drops straight into
 * the shell on cold load — even while /api/session/bootstrap is still hanging
 * against a cold-started backend, even if it errors. Panels own their own
 * loading/failed states. The gate exists ONLY for first-time visitors whose
 * session state is genuinely unknown, and it self-expires.
 */

export const HAD_SESSION_KEY = 'mm_had_session_v1'
export const PROFILE_CACHE_KEY = 'music_profile_cache_v1'

// How long a brand-new visitor may see the boot gate while the very first
// session probe runs. After this it falls through to /login no matter what —
// the gate can never be a terminal state. Kept SHORT: against a dead backend
// the probe never resolves, and every second on the gate is a second the
// user reads as "locked out".
export const PROBE_GATE_MAX_MS = 4_000

const PROBING_PHASES = ['booting', 'probing_session', 'oauth_exchanging', 'profile_hydrating']

export function readHadSession() {
  try {
    if (window.localStorage.getItem(HAD_SESSION_KEY) === '1') return true
    // Seed for users from before this flag existed: a persisted profile cache
    // can only exist if they had a working session within its 6h TTL.
    return Boolean(window.localStorage.getItem(PROFILE_CACHE_KEY))
  } catch {
    return false
  }
}

export function writeHadSession(value) {
  try {
    if (value) window.localStorage.setItem(HAD_SESSION_KEY, '1')
    else window.localStorage.removeItem(HAD_SESSION_KEY)
  } catch {
    // Storage unavailable — evidence flag simply won't persist.
  }
}

/**
 * Decide what a protected route renders. Returns 'enter' | 'gate' | 'login'.
 *
 * Termination guarantees:
 *  - canAccessShell        → always 'enter' (live auth evidence wins).
 *  - hadRecentSession      → never 'gate': 'enter' unless the backend has
 *    POSITIVELY confirmed there is no session ('no_session'/'login_ready'),
 *    in which case 'login'. Errors and hangs still 'enter' — a degraded
 *    dashboard beats a locked door.
 *  - no evidence at all    → 'gate' only while the first probe runs AND less
 *    than PROBE_GATE_MAX_MS has elapsed; afterwards always 'login'.
 */
export function resolveShellEntry({ canAccessShell, hadRecentSession, bootPhase, probeElapsedMs = 0 }) {
  if (canAccessShell) return 'enter'

  const confirmedNoSession = bootPhase === 'no_session' || bootPhase === 'login_ready'
  if (hadRecentSession) {
    return confirmedNoSession ? 'login' : 'enter'
  }

  const probing = PROBING_PHASES.includes(bootPhase)
  if (probing && probeElapsedMs < PROBE_GATE_MAX_MS) return 'gate'
  return 'login'
}
