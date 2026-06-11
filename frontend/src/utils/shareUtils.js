import html2canvas from 'html2canvas'

const SITE_URL = 'https://melodymap.site'

export function getCurrentShareUrl(fallback = SITE_URL) {
  if (typeof window === 'undefined') return fallback
  return window.location?.href || fallback
}

export function getInstagramStoryInstructions() {
  return 'Download this card, then upload it to your Instagram Story.'
}

export async function copyShareText(text) {
  if (!text) throw new Error('Share text is missing')
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return { method: 'clipboard' }
  }
  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available here')
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  textarea.remove()
  if (!ok) throw new Error('Clipboard copy failed')
  return { method: 'legacy-clipboard' }
}

export function buildWhatsAppUrl({ text = '', url = '' } = {}) {
  const payload = [text, url].filter(Boolean).join('\n')
  return `https://wa.me/?text=${encodeURIComponent(payload)}`
}

export function shareToWhatsApp({ text = '', url = '' } = {}) {
  const href = buildWhatsAppUrl({ text, url })
  if (typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  return href
}

export async function downloadElementAsPng(element, filename = 'melody-map-card.png', options = {}) {
  if (!element) throw new Error('Share card element missing')
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PNG export is only available in the browser')
  }
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: options.scale || Math.min(window.devicePixelRatio || 2, 3),
    useCORS: true,
    ...options,
  })
  const url = canvas.toDataURL('image/png')
  const likelyMobileSafari = /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  if (likelyMobileSafari) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) throw new Error('Your browser blocked the card preview.')
    return { url, method: 'preview' }
  }
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return { url, method: 'download' }
}

async function dataUrlToFile(dataUrl, filename) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

export async function shareViaSystem({ title = 'Melody Map', text = '', url = '', file = null, filename = 'melody-map-card.png' } = {}) {
  if (typeof navigator === 'undefined' || !navigator.share) {
    await copyShareText([text, url].filter(Boolean).join('\n'))
    return { method: 'clipboard' }
  }

  const payload = { title, text, url }
  if (file) {
    const shareFile = typeof file === 'string' ? await dataUrlToFile(file, filename) : file
    if (navigator.canShare?.({ files: [shareFile] })) {
      payload.files = [shareFile]
      delete payload.url
    }
  }
  await navigator.share(payload)
  return { method: payload.files ? 'system-file' : 'system' }
}

function firstGenre(profile) {
  return (profile?.genres || []).map((item) => item.genre || item).filter(Boolean)
}

export function buildIdentityShareText(profile = {}) {
  const identity = profile?.musicIdentity || {}
  const identityName = identity?.type?.name || profile?.sonicPersonalityTitle || profile?.personality?.[0]?.label || 'Music identity still forming'
  const genres = firstGenre(profile).slice(0, 3).join(', ') || 'an evolving sound'
  const metric = (identity?.topMetrics || profile?.identityMetrics || []).find((item) => item?.available !== false)
  const evidence = identity?.poeticLine || profile?.musicIdentitySummary || `shaped by ${genres}`
  return `My Melody Map music identity is ${identityName}. ${evidence} Top signal: ${metric?.label || genres}.`
}

export function buildSoulOrbShareText(profile = {}) {
  const identityName = profile?.musicIdentity?.type?.name || profile?.sonicPersonalityTitle || 'music identity forming'
  const orbName = profile?.orbName || profile?.soulOrbProfile?.name || 'Soul Orb'
  const mood = profile?.analyticsMetrics?.mood || 'moonlit'
  return `My Melody Map Soul Orb is ${orbName}: ${identityName} in ${mood} motion.`
}

export function buildSoulmateShareText(match = {}) {
  const a = match.userAName || match.user_a?.username || 'You'
  const b = match.userBName || match.user_b?.username || 'another listener'
  const score = Math.round(match.overallCompatibility ?? match.compatibilityScore ?? match.match_score ?? 0)
  const archetype = match.relationshipArchetype || match.compatibilityTier || 'shared orbit'
  return `${a} and ${b} are a ${score}% Melody Map match: ${archetype}.`
}

export function normalizeSoulmateLink(input = '') {
  const value = String(input || '').trim()
  if (!value) return ''
  try {
    const url = new URL(value)
    const match = url.pathname.match(/\/soulmates?\/([^/?#]+)/i)
    return decodeURIComponent(match?.[1] || '').trim()
  } catch {
    return value.replace(/^\/?soulmates?\//i, '').trim()
  }
}
