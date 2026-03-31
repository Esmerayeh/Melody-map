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
