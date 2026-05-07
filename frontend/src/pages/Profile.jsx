import { motion } from 'framer-motion'
import {
  BarChart3,
  Brain,
  Disc3,
  Heart,
  LogOut,
  Music2,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useAuthStore from '../store/useAuthStore'
import useProfileStore from '../store/useProfileStore'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicSourceCard from '../components/MusicSourceCard'
import ProfileBootPanel from '../components/ProfileBootPanel'
import { MOTION_TOKENS } from '../features/motion/motionTokens'
import { authAPI } from '../services/api'

function StatusChip({ tone = 'violet', children, icon: Icon }) {
  const styles = {
    violet: { color: '#cbb1ff', borderColor: 'rgba(143,117,255,0.24)', background: 'rgba(143,117,255,0.12)' },
    sky: { color: '#a9d4ff', borderColor: 'rgba(125,175,255,0.22)', background: 'rgba(96,165,250,0.12)' },
    green: { color: '#82e8a5', borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(34,197,94,0.1)' },
    rose: { color: '#f5a6c9', borderColor: 'rgba(244,114,182,0.22)', background: 'rgba(244,114,182,0.1)' },
    amber: { color: '#f8c67e', borderColor: 'rgba(251,191,36,0.22)', background: 'rgba(251,191,36,0.1)' },
  }

  const style = styles[tone] || styles.violet

  return (
    <span className="noire-chip text-[11px]" style={style}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  )
}

function MiniStat({ label, value, tone }) {
  const colors = {
    violet: '#cbb1ff',
    rose: '#f5a6c9',
    sky: '#a9d4ff',
  }

  return (
    <div className="noire-info-card flex flex-col items-center justify-center gap-1 px-4 py-4 text-center">
      <span className="text-xl font-semibold" style={{ color: colors[tone] || colors.violet }}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</span>
    </div>
  )
}

export default function Profile() {
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected = useStore((s) => s.lastfmConnected)
  const lastfmUsername = useStore((s) => s.lastfmUsername)
  const logout = useStore((s) => s.logout)
  const clearAllAuth = useAuthStore((s) => s.clearAllAuth)
  const clearProfile = useProfileStore((s) => s.clearProfile)
  const navigate = useNavigate()

  const { profile: musicProfile, phase } = useMusicProfile({ autoFetch: true })
  const profile = musicProfile?.userProfile || null

  const handleLogout = async () => {
    try {
      await authAPI.logout()
      await Promise.allSettled([authAPI.logoutSpotify(), authAPI.logoutLastfm()])
    } catch {
      // Local logout still needs to succeed if the network is unavailable.
    }
    logout()
    clearAllAuth()
    clearProfile()
    navigate('/login')
  }

  if (phase === 'loading' && !musicProfile) {
    return (
      <ProfileBootPanel
        variant="loading"
        title="Your presence is tuning in."
        subtitle="We are gathering your profile signal."
        detail="Hold steady."
      />
    )
  }

  if (phase === 'error' && !musicProfile) {
    return (
      <ProfileBootPanel
        variant="error"
        title="We could not load your presence."
        subtitle="The listening profile is not reachable right now."
        detail="Refresh once and your profile should return."
        actionLabel="Reload the profile"
        onAction={() => window.location.reload()}
      />
    )
  }

  const displayName = profile?.name || lastfmUsername || 'Music Explorer'
  const avatar = profile?.image
  const isConnected = spotifyConnected || lastfmConnected
  const genres = musicProfile?.genres?.slice(0, 6) || []
  const metrics = musicProfile?.analyticsMetrics || null
  const mbti = musicProfile?.mbti || null

  let personality = mbti ? mbti.name : 'Sonic Explorer'
  if (!mbti && metrics) {
    const e = (metrics.energyScore || 50) / 100
    const v = (metrics.valenceScore || 50) / 100
    if (e < 0.45 && v < 0.45) personality = 'Nocturnal Dreamer'
    else if (e > 0.65) personality = 'Electric Wanderer'
    else if (v > 0.6 && e < 0.55) personality = 'Velvet Romantic'
  }

  const quickLinks = [
    { to: '/galaxy', icon: Disc3, label: 'Music Galaxy', desc: 'touch the stars that hold your taste', tone: '#7C6FFF' },
    { to: '/aesthetic', icon: Sparkles, label: 'Aesthetic Board', desc: 'the atmosphere you live in', tone: '#FBBF24' },
    { to: '/soulmates', icon: Heart, label: 'Soulmates', desc: 'see where your worlds meet', tone: '#FF5DA2' },
    { to: '/analytics', icon: BarChart3, label: 'Signal Reading', desc: 'a deeper look at movement and light', tone: '#34D399' },
    { to: '/identity', icon: Brain, label: 'Music Identity', desc: 'enter the full inner reading', tone: '#60A5FA' },
  ]

  return (
    <div className="cosmic-page max-w-5xl space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOTION_TOKENS.focusSettle}
        className="mb-2"
      >
        <p className="page-header-kicker mb-2">The Presence</p>
        <h1 className="page-header-title">Profile</h1>
        <p className="page-header-copy mt-3">A quieter card for the person at the center of the constellation.</p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_TOKENS.focusSettle, delay: 0.04 }}
        className="noire-orb-panel overflow-hidden p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(168,132,255,0.14),transparent_28%),radial-gradient(circle_at_18%_82%,rgba(244,114,182,0.08),transparent_24%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="relative shrink-0">
            <div className="absolute inset-[-6px] rounded-[28px] bg-[radial-gradient(circle,rgba(167,139,250,0.24),transparent_64%)] blur-2xl" />
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="relative z-10 h-24 w-24 rounded-[24px] object-cover border border-white/10 shadow-[0_0_32px_rgba(124,111,255,0.18)]"
              />
            ) : (
              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,111,255,0.24),rgba(255,93,162,0.14))] text-4xl font-semibold text-white shadow-[0_0_32px_rgba(124,111,255,0.16)]">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            {isConnected && <div className="absolute -bottom-1 -right-1 z-20 h-5 w-5 rounded-full border-2 border-[#090814] bg-emerald-400" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold text-white">{displayName}</h2>
              {profile?.email && <p className="text-sm text-gray-500">{profile.email}</p>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusChip tone="violet" icon={Sparkles}>{personality}</StatusChip>
              {mbti && <StatusChip tone="sky" icon={Brain}>{mbti.type}</StatusChip>}
              {spotifyConnected && <StatusChip tone="green">Spotify connected</StatusChip>}
              {lastfmConnected && <StatusChip tone="rose">Last.fm connected</StatusChip>}
              {profile?.product && (
                <StatusChip tone="amber" icon={Zap}>
                  {profile.product === 'premium' ? 'Spotify Premium' : 'Spotify Free'}
                </StatusChip>
              )}
            </div>

            {genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span key={g.genre} className="noire-chip text-[11px] text-[#bba8ff]">
                    {g.genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {profile && (
          <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniStat label="Followers" value={profile.followers?.toLocaleString() || 'soft signal'} tone="violet" />
            <MiniStat label="Country" value={profile.country || 'soft signal'} tone="rose" />
            <MiniStat label="Plan" value={profile.product || 'soft signal'} tone="sky" />
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_TOKENS.panel, delay: 0.08 }}
        className="noire-info-card p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Music2 className="h-4 w-4 text-indigo-300" />
          <h3 className="text-sm font-semibold text-white">Connected sources</h3>
        </div>
        <MusicSourceCard />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_TOKENS.panel, delay: 0.12 }}
        className="noire-info-card p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-300" />
          <h3 className="text-sm font-semibold text-white">Ways through the system</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickLinks.map(({ to, icon: Icon, label, desc, tone }) => (
            <motion.div key={to} whileHover={{ y: -2, scale: 1.01 }} transition={MOTION_TOKENS.hoverNotice}>
              <Link to={to} className="noire-action-card block p-4">
                <div
                  className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl border"
                  style={{ borderColor: `${tone}28`, background: `${tone}18` }}
                >
                  <Icon className="h-4 w-4" style={{ color: tone }} />
                </div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="mt-1 text-xs text-gray-500">{desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_TOKENS.panel, delay: 0.16 }}
        className="noire-panel-soft border border-rose-400/10 p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-rose-300">Session</h3>
        <motion.button
          onClick={handleLogout}
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.985 }}
          transition={MOTION_TOKENS.hoverNotice}
          className="noire-chip text-rose-300"
          style={{ borderColor: 'rgba(244,114,182,0.18)', background: 'rgba(244,114,182,0.08)' }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </motion.button>
      </motion.section>
    </div>
  )
}
