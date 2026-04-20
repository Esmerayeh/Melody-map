import { lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import ProtectedShell from './ProtectedShell'
import ExperienceBridge from './ExperienceBridge'
import { RouteCrashBoundary, GlobalRouteFallback } from './RouteFallbacks'

const MusicMap = lazy(() => import('../pages/MusicMap'))
const Discover = lazy(() => import('../pages/Discover'))
const Playlists = lazy(() => import('../pages/Playlists'))
const Analytics = lazy(() => import('../pages/Analytics'))
const Login = lazy(() => import('../pages/Login'))
const SpotifySuccess = lazy(() => import('../pages/SpotifySuccess'))
const LastfmSuccess = lazy(() => import('../pages/LastfmSuccess'))
const MusicSoulmate = lazy(() => import('../pages/MusicSoulmate'))
const MusicAesthetic = lazy(() => import('../pages/MusicAesthetic'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Profile = lazy(() => import('../pages/Profile'))
const Auralith = lazy(() => import('../pages/Auralith'))
const MusicIdentity = lazy(() => import('../pages/MusicIdentity'))

const pageVariants = {
  initial: { opacity: 0, y: 18, scale: 0.98, filter: 'blur(4px)' },
  enter: {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 },
  },
  exit: {
    opacity: 0, y: -10, scale: 1.01, filter: 'blur(2px)',
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
}

function PageWrapper({ children }) {
  return (
    <motion.div variants={pageVariants} initial={false} animate="enter" exit="exit" style={{ height: '100%' }}>
      {children}
    </motion.div>
  )
}

export default function AnimatedRoutes() {
  const location = useLocation()

  return (
    <RouteCrashBoundary resetKey={location.pathname} fallback={<GlobalRouteFallback />}>
      <AnimatePresence mode="wait">
        <ExperienceBridge />
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
          <Route path="/spotify-success" element={<SpotifySuccess />} />
          <Route path="/lastfm-success" element={<LastfmSuccess />} />

          <Route path="/" element={<ProtectedShell><PageWrapper><Dashboard /></PageWrapper></ProtectedShell>} />
          <Route path="/galaxy" element={<ProtectedShell><PageWrapper><MusicMap /></PageWrapper></ProtectedShell>} />
          <Route path="/discover" element={<ProtectedShell><PageWrapper><Discover /></PageWrapper></ProtectedShell>} />
          <Route path="/playlists" element={<ProtectedShell><PageWrapper><Playlists /></PageWrapper></ProtectedShell>} />
          <Route path="/analytics" element={<ProtectedShell><PageWrapper><Analytics /></PageWrapper></ProtectedShell>} />
          <Route path="/soulmate" element={<ProtectedShell><PageWrapper><MusicSoulmate /></PageWrapper></ProtectedShell>} />
          <Route path="/soulmate/:identifier" element={<PageWrapper><MusicSoulmate /></PageWrapper>} />
          <Route path="/aesthetic" element={<ProtectedShell><PageWrapper><MusicAesthetic /></PageWrapper></ProtectedShell>} />
          <Route path="/profile" element={<ProtectedShell><PageWrapper><Profile /></PageWrapper></ProtectedShell>} />
          <Route path="/identity" element={<ProtectedShell><PageWrapper><MusicIdentity /></PageWrapper></ProtectedShell>} />
          <Route path="/auralith" element={<ProtectedShell><PageWrapper><Auralith /></PageWrapper></ProtectedShell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </RouteCrashBoundary>
  )
}
