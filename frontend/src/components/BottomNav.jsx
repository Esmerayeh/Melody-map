import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Compass, Disc3, Heart, Sparkles, BarChart3, Wand2, Brain } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

const NAV = [
  { path: '/',          icon: LayoutDashboard, label: 'Observatory', color: '#7C6FFF' },
  { path: '/discover',  icon: Compass,         label: 'Drift',       color: '#00D1FF' },
  { path: '/galaxy',    icon: Disc3,           label: 'Galaxy',    color: '#E040FB' },
  { path: '/soulmate',  icon: Heart,           label: 'Dual Orbit', color: '#FF5DA2' },
  { path: '/aesthetic', icon: Sparkles,        label: 'Atmosphere', color: '#FBBF24' },
  { path: '/auralith',  icon: Wand2,           label: 'Auralith',  color: '#C084FC' },
  { path: '/analytics', icon: BarChart3,       label: 'Signal',     color: '#34D399' },
  { path: '/identity',  icon: Brain,           label: 'Identity',   color: '#60A5FA' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ background: 'rgba(8,8,17,0.86)', backdropFilter: 'blur(28px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-around px-2 py-2.5">
        {NAV.map(({ path, icon: Icon, label, color }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return (
            <motion.div key={path} whileHover={{ y: -1 }} transition={MOTION_TOKENS.chip}>
            <NavLink to={path} end={path === '/'}
              className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-2xl transition-all relative min-w-[4.25rem]">
              {isActive && (
                <motion.div layoutId="bottomNavIndicator"
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: `${color}14`, border: `1px solid ${color}28`, boxShadow: `0 0 18px ${color}18` }}
                  transition={MOTION_TOKENS.focus} />
              )}
              <Icon className="w-5 h-5 relative z-10 transition-all duration-200"
                style={{ color: isActive ? color : 'rgba(176,166,202,0.52)', filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none' }} />
              <span className="text-[10px] font-medium relative z-10 transition-colors duration-200"
                style={{ color: isActive ? color : 'rgba(176,166,202,0.52)' }}>
                {label}
              </span>
            </NavLink>
            </motion.div>
          )
        })}
      </div>
    </nav>
  )
}
