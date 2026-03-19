import { useState } from 'react'
import { Search, Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'

export default function TopBar() {
  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const username = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const avatar   = useStore((s) => s.spotifyProfile?.image)

  return (
    <header className="sticky top-0 z-40 h-16 flex items-center gap-4 px-6 shrink-0"
      style={{ background: 'rgba(7,7,16,0.7)', backdropFilter: 'blur(24px)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-300"
          style={{ color: focused ? '#7C6FFF' : 'rgba(100,116,139,0.6)' }} />
        <input
          type="text"
          placeholder="Search artists, tracks, vibes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none transition-all duration-300"
          style={{
            background: focused ? 'rgba(124,111,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${focused ? 'rgba(124,111,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: focused ? '0 0 20px rgba(124,111,255,0.12)' : 'none',
          }}
        />
        <AnimatePresence>
          {focused && (
            <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ boxShadow: '0 0 0 1px rgba(124,111,255,0.2)' }} />
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Bell */}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="p-2 rounded-xl transition-all relative"
          style={{ color: 'rgba(100,116,139,0.7)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: '#FF5DA2', boxShadow: '0 0 6px #FF5DA2' }} />
        </motion.button>

        {/* Avatar */}
        <motion.div whileHover={{ scale: 1.05 }}
          className="w-8 h-8 rounded-full overflow-hidden cursor-pointer shrink-0"
          style={{ border: '1px solid rgba(124,111,255,0.3)', boxShadow: '0 0 12px rgba(124,111,255,0.2)' }}>
          {avatar
            ? <img src={avatar} alt={username} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.3), rgba(255,93,162,0.2))', color: '#a5b4fc' }}>
                {username[0]?.toUpperCase()}
              </div>
          }
        </motion.div>
      </div>
    </header>
  )
}
