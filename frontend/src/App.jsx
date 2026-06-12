import React, { Suspense, lazy, useEffect, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
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
import GalaxySceneBoundary from './features/galaxy/GalaxySceneBoundary'
import useProfileStore from './store/useProfileStore'
import useAdaptiveExperience from './hooks/useAdaptiveExperience'
import { buildGalaxyModel, guardGalaxyModel } from './features/galaxy/galaxyBuilder'
import { PROBE_GATE_MAX_MS, readHadSession, resolveShellEntry } from './app/shellEntry'

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

  // The galaxy is the living background of the whole app, not a page. Render
  // it for any signed-in shell — not only when a galaxy route published a
  // scene. When no route is driving the stage, fall back to the user's REAL
  // sky built from the persisted profile cache (or ambient stars/nebulae
  // before a profile exists).
  const sessionToken = useAuthStore((s) => s.sessionToken)
  const providers = useAuthStore((s) => s.providers)
  const canAccessShell = Boolean(sessionToken || providers.spotify.connected || providers.lastfm.connected)
  const persistedProfile = useProfileStore((s) => s.profile)
  const adaptive = useAdaptiveExperience()

  const ambientModel = useMemo(() => {
    if (model) return null
    if (!(persistedProfile?.topArtists?.length || persistedProfile?.genres?.length)) return null
    try {
      return guardGalaxyModel(buildGalaxyModel(persistedProfile))
    } catch {
      return null
    }
  }, [model, persistedProfile])

  // Mirror the shell-entry rule: optimistic entry (recent-session evidence)
  // gets its galaxy backdrop too, not just confirmed-live sessions.
  if (!active && !canAccessShell && !readHadSession()) return null

  // GalaxySceneBoundary is non-negotiable here: PersistentGalaxy sits at the
  // app root, OUTSIDE every route boundary. An unguarded 3D crash would
  // unmount the entire app — indistinguishable from an auth lockout. With the
  // boundary, a scene fault costs only the backdrop and logs
  // [GALAXY_SCENE_ERROR]; the shell and every route stay usable.
  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <GalaxySceneBoundary resetKey={(model || ambientModel)?.metadata?.source || 'ambient'}>
        <Suspense fallback={null}>
          <GalaxyStage
            model={model || ambientModel}
            sparseMode={sparseMode}
            lowPower={lowPower || adaptive.lowPowerMode}
            reducedMotion={reducedMotion || adaptive.prefersReducedMotion}
            webglEnabled={webglEnabled && adaptive.webglSupported !== false}
            traversalEnabled={traversalEnabled}
            scanPulseCount={scanPulseCount}
            onScanPulse={onScanPulse}
            autoRotateSpeed={autoRotateSpeed}
            extraChildren={extraChildren}
          />
        </Suspense>
      </GalaxySceneBoundary>
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
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Loud, full surface so the real throw is never swallowed into the soft
    // "orbit still settling" fallback. Logs message, originating stack, and the
    // React component stack (which component threw).
    console.error('[ROUTE_CRASH]', error?.message || error)
    console.error('[ROUTE_CRASH] stack:', error?.stack)
    console.error('[ROUTE_CRASH] componentStack:', info?.componentStack)
    this.setState({ componentStack: info?.componentStack || '' })
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender(this.state.error, this.state.componentStack)
      }
      return this.props.fallback
    }
    return this.props.children
  }
}

function ProtectedRouteFallback() {
  // NO reload button here: reloading restarts the probe timer from zero, so
  // against a dead backend it turned this brief gate into a permanent trap.
  // The hand-off to /login is IMPERATIVE (useNavigate on a timer owned by this
  // component) so it cannot be defeated by parent re-render/remount mechanics —
  // if this screen is on for PROBE_GATE_MAX_MS, it leaves. Full stop.
  const navigate = useNavigate()
  useEffect(() => {
    const timer = setTimeout(() => navigate('/login', { replace: true }), PROBE_GATE_MAX_MS)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="noire-panel max-w-xl rounded-[28px] p-8 text-center">
        <p className="page-header-kicker mb-2">Opening the door</p>
        <h2 className="text-2xl font-semibold text-white">Finding your session.</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          One quick check and you are in. If the signal is quiet, this hands you to sign-in by itself in a few seconds.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-block noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
        >
          Continue to sign-in
        </Link>
      </div>
    </div>
  )
}

function ShellCrashFallback({ error, componentStack }) {
  // First few component frames — enough to identify the crashing surface from
  // a single screenshot, without dumping the whole tree on the user.
  const stackPreview = String(componentStack || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('  ·  ')
  // DISTINCT from the boot gate on purpose: a render crash inside the shell
  // used to reuse the gate's copy, making a crashed dashboard indistinguishable
  // from an auth lockout. This screen names the real error so a single
  // screenshot identifies the failure.
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="noire-panel max-w-xl rounded-[28px] p-8 text-center">
        <p className="page-header-kicker mb-2">A surface cracked</p>
        <h2 className="text-2xl font-semibold text-white">This page hit a render fault.</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Your session is fine — one surface crashed while drawing. The exact fault is below and in the console as [ROUTE_CRASH].
        </p>
        {error ? (
          <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-xs text-amber-200/90 break-words">{String(error?.message || error)}</p>
        ) : null}
        {stackPreview ? (
          <p className="mt-2 rounded-xl bg-black/30 px-3 py-2 text-[10px] leading-relaxed text-gray-400 break-words">{stackPreview}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
          >
            Try again
          </button>
          <Link to="/login" className="noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white">
            Continue to sign-in
          </Link>
        </div>
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
  const canAccessShell = Boolean(sessionToken || providers.spotify.connected || providers.lastfm.connected)
  // The gate must never be a terminal state: after PROBE_GATE_MAX_MS this
  // timer forces one re-render so resolveShellEntry falls through to /login
  // even if the very first session probe is still hanging on a cold backend.
  const [probeStart] = React.useState(() => Date.now())
  const [, forceTick] = React.useReducer((tick) => tick + 1, 0)
  useEffect(() => {
    const timer = setTimeout(forceTick, PROBE_GATE_MAX_MS + 250)
    return () => clearTimeout(timer)
  }, [])

  // Entry is decided on EVIDENCE, not on a live backend answer (see
  // shellEntry.js): a returning user enters immediately on cold load even if
  // bootstrap is hanging against a cold-started backend or errors; only a
  // confirmed no-session routes to /login. Every panel owns its own
  // loading/failed state — one slow surface can never hold the app.
  const entry = resolveShellEntry({
    canAccessShell,
    hadRecentSession: readHadSession(),
    bootPhase,
    probeElapsedMs: Date.now() - probeStart,
  })
  if (entry === 'enter') return children
  if (entry === 'gate') return <ProtectedRouteFallback />
  return <Navigate to="/login" replace />
}

function ProtectedShell({ children }) {
  const location = useLocation()

  return (
    <ProtectedRoute>
      <RouteCrashBoundary
        resetKey={location.pathname}
        fallbackRender={(error, componentStack) => <ShellCrashFallback error={error} componentStack={componentStack} />}
      >
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
