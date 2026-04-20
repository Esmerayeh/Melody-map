const isProd = import.meta.env.PROD
const debugEnabled = import.meta.env.VITE_LOG_LEVEL === 'debug'

function safeStringify(payload) {
  try {
    return JSON.stringify(payload)
  } catch {
    return String(payload)
  }
}

export function logClientEvent(event, payload = {}, level = 'warn') {
  const shouldLog = !isProd || level !== 'info' || debugEnabled
  if (!shouldLog) return

  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  if (level === 'error') {
    console.error('[MelodyMap]', safeStringify(entry))
    return
  }
  if (level === 'info') {
    console.info('[MelodyMap]', safeStringify(entry))
    return
  }
  console.warn('[MelodyMap]', safeStringify(entry))
}
