import axios from 'axios'
import type { GalaxyArtifactResponse } from './galaxyTypes'

const baseUrl = import.meta.env.VITE_NEXTGEN_API_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''
const apiBase = `${baseUrl}/api`

const galaxyClient = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

function unwrap<T>(payload: any): T {
  if (payload?.data?.data) return payload.data.data as T
  if (payload?.data) return payload.data as T
  return payload as T
}

export async function buildGalaxyArtifact(payload: Record<string, unknown>, idempotencyKey: string): Promise<GalaxyArtifactResponse> {
  const response = await galaxyClient.post('/galaxy/build', {
    profile: payload,
    idempotency_key: idempotencyKey,
  })
  return unwrap<GalaxyArtifactResponse>(response)
}

export async function enqueueGalaxyBuild(payload: Record<string, unknown>, idempotencyKey: string) {
  const response = await galaxyClient.post('/galaxy/jobs', {
    profile: payload,
    idempotency_key: idempotencyKey,
  })
  return unwrap(response)
}
