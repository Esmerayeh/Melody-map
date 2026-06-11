/**
 * galaxyApi.ts
 * ------------
 * Backend calls for the next-gen galaxy artifact service.
 *
 * If the backend does not yet have /api/galaxy/build or /api/galaxy/jobs,
 * both functions resolve gracefully to null so the client falls back to
 * the local buildGalaxyModel() builder without console noise.
 */
import axios, { AxiosError } from 'axios'
import type { GalaxyArtifactResponse } from './galaxyTypes'

const baseUrl = import.meta.env.VITE_NEXTGEN_API_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''
const apiBase = `${baseUrl}/api`

const galaxyClient = axios.create({
  baseURL:         apiBase,
  withCredentials: true,
  // Hard timeout so a cold/remote/unreachable backend rejects fast instead of
  // holding the socket open and freezing the galaxy loading gate. The client
  // builder is always a valid fallback, so a slow artifact service must never
  // block first paint.
  timeout:         4000,
  headers:         { 'Content-Type': 'application/json' },
})

// The backend rejects cookie-session POSTs without a CSRF token (403). This
// standalone client bypasses the shared api.js interceptor, so it must attach
// the token itself or every /galaxy/build and /galaxy/jobs call silently falls
// back to the client-side builder.
galaxyClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method) && typeof document !== 'undefined') {
    const prefix = 'mm_csrf='
    const match = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
    if (match) {
      config.headers = config.headers || {}
      config.headers['X-CSRF-Token'] = config.headers['X-CSRF-Token'] || decodeURIComponent(match.slice(prefix.length))
    }
  }
  return config
})

function unwrap<T>(payload: any): T {
  if (payload?.data?.data) return payload.data.data as T
  if (payload?.data)       return payload.data as T
  return payload as T
}

function isNotFound(err: unknown): boolean {
  return (err instanceof AxiosError) && (err.response?.status === 404 || err.response?.status === 405)
}

/**
 * Build a galaxy artifact from the given profile.
 * Returns null (silently) when the endpoint does not yet exist — the
 * caller falls through to the client-side builder.
 */
export async function buildGalaxyArtifact(
  payload:        Record<string, unknown>,
  idempotencyKey: string,
): Promise<GalaxyArtifactResponse | null> {
  try {
    const response = await galaxyClient.post('/galaxy/build', {
      profile:          payload,
      idempotency_key:  idempotencyKey,
    })
    return unwrap<GalaxyArtifactResponse>(response)
  } catch (err) {
    // ANY failure (404/405 absent endpoint, timeout, network down, 5xx) resolves
    // to null so the caller falls through to the client-side builder. The galaxy
    // must never stall waiting on this request.
    if (!isNotFound(err)) {
      // eslint-disable-next-line no-console
      console.warn('[GALAXY_ARTIFACT] build request failed, using client fallback:', (err as Error)?.message)
    }
    return null
  }
}

/**
 * Enqueue a background galaxy build job.
 * Returns null silently when the endpoint is absent.
 */
export async function enqueueGalaxyBuild(
  payload:        Record<string, unknown>,
  idempotencyKey: string,
): Promise<{ job_id?: string; status?: string } | null> {
  try {
    const response = await galaxyClient.post('/galaxy/jobs', {
      profile:         payload,
      idempotency_key: idempotencyKey,
    })
    return unwrap(response)
  } catch (err) {
    // Background enqueue is best-effort; never surface as an error.
    return null
  }
}
