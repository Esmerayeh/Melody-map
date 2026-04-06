const DEFAULT_COPY = {
  loading: {
    title: 'Holding the shell.',
    subtitle: 'We are tuning your listening signal before the route opens.',
    detail: 'This should settle shortly.',
  },
  error: {
    title: 'The signal failed to arrive.',
    subtitle: 'We could not reach your listening profile just yet.',
    detail: 'Refresh once and the signal should return.',
  },
  empty: {
    title: 'Connect a music source to continue.',
    subtitle: 'This route opens once your listening signal is present.',
    detail: 'No signal is present yet.',
  },
  partial: {
    title: 'Partial signal detected.',
    subtitle: 'Enough data exists to open the route, but the read is still forming.',
    detail: 'Some sections will stay quieter until more listening data lands.',
  },
  sparse: {
    title: 'Sparse signal mode.',
    subtitle: 'We are rendering a lighter version while the profile deepens.',
    detail: 'This is intentional, not an error.',
  },
}

function pickCopy(copy, variant) {
  return {
    ...DEFAULT_COPY[variant],
    ...(copy?.[variant] || {}),
  }
}

export function useRouteReadiness({
  phase,
  profile,
  readiness,
  tier,
  require = {},
  copy,
}) {
  const missing = {
    profile: require.profile && !profile,
    analytics: require.analytics && !readiness?.analytics,
    identity: require.identity && !readiness?.identity,
    soulmate: require.soulmate && !readiness?.soulmate,
    galaxy: require.galaxy && !readiness?.galaxy,
    aesthetic: require.aesthetic && !readiness?.aesthetic,
  }

  if (phase === 'loading' && !profile) {
    return { blocked: true, variant: 'loading', ...pickCopy(copy, 'loading') }
  }
  if (phase === 'error' && !profile) {
    return { blocked: true, variant: 'error', ...pickCopy(copy, 'error') }
  }
  if (phase === 'empty') {
    return { blocked: true, variant: 'empty', ...pickCopy(copy, 'empty') }
  }
  if (Object.values(missing).some(Boolean)) {
    return { blocked: true, variant: 'partial', ...pickCopy(copy, 'partial') }
  }
  if (tier === 'sparse') {
    return { blocked: false, mode: 'sparse', variant: 'sparse', ...pickCopy(copy, 'sparse') }
  }

  return { blocked: false, mode: 'ready', variant: 'ready' }
}
