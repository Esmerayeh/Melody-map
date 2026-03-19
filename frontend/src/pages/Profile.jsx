import { motion } from 'framer-motion'
import { User, Music2, LogOut, Shield, Zap, Disc3, Heart, Sparkles, BarChart3, Brain } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicSourceCard from '../components/MusicSourceCard'

export default function Profile() {
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected  = useStore((s) => s.lastfmConnected)
  const lastfmUsername   = useStore((s) => s.lastfmUsername)
  const logout           = useStore((s) => s.logout)
  const navigate         = useNavigate()

  const { profile: musicProfile } = useMusicProfile({ autoFetch: true })
  const profile = musicProfile?.userProfile || null

  const handleLogout = () => { logout(); navigate('/login') }

  const displayName = profile?.name || lastfmUsername || 'Music Explorer'
  const avatar      = profile?.image
  const isConnected = spotifyConnected || lastfmConnected

  const genres  = musicProfile?.genres?.slice(0, 6) || []
  const metrics = musicProfile?.analyticsMetrics || null
  const mbti    = musicProfile?.mbti || null   // pre-computed in useMusicProfile

  // Personality label — use MBTI name when available, fallback to heuristic
  let personality = mbti ? mbti.name : 'Sonic Explorer'
  if (!mbti && metrics) {
    const e = (metrics.energyScore || 50) / 100
    const v = (metrics.valenceScore || 50) / 100
    if (e < 0.45 && v < 0.45)     personality = 'Nocturnal Dreamer'
    else if (e > 0.65)             personality = 'Electric Wanderer'
    else if (v > 0.6 && e < 0.55) personality = 'Velvet Romantic'
  }

  const QUICK_LINKS = [
    { to: '/galaxy',    icon: Disc3,    label: 'Music Galaxy',    desc: 'Explore your 3D taste map',  color: '#7C6FFF' },
    { to: '/aesthetic', icon: Sparkles, label: 'Aesthetic Board', desc: 'Your visual moodboard',      color: '#FBBF24' },
    { to: '/soulmate',  icon: Heart,    label: 'Soulmates',       desc: 'Find your sonic twin',       color: '#FF5DA2' },
    { to: '/analytics', icon: BarChart3,label: 'Analytics',       desc: 'Deep listening stats',       color: '#34D399' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="mb-8">
        <p className="text-xs text-gray-600 uppercase tracking-[0.25em] mb-1">Your account</p>
        <h1 className="text-4xl font-black text-white">Profile</h1>
      </motion.div>

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 260, damping: 28 }}
        className="rounded-3xl p-8 mb-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.1), rgba(255,93,162,0.05), rgba(0,0,0,0.4))', border: '1px solid rgba(124,111,255,0.2)' }}
      >
        {/* Ambient orbs */}
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(124,111,255,0.12)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'rgba(255,93,162,0.08)' }} />

        <div className="flex items-start gap-6 relative z-10">
          {/* Avatar with glow ring */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl animate-glow-pulse" style={{ margin: '-3px' }} />
            {avatar
              ? <img src={avatar} alt={displayName}
                  className="w-24 h-24 rounded-2xl object-cover relative z-10"
                  style={{ boxShadow: '0 0 32px rgba(124,111,255,0.4), 0 0 0 2px rgba(124,111,255,0.3)' }} />
              : <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-white relative z-10"
                  style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.3), rgba(255,93,162,0.2))', boxShadow: '0 0 32px rgba(124,111,255,0.3), 0 0 0 2px rgba(124,111,255,0.25)' }}>
                  {displayName[0]?.toUpperCase()}
                </div>
            }
            {isConnected && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 z-20"
                style={{ borderColor: '#070710' }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-white">{displayName}</h2>
            {profile?.email && <p className="text-gray-500 text-sm mt-0.5">{profile.email}</p>}

            {/* Personality / MBTI badge */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(124,111,255,0.15)', color: '#a5b4fc', border: '1px solid rgba(124,111,255,0.25)' }}>
                <Sparkles className="w-3 h-3" />
                {personality}
              </div>
              {mbti && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.22)' }}>
                  <Brain className="w-3 h-3" />
                  {mbti.type}
                </div>
              )}
            </div>

            {/* Connection badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              {spotifyConnected && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Spotify Connected
                </span>
              )}
              {lastfmConnected && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Last.fm Connected
                </span>
              )}
              {profile?.product && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(124,111,255,0.1)', color: '#a5b4fc', border: '1px solid rgba(124,111,255,0.2)' }}>
                  <Zap className="w-3 h-3" />
                  {profile.product === 'premium' ? 'Spotify Premium' : 'Spotify Free'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {profile && (
          <div className="grid grid-cols-3 gap-3 mt-6 relative z-10">
            {[
              { label: 'Followers', value: profile.followers?.toLocaleString() || '—', color: '#7C6FFF' },
              { label: 'Country',   value: profile.country || '—',                      color: '#FF5DA2' },
              { label: 'Plan',      value: profile.product || '—',                      color: '#00D1FF' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center p-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                <span className="text-xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs text-gray-600 mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Genre tags */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5 relative z-10">
            {genres.map((g, i) => (
              <motion.span key={g.genre}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(124,111,255,0.1)', color: '#a5b4fc', border: '1px solid rgba(124,111,255,0.18)' }}>
                {g.genre}
              </motion.span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Music sources */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="glass-card rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Music2 className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-gray-200">Music Sources</h3>
        </div>
        <MusicSourceCard />
      </motion.div>

      {/* Quick links */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-gray-200">Quick Links</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ to, icon: Icon, label, desc, color }, i) => (
            <motion.div key={to} whileHover={{ y: -2, scale: 1.01 }}>
              <Link to={to} className="block p-4 rounded-xl transition-all group"
                style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
                <Icon className="w-4 h-4 mb-2 transition-colors" style={{ color }} />
                <p className="text-sm font-medium text-white group-hover:text-white transition-colors">{label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="rounded-2xl p-6"
        style={{ border: '1px solid rgba(239,68,68,0.12)', background: 'rgba(239,68,68,0.04)' }}>
        <h3 className="font-semibold text-sm text-red-400 mb-4">Session</h3>
        <motion.button onClick={handleLogout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </motion.button>
      </motion.div>
    </div>
  )
}
