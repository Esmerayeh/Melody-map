import { normalizeProfile, unwrapProfileResponse, validateProfilePayload } from './profileAdapters.js'

const DEFAULT_STATUS = {
  ready: 'ready',
  partial: 'partial',
  sparse: 'sparse',
  failed: 'failed',
  empty: 'empty',
}

const emptyConfidence = { score: 0, label: 'limited' }

function coerceArray(value) {
  return Array.isArray(value) ? value : []
}

function pick(obj, keys = []) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key]
  }
  return undefined
}

export function normalizeEnvelope(payload, { fallbackStatus = DEFAULT_STATUS.ready } = {}) {
  if (payload == null) {
    return {
      status: DEFAULT_STATUS.failed,
      data: null,
      confidence: emptyConfidence,
      dataQuality: null,
      profileTier: null,
      warnings: ['empty_payload'],
    }
  }

  const wrapped = payload && typeof payload === 'object' && payload.data != null ? payload : { data: payload }
  const success = wrapped.success ?? wrapped.ok
  const error = wrapped.error
  const data = wrapped.data
  const warnings = coerceArray(wrapped.warnings)
  const confidence = pick(wrapped, ['confidence', 'confidenceScore']) || data?.confidence || emptyConfidence
  const dataQuality = pick(wrapped, ['dataQuality', 'data_quality']) || data?.dataQuality || data?.data_quality || null
  const profileTier = pick(wrapped, ['profileTier', 'profile_tier']) || data?.profileTier || data?.profile_tier || null

  if (success === false || error) {
    return {
      status: DEFAULT_STATUS.failed,
      data: data ?? null,
      confidence: confidence || emptyConfidence,
      dataQuality,
      profileTier,
      warnings: warnings.length ? warnings : ['request_failed'],
      error: error || wrapped.message,
    }
  }

  const limitedSignal = Boolean(wrapped.limitedSignal || wrapped.limited_signal)
  const status = limitedSignal ? DEFAULT_STATUS.sparse : fallbackStatus
  return {
    status,
    data,
    confidence: confidence || emptyConfidence,
    dataQuality,
    profileTier,
    warnings,
  }
}

export function normalizeProfileResponse(payload, provider) {
  const envelope = normalizeEnvelope(payload)
  const raw = unwrapProfileResponse(envelope.data)
  if (!raw) {
    return {
      ...envelope,
      status: DEFAULT_STATUS.failed,
      data: null,
      warnings: envelope.warnings?.length ? envelope.warnings : ['profile_missing'],
    }
  }
  const validation = validateProfilePayload(raw)
  if (!validation.ok) {
    return {
      ...envelope,
      status: DEFAULT_STATUS.failed,
      data: null,
      warnings: [validation.reason],
    }
  }
  const data = normalizeProfile(raw, provider)
  return {
    ...envelope,
    status: data?.isDegraded ? DEFAULT_STATUS.partial : envelope.status || DEFAULT_STATUS.ready,
    data,
    confidence: data?.confidence || envelope.confidence || emptyConfidence,
    dataQuality: data?.dataQuality || envelope.dataQuality || null,
    profileTier: data?.profileTier || envelope.profileTier || (data?.isDegraded ? 'partial' : 'full'),
    warnings: envelope.warnings?.length ? envelope.warnings : coerceArray(raw?.warnings),
  }
}

export function normalizeIdentityResponse(payload) {
  const envelope = normalizeEnvelope(payload)
  const data = envelope.data || null
  const hasIdentity = Boolean(data?.mbti || data?.personality || data?.personalityTraits)
  if (envelope.status === DEFAULT_STATUS.failed || envelope.status === DEFAULT_STATUS.sparse) {
    return { ...envelope, data }
  }
  return {
    ...envelope,
    status: hasIdentity ? DEFAULT_STATUS.ready : DEFAULT_STATUS.partial,
    data,
  }
}

export function normalizeAnalyticsResponse(payload) {
  const envelope = normalizeEnvelope(payload)
  const data = envelope.data || null
  const hasMetrics = Boolean(data?.analyticsMetrics || data?.metrics || data?.features)
  if (envelope.status === DEFAULT_STATUS.failed || envelope.status === DEFAULT_STATUS.sparse) {
    return { ...envelope, data }
  }
  return {
    ...envelope,
    status: hasMetrics ? DEFAULT_STATUS.ready : DEFAULT_STATUS.sparse,
    data,
  }
}

export function normalizeAestheticResponse(payload) {
  const envelope = normalizeEnvelope(payload)
  const data = envelope.data || null
  const hasPalette = Array.isArray(data?.palette) && data.palette.length >= 3
  if (envelope.status === DEFAULT_STATUS.failed || envelope.status === DEFAULT_STATUS.sparse) {
    return { ...envelope, data }
  }
  return {
    ...envelope,
    status: hasPalette ? DEFAULT_STATUS.ready : DEFAULT_STATUS.partial,
    data,
  }
}

export function normalizeSoulmateResponse(payload) {
  const envelope = normalizeEnvelope(payload)
  const data = envelope.data || null
  const score = data?.overallCompatibility ?? data?.match_score
  return {
    ...envelope,
    status: score != null ? DEFAULT_STATUS.ready : DEFAULT_STATUS.partial,
    data,
  }
}

export function normalizePublicProfileResponse(payload) {
  const envelope = normalizeEnvelope(payload)
  const data = envelope.data || null
  return {
    ...envelope,
    status: data ? DEFAULT_STATUS.ready : DEFAULT_STATUS.failed,
    data,
  }
}

export function normalizeListResponse(payload, fallback = []) {
  const envelope = normalizeEnvelope(payload)
  const data = Array.isArray(envelope.data) ? envelope.data : fallback
  return {
    ...envelope,
    status: data.length ? DEFAULT_STATUS.ready : DEFAULT_STATUS.sparse,
    data,
  }
}

export const ADAPTER_STATUS = DEFAULT_STATUS
