import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Music2, Compass, ListMusic, BarChart3, Heart, Sparkles, LayoutDashboard, Disc3, LogOut, Menu, X } from 'lucide-react'
import useStore from '../store/useStore'
import useAuthStore from '../store/useAuthStore'
import useProfileStore from '../store/useProfileStore'
import { ProviderBadge } from './MusicSourceCard'
import { authAPI } from '../services/api'

const navItems = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/galaxy',    icon: Disc3,           label: 'Galaxy' },
  { path: '/discover',  icon: Compass,         label: 'Discover' },
  { path: '/playlists', icon: ListMusic,       label: 'Playlists' },
  { path: '/analytics', icon: BarChart3,       label: 'Analytics' },
  { path: '/soulmates', icon: Heart,           label: 'Soulmates' },
  { path: '/aesthetic', icon: Sparkles,        label: 'Aesthetic' },
]

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const logout = useStore((s) => s.logout)
  const clearAllAuth = useAuthStore((s) => s.clearAllAuth)
  const clearProfile = useProfileStore((s) => s.clearProfile)
  const navigate = useNavigate()

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

  return (
    <nav className="sticky top-0 z-50 bg-[#0d1025]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Music2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Melody Map
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ProviderBadge />
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              className="touch-target md:hidden rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="touch-target flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
