import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Music2, LayoutDashboard, Compass, Disc3,
  Heart, Sparkles, BarChart3, LogOut, User,
} from 'lucide-react'
import useStore from '../store/useStore'
import { ProviderBadge } from './MusicSourceCard'

const NAV = [
  { section: 'Explore' },
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard',  color: '#7C6FFF' },
  { path: '/discover',  icon: Compass,         label: 'Discover',   color: '#00D1FF' },
  { path: '/galaxy',    icon: Disc3,           label: 'Galaxy',     color: '#E040FB' },
  { section: 'You' },
  { path: '/soulmate',  icon: Heart,           label: 'Soulmates',  color: '#FF5DA2' },
  { path: '/aesthetic', icon: Sparkles,        label: 'Aesthetic',  color: '#FBBF24' },
  { path: '/analytics', icon: BarChart3,       label: 'Analytics',  color: '#2DD4BF' },
  { path: '/profile',   icon: User,            label: 'Profile',    color: '#A78BFA' },
]

export default function Sidebar() {
  const logout   = useStore((s) => s.logout)
  const navigate = useNavigate()
  const username = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const avatar   = useStore((s) => s.spotifyProfile?.image)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-white/[0.04] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, rgba(12,12,26,0.98) 0%, rgba(7,7,16,0.98) 100%)' }}>

      {/* Ambient glow */}
      <div className="absolute top-0 left-0 w-full h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(124,111,255,0.08) 0%, transparent 70%)' }} />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.04] shrink-0 relative z-10">
        <motion.div
          whileHover={{ scale: 1.08, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center shadow-glow-sm shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C6FFF, #FF5DA2)' }}
        >
          <Music2 className="w-4 h-4 text-white" />
        </motion.div>
        <span className="text-base font-bold text-gradient">Melody Map</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 relative z-10">
        {NAV.map((item, i) => {
          if (item.section) {
            return (
              <p key={i} className="section-label px-3 pt-5 pb-2 first:pt-2">
                {item.section}
              </p>
            )
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                    style={isActive
                      ? { background: `${item.color}22`, boxShadow: `0 0 12px ${item.color}33` }
                      : { background: 'rgba(255,255,255,0.04)' }
                    }>
                    <item.icon className="w-3.5 h-3.5" style={isActive ? { color: item.color } : {}} />
                  </div>
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                    />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/[0.04] space-y-3 shrink-0 relative z-10">
        <ProviderBadge />
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10">
              {avatar
                ? <img src={avatar} alt={username} className="w-full h-full object-cover" />
                : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.3), rgba(255,93,162,0.2))', color: '#C4B5FD' }}>
                    {username[0]?.toUpperCase()}
                  </div>
                )
              }
            </div>
            <span className="text-sm text-slate-300 truncate font-medium">{username}</span>
          </div>
          <button onClick={handleLogout} title="Sign out"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
