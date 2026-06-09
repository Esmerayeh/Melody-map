import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Search, Bell, Wifi, WifiOff, Globe2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import useAuthStore from '../store/useAuthStore'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

// ── Cold-start banner ──────────────────────────────────────────────────────
// Shown for the first ~12 s after the session bootstrap starts, when the
// backend may still be waking up on Render free tier.
function ColdStartBanner() {
  const bootPhase    = useAuthStore((s) => s.bootPhase)
  const backendWarm  = useAuthStore((s) => s.backendWarm)
  const [show, setShow]   = useState(false)
  const [timer, setTimer] = useState(null)

  useEffect(() => {
    // Show the banner if bootstrap is still in-flight after 3 s
    const waking = ['booting', 'probing_session'].includes(bootPhase) && !backendWarm
    if (waking) {
      const t = setTimeout(() => setShow(true), 3000)
      setTimer(t)
    } else {
      setShow(false)
      if (timer) clearTimeout(timer)
    }
    return () => { if (timer) clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootPhase, backendWarm])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="cold-start"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center gap-2 bg-amber-900/40 px-4 py-1.5 text-[11px] text-amber-200 border-b border-amber-400/15"
        >
          <WifiOff className="h-3 w-3 shrink-0" />
          <span>The signal is waking up — this takes ~15 seconds on a cold start. The shell stays visible while it connects.</span>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="h-1 w-1 shrink-0 rounded-full bg-amber-300"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const TOP_NAV = [
  { to: '/universe',      label: 'Universe'        },
  { to: '/',              label: 'Dashboard'       },
  { to: '/discover',      label: 'Discover'        },
  { to: '/galaxy',        label: 'Galaxy'          },
  { to: '/soulmates',     label: 'Soulmates'       },
  { to: '/aesthetic',     label: 'Aesthetic'       },
  { to: '/auralith',      label: 'Auralith'        },
  { to: '/analytics',     label: 'Analytics'       },
  { to: '/identity',      label: 'Music identity'  },
  { to: '/profile',       label: 'Profile'         },
]

export default function TopBar() {
  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const username = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const avatar   = useStore((s) => s.spotifyProfile?.image)

  return (
    <div className="shrink-0">
      <ColdStartBanner />
      <header
        className="sticky top-0 z-40 px-3 py-2.5 sm:px-5 lg:px-6 sm:py-3"
        style={{
          background:     'rgba(8,8,18,0.72)',
          backdropFilter: 'blur(28px)',
          borderBottom:   '1px solid rgba(255,255,255,0.05)',
          paddingTop:     'calc(0.5rem + env(safe-area-inset-top))',
        }}
      >
        <div
          className="flex items-center gap-2.5 rounded-[20px] border border-white/[0.06] px-3 py-2.5 sm:gap-4 sm:rounded-[24px] sm:px-4 sm:py-3"
          style={{
            background: 'linear-gradient(180deg, rgba(17,15,35,0.72), rgba(10,9,22,0.56))',
            boxShadow:  '0 10px 36px rgba(0,0,0,0.26)',
          }}
        >
          {/* Universe shortcut */}
          <Link
            to="/universe"
            title="Open Universe"
            className="hidden shrink-0 items-center justify-center rounded-xl border border-[#e0a35c]/22 bg-[#e0a35c]/10 p-2 transition-all hover:bg-[#e0a35c]/18 sm:flex"
          >
            <Globe2 className="h-4 w-4 text-[#e0a35c]" />
          </Link>

          {/* Search */}
          <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-300"
              style={{ color: focused ? '#e0a35c' : 'rgba(174,166,201,0.55)' }}
            />
            <input
              type="text"
              placeholder="Search artists, tracks, moods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm outline-none transition-all duration-300 noire-input"
              style={{
                background: focused ? 'rgba(224,163,92,0.08)' : 'rgba(255,255,255,0.035)',
                border:     `1px solid ${focused ? 'rgba(224,163,92,0.38)' : 'rgba(255,255,255,0.07)'}`,
                boxShadow:  focused ? '0 0 26px rgba(224,163,92,0.12)' : 'none',
              }}
            />
            <AnimatePresence>
              {focused && (
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={MOTION_TOKENS.tooltip}
                  style={{ boxShadow: '0 0 0 1px rgba(224,163,92,0.18)' }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Nav */}
          <nav className="hidden xl:flex items-center gap-1 mx-auto rounded-2xl border border-white/[0.05] bg-white/[0.03] p-1">
            {TOP_NAV.map((item) => (
              <motion.div key={item.to} whileHover={{ y: -1 }} transition={MOTION_TOKENS.chip}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-xs font-semibold tracking-[0.04em] transition-all ${
                      isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: 'linear-gradient(135deg, rgba(224,163,92,0.22), rgba(201,123,123,0.12))',
                          boxShadow:  'inset 0 0 0 1px rgba(224,163,92,0.24), 0 0 18px rgba(224,163,92,0.12)',
                        }
                      : undefined
                  }
                >
                  {item.label}
                </NavLink>
              </motion.div>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.985 }}
              transition={MOTION_TOKENS.hoverIn}
              className="relative hidden rounded-2xl border border-white/[0.05] p-2.5 transition-all sm:block"
              style={{ color: 'rgba(196,185,226,0.65)', background: 'rgba(255,255,255,0.03)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            >
              <Bell className="w-4 h-4" />
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: '#c97b7b', boxShadow: '0 0 8px #c97b7b' }}
              />
            </motion.button>

            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              transition={MOTION_TOKENS.hoverIn}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-2 py-1.5 cursor-pointer"
              style={{ boxShadow: '0 0 14px rgba(224,163,92,0.08)' }}
            >
              <div
                className="w-8 h-8 rounded-full overflow-hidden"
                style={{ border: '1px solid rgba(224,163,92,0.22)', boxShadow: '0 0 12px rgba(224,163,92,0.16)' }}
              >
                {avatar ? (
                  <img src={avatar} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xs font-black"
                    style={{ background: 'linear-gradient(135deg, rgba(224,163,92,0.32), rgba(201,123,123,0.2))', color: '#f2ebe0' }}
                  >
                    {username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="hidden 2xl:block pr-2">
                <p className="text-xs font-semibold text-white">{username}</p>
                <p className="text-[10px] tracking-[0.16em] text-white/30">Enter your orbit</p>
              </div>
            </motion.div>
          </div>
        </div>
      </header>
    </div>
  )
}
