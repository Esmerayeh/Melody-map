import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import PageLoader from './components/PageLoader'
import useStore from './store/useStore'
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

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
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  )
}

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppShell({ children }) {
  const cinemaMode = useStore((s) => s.cinemaMode)
  if (cinemaMode) {
    return <div className="h-screen overflow-hidden bg-surface">{children}</div>
  }
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

// Inner router component so useLocation works inside Router
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login"           element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/spotify-success" element={<SpotifySuccess />} />
        <Route path="/lastfm-success"  element={<LastfmSuccess />} />

        <Route path="/" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><Dashboard /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/galaxy" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><MusicMap /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/discover" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><Discover /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/playlists" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><Playlists /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><Analytics /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/soulmate" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><MusicSoulmate /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/soulmate/:identifier" element={<PageWrapper><MusicSoulmate /></PageWrapper>} />
        <Route path="/aesthetic" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><MusicAesthetic /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><Profile /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/auralith" element={
          <ProtectedRoute>
            <AppShell><PageWrapper><Auralith /></PageWrapper></AppShell>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
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
    const spotifyToken  = localStorage.getItem('spotify_token')
    const spotifyExpiry = localStorage.getItem('spotify_token_expiry')
    const lastfmSession = localStorage.getItem('lastfm_session')
    const lastfmUser    = localStorage.getItem('lastfm_username')

    if (spotifyToken) {
      // Check if token is expired
      if (spotifyExpiry && Date.now() > parseInt(spotifyExpiry, 10)) {
        logout()
      } else {
        setSpotifyToken(spotifyToken, localStorage.getItem('spotify_refresh_token'))
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
            style: { background: '#16161f', color: '#e2e8f0', border: '0.5px solid rgba(124,111,255,0.3)', backdropFilter: 'blur(16px)' },
            success: { iconTheme: { primary: '#7C6FFF', secondary: '#fff' } },
          }}
        />
      </Router>
    </QueryClientProvider>
  )
}
