export const MOTION_DURATION = {
  instant: 0.16,
  fast: 0.24,
  medium: 0.4,
  slow: 0.64,
  drift: 6.4,
  breathe: 9.2,
  heroFloat: 11.5,
  settle: 0.52,
}

export const MOTION_EASE = {
  hoverIn: [0.22, 1, 0.36, 1],
  hoverOut: [0.4, 0, 0.2, 1],
  state: [0.2, 0.9, 0.28, 1],
  reveal: [0.16, 1, 0.3, 1],
  drift: [0.42, 0, 0.18, 1],
  inertia: [0.18, 0.88, 0.24, 1],
}

export const MOTION_TOKENS = {
  hoverIn: {
    duration: MOTION_DURATION.fast,
    ease: MOTION_EASE.hoverIn,
  },
  hoverOut: {
    duration: MOTION_DURATION.medium,
    ease: MOTION_EASE.hoverOut,
  },
  focus: {
    duration: MOTION_DURATION.medium,
    ease: MOTION_EASE.state,
  },
  panel: {
    duration: MOTION_DURATION.medium,
    ease: MOTION_EASE.reveal,
  },
  tooltip: {
    duration: 0.22,
    ease: MOTION_EASE.reveal,
  },
  label: {
    duration: 0.26,
    ease: MOTION_EASE.hoverIn,
  },
  chip: {
    duration: 0.2,
    ease: MOTION_EASE.hoverIn,
  },
  aura: {
    duration: MOTION_DURATION.slow,
    ease: MOTION_EASE.state,
  },
  drift: {
    duration: MOTION_DURATION.drift,
    repeat: Infinity,
    ease: 'easeInOut',
  },
  breathe: {
    duration: MOTION_DURATION.breathe,
    repeat: Infinity,
    ease: 'easeInOut',
  },
  heroFloat: {
    duration: MOTION_DURATION.heroFloat,
    repeat: Infinity,
    ease: 'easeInOut',
  },
  hoverNotice: {
    duration: MOTION_DURATION.fast,
    ease: MOTION_EASE.hoverIn,
  },
  focusSettle: {
    duration: MOTION_DURATION.settle,
    ease: MOTION_EASE.inertia,
  },
  selectedPresence: {
    duration: MOTION_DURATION.slow,
    ease: MOTION_EASE.inertia,
  },
  softRelease: {
    duration: MOTION_DURATION.medium,
    ease: MOTION_EASE.hoverOut,
  },
}

export function pickMotionToken(active, inactive = MOTION_TOKENS.hoverOut) {
  return active ? MOTION_TOKENS.hoverIn : inactive
}

export const MOTION_FLOAT = {
  orb: {
    amplitude: 0.08,
    tilt: 0.08,
    depth: 0.12,
  },
  hero: {
    amplitude: 4,
    tilt: 2.2,
    depth: 8,
  },
  ui: {
    amplitude: 1.5,
    tilt: 1,
    depth: 3,
  },
}

// ── Universe / Galaxy motion tokens ────────────────────────────────────────
export const MOTION_UNIVERSE = {
  // Route/page transitions for the universe shell
  warpIn: {
    initial: { opacity: 0, scale: 0.92, filter: 'blur(12px)' },
    animate: { opacity: 1, scale: 1,    filter: 'blur(0px)'  },
    exit:    { opacity: 0, scale: 1.04, filter: 'blur(6px)'  },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
  // HUD panel appearance
  hudPanel: {
    initial:    { opacity: 0, y: 10, scale: 0.97 },
    animate:    { opacity: 1, y: 0,  scale: 1    },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
  // Sector portal popup
  sectorPortal: {
    initial:    { opacity: 0, scale: 0.88, y: 16 },
    animate:    { opacity: 1, scale: 1,    y: 0  },
    exit:       { opacity: 0, scale: 0.90, y: 8  },
    transition: { type: 'spring', stiffness: 360, damping: 32 },
  },
  // Soul orb dock expand/collapse
  orbDock: {
    transition: { type: 'spring', stiffness: 280, damping: 30 },
  },
  // Galaxy heartbeat ring
  heartbeat: {
    duration: 2.8,
    interval: 6.4,
  },
  // Cursor gravity particles
  gravity: {
    lerpFactor: 0.06,
    maxRadius:  3.5,
  },
  // Signal particle travel along edges
  signal: {
    speed: { min: 0.08, max: 0.20 },
    size:  0.06,
  },
  // Supernova flare
  supernova: {
    pulseSpeed: 1.2,
    amplitude:  0.14,
  },
  // Ghost star opacity
  ghost: {
    opacity: { min: 0.08, max: 0.18 },
    pulseSpeed: 0.28,
  },
}

// ── Performance mode presets ────────────────────────────────────────────────
// Consumers read these to scale visual complexity.
export const PERF_PRESETS = {
  ultra: {
    starDensity:        1.0,
    bloomEnabled:       true,
    particleCount:      1.0,
    fogEnabled:         true,
    signalParticles:    true,
    cursorGravity:      true,
    heartbeat:          true,
    ghostStars:         true,
    supernovaFlare:     true,
    dpr:                [1, 2.0],
  },
  balanced: {
    starDensity:        0.7,
    bloomEnabled:       true,
    particleCount:      0.65,
    fogEnabled:         true,
    signalParticles:    true,
    cursorGravity:      true,
    heartbeat:          true,
    ghostStars:         true,
    supernovaFlare:     true,
    dpr:                [1, 1.6],
  },
  low: {
    starDensity:        0.4,
    bloomEnabled:       false,
    particleCount:      0.35,
    fogEnabled:         false,
    signalParticles:    false,
    cursorGravity:      false,
    heartbeat:          true,
    ghostStars:         false,
    supernovaFlare:     false,
    dpr:                [1, 1.1],
  },
  reducedMotion: {
    starDensity:        0.35,
    bloomEnabled:       false,
    particleCount:      0,
    fogEnabled:         false,
    signalParticles:    false,
    cursorGravity:      false,
    heartbeat:          false,
    ghostStars:         true,
    supernovaFlare:     false,
    dpr:                [1, 1.0],
  },
}
