import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import useExperienceStore from '../store/useExperienceStore'
import useMusicProfile from '../hooks/useMusicProfile'

function resolveActiveMode(pathname) {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/discover')) return 'discover'
  if (pathname.startsWith('/galaxy')) return 'galaxy'
  if (pathname.startsWith('/soulmate')) return 'soulmate'
  if (pathname.startsWith('/aesthetic')) return 'aesthetic'
  if (pathname.startsWith('/auralith')) return 'auralith'
  if (pathname.startsWith('/analytics')) return 'analytics'
  if (pathname.startsWith('/identity')) return 'identity'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'dashboard'
}

export default function ExperienceBridge() {
  const location = useLocation()
  const sessionAuthenticated = useStore((state) => state.isAuthenticated)
  const providerConnected = useStore((state) => state.providerConnected)
  const { profile, loading, error, confidence, dataQuality } = useMusicProfile({
    autoFetch: providerConnected,
  })
  const setActiveMode = useExperienceStore((state) => state.setActiveMode)
  const setRouteContext = useExperienceStore((state) => state.setRouteContext)
  const setLoadingState = useExperienceStore((state) => state.setLoadingState)
  const setDataConfidence = useExperienceStore((state) => state.setDataConfidence)

  useEffect(() => {
    setActiveMode(resolveActiveMode(location.pathname))
    setRouteContext({
      pathname: location.pathname,
      search: location.search,
    })
  }, [location.pathname, location.search, setActiveMode, setRouteContext])

  useEffect(() => {
    setLoadingState({
      profile: Boolean(loading),
      route: false,
      scene: location.pathname.startsWith('/galaxy') && Boolean(loading),
    })
  }, [loading, location.pathname, setLoadingState])

  useEffect(() => {
    const bootPhase = !providerConnected
      ? 'idle'
      : (loading && !profile)
        ? 'profileBootLoading'
        : (error && !profile)
          ? 'profileFailed'
          : (!profile)
            ? 'profileEmpty'
            : (profile?.isDegraded)
              ? 'profilePartial'
              : 'profileReady'

    const overallScore = profile?.confidence?.overall ?? 0
    const tier = !profile
      ? (error ? 'failed' : loading ? 'limited' : 'limited')
      : overallScore >= 0.78
        ? 'rich'
        : overallScore >= 0.55
          ? 'medium'
          : overallScore >= 0.35
            ? 'sparse'
            : 'limited'

    setDataConfidence({
      overall: confidence?.labels?.overall || (loading ? 'tuning into your signal...' : 'soft signal'),
      analytics: confidence?.labels?.analytics || 'soft signal',
      identity: confidence?.labels?.identity || 'soft signal',
      galaxy: confidence?.labels?.galaxy || 'soft signal',
      soulmate: confidence?.labels?.soulmate || 'soft signal',
      degraded: Boolean(profile?.isDegraded || dataQuality?.degradedReasons?.length),
      hasAudioProfile: Boolean(dataQuality?.hasAudioProfile),
      profileReady: Boolean(profile),
      tier,
      bootPhase,
      bootMessage: error || '',
      error: error || null,
      sessionAuthenticated,
    })
  }, [confidence, dataQuality, error, loading, profile, providerConnected, sessionAuthenticated, setDataConfidence])

  return null
}
