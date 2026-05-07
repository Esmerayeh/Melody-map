import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

const TOP_NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/discover', label: 'Discover' },
  { to: '/galaxy', label: 'Galaxy' },
  { to: '/soulmates', label: 'Soulmates' },
  { to: '/aesthetic', label: 'Aesthetic' },
  { to: '/auralith', label: 'Auralith' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/identity', label: 'Music Identity' },
  { to: '/profile', label: 'Profile' },
]

export default function TopBar() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const username = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const avatar = useStore((s) => s.spotifyProfile?.image)

  return (
    <header
      className="sticky top-0 z-40 shrink-0 px-3 py-2.5 sm:px-5 lg:px-6 sm:py-3"
      style={{
        background: 'rgba(8,8,18,0.72)',
        backdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
      }}
    >
      <div
        className="flex items-center gap-2.5 rounded-[20px] border border-white/[0.06] px-3 py-2.5 sm:gap-4 sm:rounded-[24px] sm:px-4 sm:py-3"
        style={{
          background: 'linear-gradient(180deg, rgba(17,15,35,0.72), rgba(10,9,22,0.56))',
          boxShadow: '0 10px 36px rgba(0,0,0,0.26)',
        }}
      >
        <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-300"
            style={{ color: focused ? '#8f75ff' : 'rgba(174,166,201,0.55)' }}
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
              background: focused ? 'rgba(143,117,255,0.08)' : 'rgba(255,255,255,0.035)',
              border: `1px solid ${focused ? 'rgba(143,117,255,0.38)' : 'rgba(255,255,255,0.07)'}`,
              boxShadow: focused ? '0 0 26px rgba(143,117,255,0.12)' : 'none',
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
                style={{ boxShadow: '0 0 0 1px rgba(143,117,255,0.18)' }}
              />
            )}
          </AnimatePresence>
        </div>

        <nav className="hidden xl:flex items-center gap-1 mx-auto rounded-2xl border border-white/[0.05] bg-white/[0.03] p-1">
          {TOP_NAV.map((item) => (
            <motion.div key={item.to} whileHover={{ y: -1 }} transition={MOTION_TOKENS.chip}>
              <NavLink
              key={item.to}
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
                      background: 'linear-gradient(135deg, rgba(143,117,255,0.22), rgba(242,141,223,0.12))',
                      boxShadow: 'inset 0 0 0 1px rgba(143,117,255,0.24), 0 0 18px rgba(143,117,255,0.12)',
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
              style={{ background: '#f28ddf', boxShadow: '0 0 8px #f28ddf' }}
            />
          </motion.button>

          <motion.div
            whileHover={{ scale: 1.02, y: -1 }}
            transition={MOTION_TOKENS.hoverIn}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-2 py-1.5 cursor-pointer"
            style={{ boxShadow: '0 0 14px rgba(143,117,255,0.08)' }}
          >
            <div
              className="w-8 h-8 rounded-full overflow-hidden"
              style={{ border: '1px solid rgba(143,117,255,0.22)', boxShadow: '0 0 12px rgba(143,117,255,0.16)' }}
            >
              {avatar ? (
                <img src={avatar} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xs font-black"
                  style={{ background: 'linear-gradient(135deg, rgba(143,117,255,0.32), rgba(242,141,223,0.2))', color: '#ddd2ff' }}
                >
                  {username[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="hidden 2xl:block pr-2">
              <p className="text-xs font-semibold text-white">{username}</p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/30">enter your orbit</p>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  )
}
