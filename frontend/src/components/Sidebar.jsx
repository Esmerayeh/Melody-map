import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Compass, Disc3,
  Heart, Sparkles, BarChart3, LogOut, User, Wand2, Brain,
} from 'lucide-react'
import useStore from '../store/useStore'
import { ProviderBadge } from './MusicSourceCard'
import { MOTION_TOKENS } from '../features/motion/motionTokens'
import { BrandWordmark } from './brand/BrandSystem'

const NAV = [
  { section: 'Explore' },
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', color: '#7C6FFF' },
  { path: '/discover', icon: Compass, label: 'Discover', color: '#00D1FF' },
  { path: '/galaxy', icon: Disc3, label: 'Galaxy', color: '#E040FB' },
  { section: 'Identity' },
  { path: '/soulmate', icon: Heart, label: 'Soulmates', color: '#FF5DA2' },
  { path: '/aesthetic', icon: Sparkles, label: 'Aesthetic', color: '#FBBF24' },
  { path: '/auralith', icon: Wand2, label: 'Auralith', color: '#C084FC' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics', color: '#2DD4BF' },
  { path: '/identity', icon: Brain, label: 'Music Identity', color: '#60A5FA' },
  { path: '/profile', icon: User, label: 'Profile', color: '#A78BFA' },
]

export default function Sidebar() {
  const logout = useStore((s) => s.logout)
  const navigate = useNavigate()
  const username = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const avatar = useStore((s) => s.spotifyProfile?.image)
  const safeUsername = typeof username === 'string' && username.trim() ? username : 'You'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-white/[0.05] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, rgba(10,9,21,0.96) 0%, rgba(7,7,17,0.96) 52%, rgba(8,8,19,0.98) 100%)' }}
    >
      <div
        className="absolute top-0 left-0 w-full h-60 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(143,117,255,0.12) 0%, transparent 72%)' }}
      />
      <div className="absolute inset-y-0 right-0 w-px pointer-events-none bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="px-5 h-16 border-b border-white/[0.05] shrink-0 relative z-10 flex items-center">
        <motion.div whileHover={{ scale: 1.02, x: 1 }} transition={MOTION_TOKENS.hoverIn}>
          <BrandWordmark compact />
        </motion.div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5 relative z-10">
        {NAV.map((item, i) => {
          if (item.section) {
            return (
              <p key={`${item.section}-${i}`} className="section-label px-3 pt-5 pb-2 first:pt-2">
                {item.section}
              </p>
            )
          }

          return (
            <motion.div key={item.path} whileHover={{ x: 1 }} transition={MOTION_TOKENS.chip}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                      style={isActive
                        ? { background: `${item.color}22`, boxShadow: `0 0 18px ${item.color}28` }
                        : { background: 'rgba(255,255,255,0.04)' }}
                    >
                      <item.icon className="w-3.5 h-3.5" style={isActive ? { color: item.color } : {}} />
                    </div>
                    <span className="tracking-[0.02em]">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        transition={MOTION_TOKENS.focus}
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: item.color, boxShadow: `0 0 9px ${item.color}` }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </motion.div>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/[0.05] space-y-3 shrink-0 relative z-10">
        <ProviderBadge />
        <div className="flex items-center justify-between px-2 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10">
              {avatar ? (
                <img src={avatar} alt={safeUsername} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, rgba(143,117,255,0.34), rgba(242,141,223,0.2))', color: '#e7ddff' }}
                >
                  {safeUsername[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="block text-sm text-slate-200 truncate font-medium">{safeUsername}</span>
              <span className="block text-[10px] uppercase tracking-[0.28em] text-white/25">enter your orbit</span>
            </div>
          </div>
          <motion.button
            onClick={handleLogout}
            title="Sign out"
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.985 }}
            transition={MOTION_TOKENS.hoverIn}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </aside>
  )
}
