import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'
import ShellChrome from './components/shell/ShellChrome'
import useStore from './store/useStore'
import useExperienceStore from './store/useExperienceStore'
import useMusicProfile from './hooks/useMusicProfile'
import useAuthStore from './store/useAuthStore'
import AuthBootstrap from './app/AuthBootstrap'
import { applyVibeTheme, resetVibeTheme } from './services/vibeTheme'
import ShellSkeleton from './components/shell/ShellSkeleton'
import useGalaxyStage from './features/galaxy/useGalaxyStage'

const MusicMap       = lazy(() => import('./pages/MusicMap'))
const Discover       = lazy(() => import('./pages/Discover'))
const Playlists      = lazy(() => import('./pages/Playlists'))
const Analytics      = lazy(() => import('./pages/Analytics'))
const Login          = lazy(() => import('./pages/Login'))
const SpotifySuccess = lazy(() => import('./pages/SpotifySuccess'))
const LastfmSuccess  = lazy(() => import('./pages/LastfmSuccess'))
const MusicSoulmate  = lazy(() => import('./pages/MusicSoulmate'))
const MusicAesthetic = lazy(() => import('./pages/MusicAesthetic'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Profile        = lazy(() => import('./pages/Profile'))
const Auralith       = lazy(() => import('./pages/Auralith'))
const MusicIdentity  = lazy(() => import('./pages/MusicIdentity'))
const IdentityDrift  = lazy(() => import('./pages/IdentityDrift'))
// New routes
const Demo           = lazy(() => import('./pages/Demo'))
const Universe       = lazy(() => import('./pages/Universe'))

// The ONE persistent galaxy canvas (immersive shell). Mounted once, above the
// route swap, so it never remounts on navigation. Driven by the galaxy-stage
// store, which each galaxy route publishes into. Inert until a route opts in.
const GalaxyStage = lazy(() => import('./features/galaxy/GalaxyScene'))

function PersistentGalaxy() {
  const active           = useGalaxyStage((s) => s.active)
  const model            = useGalaxyStage((s) => s.model)
  const sparseMode       = useGalaxyStage((s) => s.sparseMode)
  const lowPower         = useGalaxyStage((s) => s.lowPower)
  const reducedMotion    = useGalaxyStage((s) => s.reducedMotion)
  const webglEnabled     = useGalaxyStage((s) => s.webglEnabled)
  const traversalEnabled = useGalaxyStage((s) => s.traversalEnabled)
  const scanPulseCount   = useGalaxyStage((s) => s.scanPulseCount)
  const onScanPulse      = useGalaxyStage((s) => s.onScanPulse)
  const autoRotateSpeed  = useGalaxyStage((s) => s.autoRotateSpeed)
  const extraChildren    = useGalaxyStage((s) => s.extraChildren)

  if (!active) return null

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <Suspense fallback={null}>
        <GalaxyStage
          model={model}
          sparseMode={sparseMode}
          lowPower={lowPower}
          reducedMotion={reducedMotion}
          webglEnabled={webglEnabled}
          traversalEnabled={traversalEnabled}
          scanPulseCount={scanPulseCount}
          onScanPulse={onScanPulse}
          autoRotateSpeed={autoRotateSpeed}
          extraChildren={extraChildren}
        />
      </Suspense>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

// Spatial spring-physics page transitions -- suggest depth between layers
const pageVariants = {
  initial: { opacity: 0, y: 18, scale: 0.98, filter: 'blur(4px)' },
  enter:   {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 },
  },
  exit:    {
    opacity: 0, y: -10, scale: 1.01, filter: 'blur(2px)',
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
}

function PageWrapper({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial={false}
      animate="enter"
      exit="exit"
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  )
}

function ShellRouteFallback() {
  return (
    <AppShell>
      <div className="cosmic-page space-y-6">
        <div className="noire-panel rounded-[28px] p-6">
          <p className="page-header-kicker mb-3">Loading the next layer</p>
          <ShellSkeleton lines={4} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="noire-info-card rounded-[24px] p-5">
              <ShellSkeleton lines={3} compact />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function StandaloneRouteFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 app-shell-bg">
      <div className="noire-panel max-w-lg rounded-[28px] p-8 w-full">
        <p className="page-header-kicker mb-3">Continuing the handoff</p>
        <ShellSkeleton lines={4} />
      </div>
    </div>
  )
}

function RouteModule({ shell = false, children }) {
  return (
    <Suspense fallback={shell ? <ShellRouteFallback /> : <StandaloneRouteFallback />}>
      {children}
    </Suspense>
  )
}

class RouteCrashBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Loud, full surface so the real throw is never swallowed into the soft
    // "orbit still settling" fallback. Logs message, originating stack, and the
    // React component stack (which component threw).
    console.error('[ROUTE_CRASH]', error?.message || error)
    console.error('[ROUTE_CRASH] stack:', error?.stack)
    console.error('[ROUTE_CRASH] componentStack:', info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

function ProtectedRouteFallback() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="noire-panel max-w-xl rounded-[28px] p-8 text-center">
        <p className="page-header-kicker mb-2">Booting the signal</p>
        <h2 className="text-2xl font-semibold text-white">Your orbit is still settling.</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Spotify auth succeeded, but one of the post-login surfaces failed to fully settle. Melody Map is holding the shell open instead of dropping you into a blank page.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.22em] text-gray-500">
          Try refreshing once if the quieter boot state does not clear.
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="mt-5 noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
        >
          Reload the shell
        </button>
      </div>
    </div>
  )
}

function GlobalRouteFallback() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 app-shell-bg">
      <div className="noire-panel max-w-lg rounded-[28px] p-8 text-center">
        <p className="page-header-kicker mb-2">Holding the thread</p>
        <h1 className="text-2xl font-semibold text-white">Melody Map hit a render fault.</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          The app caught a runtime crash before it could turn into a blank screen. Your session is still there, and a reload should bring the surface back.
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="mt-5 noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
        >
          Reload Melody Map
        </button>
      </div>
    </div>
  )
}

const ProtectedRoute = ({ children }) => {
  const sessionToken = useAuthStore((s) => s.sessionToken)
  const providers = useAuthStore((s) => s.providers)
  const bootPhase = useAuthStore((s) => s.bootPhase)
  const authHydrating = ['booting', 'probing_session', 'oauth_exchanging', 'profile_hydrating'].includes(bootPhase)
  const canAccessShell = Boolean(sessionToken || providers.spotify.connected || providers.lastfm.connected)
  if (authHydrating) return <ProtectedRouteFallback />
  return canAccessShell ? children : <Navigate to="/login" replace />
}

function ProtectedShell({ children }) {
  const location = useLocation()

  return (
    <ProtectedRoute>
      <RouteCrashBoundary resetKey={location.pathname} fallback={<ProtectedRouteFallback />}>
        <AppShell>{children}</AppShell>
      </RouteCrashBoundary>
    </ProtectedRoute>
  )
}

function AppShell({ children }) {
  const cinemaMode = useStore((s) => s.cinemaMode)
  if (cinemaMode) {
    // Transparent in cinema mode so the persistent galaxy (fixed, z-0) is the
    // fullscreen backdrop; cinema chrome floats above it.
    return <div className="relative z-10 h-[100dvh] overflow-hidden">{children}</div>
  }
  // No sidebar. Floating glass chrome (brand / nav strip / status / dock) sits
  // fixed over the persistent galaxy; page content scrolls in a full-bleed main,
  // padded so it clears the top strip and bottom dock. The shell carries no
  // opaque background — the fixed z-0 galaxy shows through, otherwise the body's
  // deep-space gradient.
  return (
    <div className="relative z-10 h-[100dvh] min-h-[100dvh] overflow-hidden">
      <ShellChrome />
      <main className="app-shell-scroll h-full overflow-y-auto pt-[4.75rem] pb-[8.5rem]">
        {children}
      </main>
    </div>
  )
}

function resolveActiveMode(pathname) {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/discover')) return 'discover'
  if (pathname.startsWith('/galaxy')) return 'galaxy'
  if (pathname.startsWith('/soulmates')) return 'soulmate'
  if (pathname.startsWith('/soulmate')) return 'soulmate'
  if (pathname.startsWith('/aesthetic')) return 'aesthetic'
  if (pathname.startsWith('/auralith')) return 'auralith'
  if (pathname.startsWith('/analytics')) return 'analytics'
  if (pathname.startsWith('/identity')) return 'identity'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'dashboard'
}

function ExperienceBridge() {
  const location = useLocation()
  const sessionToken = useAuthStore((state) => state.sessionToken)
  const providers = useAuthStore((state) => state.providers)
  const bootPhase = useAuthStore((state) => state.bootPhase)
  const { profile, loading, error, confidence, dataQuality } = useMusicProfile({
    autoFetch: Boolean(sessionToken || providers.spotify.connected || providers.lastfm.connected),
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
    const derivedBootPhase = !(sessionToken || providers.spotify.connected || providers.lastfm.connected)
      ? bootPhase === 'booting' ? 'login_ready' : bootPhase
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
      bootPhase: derivedBootPhase,
      bootMessage: error || '',
      error: error || null,
    })
  }, [bootPhase, confidence, dataQuality, error, loading, profile, providers.lastfm.connected, providers.spotify.connected, sessionToken, setDataConfidence])

  return null
}

// Inner router component so useLocation works inside Router
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <RouteCrashBoundary resetKey={location.pathname} fallback={<GlobalRouteFallback />}>
      <ExperienceBridge />
      {/* No AnimatePresence here. mode="wait" deadlocked navigation: the exiting
          route tree's motion components never resolved their exit, so the next
          route could never mount (URL changed, content froze). Routes stays keyed
          on pathname so each route remounts and plays its enter animation;
          exit animation is intentionally dropped — navigation correctness wins. */}
      <Routes location={location} key={location.pathname}>
          {/* Public routes — no auth required */}
          <Route path="/login" element={<RouteModule><PageWrapper><Login /></PageWrapper></RouteModule>} />
          <Route path="/spotify-success" element={<RouteModule><SpotifySuccess /></RouteModule>} />
          <Route path="/lastfm-success" element={<RouteModule><LastfmSuccess /></RouteModule>} />
          <Route path="/demo" element={<RouteModule><Demo /></RouteModule>} />

          <Route path="/" element={
            <ProtectedShell><RouteModule shell><PageWrapper><Dashboard /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/galaxy" element={
            <ProtectedShell><RouteModule shell><PageWrapper><MusicMap /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/discover" element={
            <ProtectedShell><RouteModule shell><PageWrapper><Discover /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/playlists" element={
            <ProtectedShell><RouteModule shell><PageWrapper><Playlists /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/analytics" element={
            <ProtectedShell><RouteModule shell><PageWrapper><Analytics /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/soulmate" element={
            <ProtectedShell><RouteModule shell><PageWrapper><MusicSoulmate /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/soulmates" element={
            <ProtectedShell><RouteModule shell><PageWrapper><MusicSoulmate /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/soulmate/:identifier" element={<RouteModule><PageWrapper><MusicSoulmate /></PageWrapper></RouteModule>} />
          <Route path="/aesthetic" element={
            <ProtectedShell><RouteModule shell><PageWrapper><MusicAesthetic /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/profile" element={
            <ProtectedShell><RouteModule shell><PageWrapper><Profile /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/identity" element={
            <ProtectedShell><RouteModule shell><PageWrapper><MusicIdentity /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/identity-drift" element={
            <ProtectedShell><RouteModule shell><PageWrapper><IdentityDrift /></PageWrapper></RouteModule></ProtectedShell>
          } />
          <Route path="/auralith" element={
            <ProtectedShell><RouteModule shell><PageWrapper><Auralith /></PageWrapper></RouteModule></ProtectedShell>
          } />
          {/* Universe — full-screen spatial hub, no shell chrome */}
          <Route path="/universe" element={
            <ProtectedRoute>
              <RouteCrashBoundary resetKey="/universe" fallback={<ProtectedRouteFallback />}>
                <RouteModule>
                  <Universe />
                </RouteModule>
              </RouteCrashBoundary>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </RouteCrashBoundary>
  )
}

export default function App() {
  const aestheticState  = useStore((s) => s.aestheticState)
  const vibeFeatures    = useStore((s) => s.vibeFeatures)

  // Apply generative vibe theme whenever audio features change
  useEffect(() => {
    if (vibeFeatures?.energy != null && vibeFeatures?.valence != null) {
      applyVibeTheme(vibeFeatures.energy, vibeFeatures.valence)
    } else if (aestheticState?.palette?.length >= 2) {
      // Legacy: palette-based theming from aesthetic engine
      const root = document.documentElement
      root.style.setProperty('--color-brand-purple', aestheticState.palette[0])
      root.style.setProperty('--color-brand-pink',   aestheticState.palette[1])
      root.style.setProperty('--color-brand-blue',   aestheticState.palette[2] || aestheticState.palette[0])
    } else {
      resetVibeTheme()
    }
  }, [vibeFeatures, aestheticState])

  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthBootstrap />
        <PersistentGalaxy />
        <AnimatedRoutes />

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'linear-gradient(160deg, rgba(20,14,30,0.92), rgba(8,5,18,0.96))',
              color: '#f6f1e8',
              border: '1px solid rgba(255,220,200,0.16)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 16px 38px rgba(0,0,0,0.4)',
            },
            success: { iconTheme: { primary: '#e0a35c', secondary: '#fff' } },
          }}
        />
      </Router>
    </QueryClientProvider>
  )
}
