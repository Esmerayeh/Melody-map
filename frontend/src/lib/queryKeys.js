export const queryKeys = {
  sessionBootstrap: ['session-bootstrap'],
  musicProfile: (provider, timeRange) => ['music-profile', provider || 'none', timeRange || 'medium_term'],
}

export default queryKeys
