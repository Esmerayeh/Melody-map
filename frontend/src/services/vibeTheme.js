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
      '--glass-border':   'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(249,115,22,0.15) 50%, rgba(252,211,77,0.08))',
    },
  },
  {
    id: 'neon_storm',
    label: 'Neon Storm',
    test: (e, v) => e >= 0.7 && v < 0.4,
    vars: {
      '--color-brand-purple': '#7C3AED',
      '--color-brand-pink':   '#DC2626',
      '--color-brand-blue':   '#6D28D9',
      '--color-brand-teal':   '#9333EA',
      '--color-surface':      '#0A0008',
      '--color-surface-1':    '#100010',
      '--color-surface-2':    '#160018',
      '--color-surface-3':    '#1C0020',
      '--accent-amber':   '#DC2626',
      '--accent-magenta': '#9333EA',
      '--accent-cyan':    '#7C3AED',
      '--glass-border':   'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(220,38,38,0.15) 50%, rgba(147,51,234,0.08))',
    },
  },
  {
    id: 'pastel_reverie',
    label: 'Pastel Reverie',
    test: (e, v) => e < 0.4 && v >= 0.65,
    vars: {
      '--color-brand-purple': '#38BDF8',
      '--color-brand-pink':   '#C084FC',
      '--color-brand-blue':   '#67E8F9',
      '--color-brand-teal':   '#A5F3FC',
      '--color-surface':      '#00080C',
      '--color-surface-1':    '#000E14',
      '--color-surface-2':    '#00141C',
      '--color-surface-3':    '#001A24',
      '--accent-amber':   '#C084FC',
      '--accent-magenta': '#38BDF8',
      '--accent-cyan':    '#67E8F9',
      '--glass-border':   'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(192,132,252,0.15) 50%, rgba(103,232,249,0.08))',
    },
  },
  {
    id: 'midnight_obsidian',
    label: 'Midnight Obsidian',
    test: (e, v) => e < 0.4 && v < 0.4,
    vars: {
      '--color-brand-purple': '#4338CA',
      '--color-brand-pink':   '#6B7280',
      '--color-brand-blue':   '#3730A3',
      '--color-brand-teal':   '#4B5563',
      '--color-surface':      '#080810',
      '--color-surface-1':    '#0C0C18',
      '--color-surface-2':    '#101020',
      '--color-surface-3':    '#141428',
      '--accent-amber':   '#6B7280',
      '--accent-magenta': '#4338CA',
      '--accent-cyan':    '#3730A3',
      '--glass-border':   'linear-gradient(135deg, rgba(67,56,202,0.2), rgba(107,114,128,0.1) 50%, rgba(55,48,163,0.06))',
    },
  },
]

const DEFAULT_VARS = {
  '--color-brand-purple': '#6C5CE7',
  '--color-brand-pink':   '#FF5DA2',
  '--color-brand-blue':   '#00D1FF',
  '--color-brand-teal':   '#2DD4BF',
  '--color-surface':      '#0B0B12',
  '--color-surface-1':    '#0F0F1A',
  '--color-surface-2':    '#151528',
  '--color-surface-3':    '#1A1A32',
  '--accent-amber':   '#FBBF24',
  '--accent-magenta': '#FF5DA2',
  '--accent-cyan':    '#00D1FF',
  '--glass-border':   'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(108,92,231,0.18) 40%, rgba(255,255,255,0.04))',
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
  const defaults = ['#c4b5fd', '#fbcfe8', '#bae6fd', '#bbf7d0', '#fde68a']
  while (colors.length < count) colors.push(defaults[colors.length % defaults.length])
  return colors
}
