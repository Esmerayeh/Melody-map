import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Compass, Disc3, Heart, Sparkles, BarChart3, Wand2 } from 'lucide-react'
import { motion } from 'framer-motion'

const NAV = [
  { path: '/',          icon: LayoutDashboard, label: 'Home',      color: '#7C6FFF' },
  { path: '/discover',  icon: Compass,         label: 'Discover',  color: '#00D1FF' },
  { path: '/galaxy',    icon: Disc3,           label: 'Galaxy',    color: '#E040FB' },
  { path: '/soulmate',  icon: Heart,           label: 'Soulmate',  color: '#FF5DA2' },
  { path: '/aesthetic', icon: Sparkles,        label: 'Aesthetic', color: '#FBBF24' },
  { path: '/auralith',  icon: Wand2,           label: 'Auralith',  color: '#C084FC' },
  { path: '/analytics', icon: BarChart3,       label: 'Analytics', color: '#34D399' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ background: 'rgba(7,7,16,0.85)', backdropFilter: 'blur(24px)', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-around px-1 py-2">
        {NAV.map(({ path, icon: Icon, label, color }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return (
            <NavLink key={path} to={path} end={path === '/'}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all relative">
              {isActive && (
                <motion.div layoutId="bottomNavIndicator"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: `${color}12`, border: `0.5px solid ${color}30` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
              )}
              <Icon className="w-5 h-5 relative z-10 transition-all duration-200"
                style={{ color: isActive ? color : 'rgba(100,116,139,0.5)', filter: isActive ? `drop-shadow(0 0 6px ${color})` : 'none' }} />
              <span className="text-[10px] font-medium relative z-10 transition-colors duration-200"
                style={{ color: isActive ? color : 'rgba(100,116,139,0.5)' }}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
