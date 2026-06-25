/**
 * vibeTheme.js — Generative Theming Engine
 *
 * Reads a user's average audio features and maps them to a full CSS variable
 * palette that is applied to :root, making the entire app shift its accent
 * colors to reflect the user's current "Top Vibe."
 *
 * Vibe quadrants
 * ──────────────
 *   High Energy + High Valence  → "Electric Citrus"   (amber + magenta)
 *   High Energy + Low Valence   → "Neon Storm"        (violet + crimson)
 *   Low Energy  + High Valence  → "Pastel Reverie"    (sky + lavender)
 *   Low Energy  + Low Valence   → "Midnight Obsidian" (deep indigo + muted sage)
 *   Mid range                   → default purple/pink
 */

const VIBES = [
  {
    id: 'electric_citrus',
    label: 'Electric Citrus',
    test: (e, v) => e >= 0.7 && v >= 0.65,
    vars: {
      '--color-brand-purple': '#F59E0B',
      '--color-brand-pink':   '#EC4899',
      '--color-brand-blue':   '#F97316',
      '--color-brand-teal':   '#FCD34D',
      '--color-surface':      '#0C0A00',
      '--color-surface-1':    '#141000',
      '--color-surface-2':    '#1C1600',
      '--color-surface-3':    '#241C00',
      // Neon accent triad — Auditory DNA injection
      '--accent-amber':   '#FBBF24',
      '--accent-magenta': '#F97316',
      '--accent-cyan':    '#FCD34D',
      '--glass-border':   'linear-gradient(135deg, rgba(222,131,180,0.25), rgba(249,115,22,0.15) 50%, rgba(252,211,77,0.08))',
    },
  },
  {
    id: 'neon_storm',
    label: 'Neon Storm',
    test: (e, v) => e >= 0.7 && v < 0.4,
    vars: {
      '--color-brand-purple': '#D9803A',
      '--color-brand-pink':   '#B5474A',
      '--color-brand-blue':   '#A85A2E',
      '--color-brand-teal':   '#C26A3A',
      '--color-surface':      '#120A06',
      '--color-surface-1':    '#16100A',
      '--color-surface-2':    '#1C140C',
      '--color-surface-3':    '#221810',
      '--accent-amber':   '#D9803A',
      '--accent-magenta': '#B5474A',
      '--accent-cyan':    '#C26A3A',
      '--glass-border':   'linear-gradient(135deg, rgba(217,128,58,0.3), rgba(181,71,74,0.15) 50%, rgba(194,106,58,0.08))',
    },
  },
  {
    id: 'pastel_reverie',
    label: 'Pastel Reverie',
    test: (e, v) => e < 0.4 && v >= 0.65,
    vars: {
      '--color-brand-purple': '#E8B98A',
      '--color-brand-pink':   '#D9A0A0',
      '--color-brand-blue':   '#E0C49A',
      '--color-brand-teal':   '#EAD4B0',
      '--color-surface':      '#16120C',
      '--color-surface-1':    '#1A1610',
      '--color-surface-2':    '#201A12',
      '--color-surface-3':    '#261F16',
      '--accent-amber':   '#E8B98A',
      '--accent-magenta': '#D9A0A0',
      '--accent-cyan':    '#E0C49A',
      '--glass-border':   'linear-gradient(135deg, rgba(232,185,138,0.25), rgba(217,160,160,0.15) 50%, rgba(224,196,154,0.08))',
    },
  },
  {
    id: 'midnight_obsidian',
    label: 'Midnight Obsidian',
    test: (e, v) => e < 0.4 && v < 0.4,
    vars: {
      '--color-brand-purple': '#8A6A4A',
      '--color-brand-pink':   '#7A6B5C',
      '--color-brand-blue':   '#6E5A42',
      '--color-brand-teal':   '#5C5448',
      '--color-surface':      '#100C08',
      '--color-surface-1':    '#14100B',
      '--color-surface-2':    '#181310',
      '--color-surface-3':    '#1E1813',
      '--accent-amber':   '#8A6A4A',
      '--accent-magenta': '#7A6B5C',
      '--accent-cyan':    '#6E5A42',
      '--glass-border':   'linear-gradient(135deg, rgba(138,106,74,0.2), rgba(122,107,92,0.1) 50%, rgba(110,90,66,0.06))',
    },
  },
]

const DEFAULT_VARS = {
  // Warm filmic default — amber primary, dusty rose secondary, warm charcoal.
  '--color-brand-purple': '#E0A35C',
  '--color-brand-pink':   '#C97B7B',
  '--color-brand-blue':   '#C9A36A',
  '--color-brand-teal':   '#B8946A',
  '--color-surface':      '#14110D',
  '--color-surface-1':    '#16130F',
  '--color-surface-2':    '#1C1815',
  '--color-surface-3':    '#242019',
  '--accent-amber':   '#E0A35C',
  '--accent-magenta': '#C97B7B',
  '--accent-cyan':    '#9FB0C4',
  '--glass-border':   'linear-gradient(135deg, rgba(242,235,224,0.14), rgba(193,19,127,0.18) 40%, rgba(255,255,255,0.04))',
}

/**
 * Apply a vibe palette to :root CSS variables with a smooth transition.
 * @param {number} energy   0–1
 * @param {number} valence  0–1
 * @returns {{ id: string, label: string }} the matched vibe
 */
export function applyVibeTheme(energy, valence) {
  const vibe = VIBES.find((v) => v.test(energy, valence))
  const vars = vibe ? vibe.vars : DEFAULT_VARS
  const root = document.documentElement

  // Smooth transition on the root element
  root.style.transition = 'background-color 1.2s ease, color 0.6s ease'

  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val)
  })

  return vibe ? { id: vibe.id, label: vibe.label } : { id: 'default', label: 'Cosmic Default' }
}

/**
 * Reset all vibe CSS variables back to defaults.
 */
export function resetVibeTheme() {
  const root = document.documentElement
  Object.keys(DEFAULT_VARS).forEach((key) => root.style.removeProperty(key))
}

/**
 * Get the vibe label for a given energy/valence without applying it.
 */
export function getVibeName(energy, valence) {
  const vibe = VIBES.find((v) => v.test(energy, valence))
  return vibe?.label ?? 'Cosmic Default'
}

/**
 * toPastel — convert any hex color to a soft pastel variant.
 * Blends the color toward white (high lightness, low saturation).
 * @param {string} hex  e.g. "#7c6fff"
 * @param {number} mix  0–1, how much to blend toward white (default 0.55)
 * @returns {string}    pastel hex
 */
export function toPastel(hex, mix = 0.55) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const pr = Math.round(r + (255 - r) * mix)
  const pg = Math.round(g + (255 - g) * mix)
  const pb = Math.round(b + (255 - b) * mix)
  return `#${pr.toString(16).padStart(2, '0')}${pg.toString(16).padStart(2, '0')}${pb.toString(16).padStart(2, '0')}`
}

/**
 * extractPastelPalette — derive a pastel accent palette from album art images.
 * Uses a canvas to sample dominant colors from the first few album images,
 * then converts them to pastels.
 *
 * @param {string[]} imageUrls  — array of album art URLs (top tracks)
 * @param {number}   count      — number of colors to return (default 5)
 * @returns {Promise<string[]>} — array of pastel hex colors
 */
export async function extractPastelPalette(imageUrls = [], count = 5) {
  const colors = []
  const canvas = document.createElement('canvas')
  canvas.width = 1; canvas.height = 1
  const ctx = canvas.getContext('2d')

  for (const url of imageUrls.slice(0, count)) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = url
      })
      ctx.drawImage(img, 0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      colors.push(toPastel(hex, 0.5))
    } catch {
      // skip failed images
    }
  }

  // Fill remaining slots with default pastel colors if needed
  const defaults = ['#e1a7c6', '#fbcfe8', '#bae6fd', '#bbf7d0', '#fde68a']
  while (colors.length < count) colors.push(defaults[colors.length % defaults.length])
  return colors
}
