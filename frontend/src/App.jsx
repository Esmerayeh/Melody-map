import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import PageLoader from './components/PageLoader'
import useStore from './store/useStore'
import useExperienceStore from './store/useExperienceStore'
import useMusicProfile from './hooks/useMusicProfile'
import { applyVibeTheme, resetVibeTheme } from './services/vibeTheme'

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

// Spatial spring-physics page transitions — suggest depth between layers
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

class RouteCrashBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Protected route crashed during render', error)
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
    <div className="min-h-screen flex items-center justify-center px-6 app-shell-bg">
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
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
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
    return <div className="h-screen overflow-hidden bg-surface">{children}</div>
  }
  return (
    <div className="flex h-screen overflow-hidden app-shell-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden app-main-shell">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

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

function ExperienceBridge() {
  const location = useLocation()
  const isAuthenticated = useStore((state) => state.isAuthenticated)
  const { profile, loading, error, confidence, dataQuality } = useMusicProfile({
    autoFetch: isAuthenticated,
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
    setDataConfidence({
      overall: confidence?.labels?.overall || (loading ? 'tuning into your signal...' : 'soft signal'),
      analytics: confidence?.labels?.analytics || 'soft signal',
      identity: confidence?.labels?.identity || 'soft signal',
      galaxy: confidence?.labels?.galaxy || 'soft signal',
      soulmate: confidence?.labels?.soulmate || 'soft signal',
      degraded: Boolean(profile?.isDegraded || dataQuality?.degradedReasons?.length),
      hasAudioProfile: Boolean(dataQuality?.hasAudioProfile),
      profileReady: Boolean(profile),
      error: error || null,
    })
  }, [confidence, dataQuality, error, loading, profile, setDataConfidence])

  return null
}

// Inner router component so useLocation works inside Router
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <RouteCrashBoundary resetKey={location.pathname} fallback={<GlobalRouteFallback />}>
      <AnimatePresence mode="wait">
        <ExperienceBridge />
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
          <Route path="/spotify-success" element={<SpotifySuccess />} />
          <Route path="/lastfm-success" element={<LastfmSuccess />} />

          <Route path="/" element={
            <ProtectedShell><PageWrapper><Dashboard /></PageWrapper></ProtectedShell>
          } />
          <Route path="/galaxy" element={
            <ProtectedShell><PageWrapper><MusicMap /></PageWrapper></ProtectedShell>
          } />
          <Route path="/discover" element={
            <ProtectedShell><PageWrapper><Discover /></PageWrapper></ProtectedShell>
          } />
          <Route path="/playlists" element={
            <ProtectedShell><PageWrapper><Playlists /></PageWrapper></ProtectedShell>
          } />
          <Route path="/analytics" element={
            <ProtectedShell><PageWrapper><Analytics /></PageWrapper></ProtectedShell>
          } />
          <Route path="/soulmate" element={
            <ProtectedShell><PageWrapper><MusicSoulmate /></PageWrapper></ProtectedShell>
          } />
          <Route path="/soulmate/:identifier" element={<PageWrapper><MusicSoulmate /></PageWrapper>} />
          <Route path="/aesthetic" element={
            <ProtectedShell><PageWrapper><MusicAesthetic /></PageWrapper></ProtectedShell>
          } />
          <Route path="/profile" element={
            <ProtectedShell><PageWrapper><Profile /></PageWrapper></ProtectedShell>
          } />
          <Route path="/identity" element={
            <ProtectedShell><PageWrapper><MusicIdentity /></PageWrapper></ProtectedShell>
          } />
          <Route path="/auralith" element={
            <ProtectedShell><PageWrapper><Auralith /></PageWrapper></ProtectedShell>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </RouteCrashBoundary>
  )
}

export default function App() {
  const aestheticState  = useStore((s) => s.aestheticState)
  const vibeFeatures    = useStore((s) => s.vibeFeatures)
  const setSpotifyToken = useStore((s) => s.setSpotifyToken)
  const setLastfm       = useStore((s) => s.setLastfm)
  const logout          = useStore((s) => s.logout)

  // Rehydrate auth state on mount — handles page refresh
  useEffect(() => {
    const spotifyToken = safeStorageGet('spotify_token')
    const spotifyExpiry = safeStorageGet('spotify_token_expiry')
    const lastfmSession = safeStorageGet('lastfm_session')
    const lastfmUser = safeStorageGet('lastfm_username')

    if (spotifyToken) {
      const expiryValue = Number.parseInt(spotifyExpiry || '', 10)
      if (spotifyExpiry && Number.isFinite(expiryValue) && Date.now() > expiryValue) {
        logout()
      } else {
        setSpotifyToken(spotifyToken, safeStorageGet('spotify_refresh_token'))
      }
    } else if (lastfmSession && lastfmUser) {
      setLastfm(lastfmSession, lastfmUser)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'linear-gradient(180deg, rgba(23,20,43,0.92), rgba(12,11,24,0.96))',
              color: '#f3efff',
              border: '1px solid rgba(143,117,255,0.28)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 16px 38px rgba(0,0,0,0.4)',
            },
            success: { iconTheme: { primary: '#8f75ff', secondary: '#fff' } },
          }}
        />
      </Router>
    </QueryClientProvider>
  )
}
