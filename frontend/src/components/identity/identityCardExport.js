import html2canvas from 'html2canvas'

export async function exportElementAsPng(element, filename = 'melody-map-identity-card.png') {
  if (!element) {
    throw new Error('Identity card element missing')
  }
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: Math.min(window.devicePixelRatio || 2, 3),
    useCORS: true,
  })
  const url = canvas.toDataURL('image/png')
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const likelyMobileSafari = /iPhone|iPad|iPod/i.test(ua)

  if (typeof window !== 'undefined' && likelyMobileSafari) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      throw new Error('Your browser blocked the download preview. Try long-pressing the card image after it opens.')
    }
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

export function buildIdentityShareText({ archetype, mbti, topGenres = [], moodLabel }) {
  return `My Melody Map identity is ${archetype || 'still forming'} (${mbti || 'soft signal'}) shaped by ${topGenres.slice(0, 3).join(', ') || 'an evolving sound'} with a ${moodLabel || 'cinematic'} emotional pull.`
}
