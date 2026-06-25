import { useEffect, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Search, LogOut, EyeOff, Eye, WifiOff,
  Globe2, Compass, Heart,
  Sparkles, Wand2, Brain, User,
} from 'lucide-react'
import useStore from '../../store/useStore'
import useAuthStore from '../../store/useAuthStore'
import useProfileStore from '../../store/useProfileStore'
import { authAPI } from '../../services/api'

// Full route nav for the bottom dock — every shell destination. Warm accent per
// sector (zero purple), reused from the retired sidebar palette.
const DOCK_NAV = [
  { path: '/universe',       end: false, icon: Globe2,          short: 'Universe',  label: 'Universe',       color: '#c1337f' },
  { path: '/discover',       end: false, icon: Compass,         short: 'Discover',  label: 'Discover',       color: '#de83b4' },
  { path: '/soulmates',      end: false, icon: Heart,           short: 'Soulmates', label: 'Soulmates',      color: '#d15296' },
  { path: '/aesthetic',      end: false, icon: Sparkles,        short: 'Aesthetic', label: 'Aesthetic',      color: '#c1337f' },
  { path: '/auralith',       end: false, icon: Wand2,           short: 'Auralith',  label: 'Auralith',       color: '#d15296' },
  { path: '/identity',       end: true,  icon: Brain,           short: 'Identity',  label: 'Music identity', color: '#de83b4' },
  { path: '/profile',        end: false, icon: User,            short: 'Profile',   label: 'Profile',        color: '#c1337f' },
]

// Primary nav for the top glass strip — a curated subset.
const STRIP_NAV = [
  { path: '/universe',  end: false, label: 'Universe'  },
  { path: '/discover',  end: false, label: 'Discover'  },
  { path: '/soulmates', end: false, label: 'Soulmates' },
  { path: '/auralith',  end: false, label: 'Auralith'  },
  { path: '/identity',  end: true,  label: 'Identity'  },
]

// ── Cold-start banner (ported from the retired TopBar) ──────────────────────
function ColdStartBanner() {
  const bootPhase   = useAuthStore((s) => s.bootPhase)
  const backendWarm = useAuthStore((s) => s.backendWarm)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const waking = ['booting', 'probing_session'].includes(bootPhase) && !backendWarm
    if (!waking) { setShow(false); return undefined }
    const t = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(t)
  }, [bootPhase, backendWarm])

  if (!show) return null
  return (
    <div
      className="shell-chrome shell-chrome--fade shell-glass fixed left-1/2 top-2 z-[45] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-[11px] text-[#f4e6ee]"
      style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top))' }}
      role="status"
    >
      <WifiOff className="h-3 w-3 shrink-0" />
      <span>The signal is waking up — this takes ~15s on a cold start.</span>
    </div>
  )
}

// ── Brand mark (top-left) ───────────────────────────────────────────────────
function Brand() {
  return (
    <Link
      to="/"
      className="shell-chrome shell-chrome--fade fixed left-4 top-3 z-40 select-none sm:left-6 sm:top-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      aria-label="Melody Map — home"
    >
      <h1 className="text-[22px] leading-none text-[#f3eee6]" style={{ fontFamily: 'var(--mm-font-display)' }}>
        Melody Map
      </h1>
      <p className="shell-mono mt-1 text-[8px] text-[rgba(214,205,189,0.45)]">Cosmic Identity Portal</p>
    </Link>
  )
}

// ── Top-center glass nav strip + search ─────────────────────────────────────
function TopStrip() {
  const [query, setQuery] = useState('')
  return (
    <div
      className="shell-chrome shell-chrome--fade shell-glass fixed left-1/2 top-3 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-[14px] px-2.5 py-1.5 lg:flex"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      <nav className="flex items-center gap-0.5" aria-label="Primary">
        {STRIP_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className="shell-mono rounded-[10px] px-2.5 py-1.5 text-[9.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#c1337f]/70"
            style={({ isActive }) =>
              isActive
                ? { color: '#f4ead9', background: 'rgba(193,19,127,0.16)', boxShadow: 'inset 0 0 0 1px rgba(193,19,127,0.3)' }
                : { color: 'rgba(214,205,189,0.5)' }
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mx-1 h-5 w-px bg-white/10" />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[rgba(214,205,189,0.4)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your universe…"
          aria-label="Search"
          className="w-40 rounded-[10px] border border-white/10 bg-white/[0.05] py-1.5 pl-7 pr-3 text-[11px] text-[rgba(220,212,235,0.8)] outline-none transition-colors placeholder:text-[rgba(214,205,189,0.35)] focus:border-[#c1337f]/40"
        />
      </div>
    </div>
  )
}

// ── Top-right: status chip + avatar/orbit chip + logout ─────────────────────
function StatusCluster() {
  const backendWarm = useAuthStore((s) => s.backendWarm)
  const username = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const avatar   = useStore((s) => s.spotifyProfile?.image)
  const safeUsername = typeof username === 'string' && username.trim() ? username : 'You'

  const logout        = useStore((s) => s.logout)
  const clearAllAuth  = useAuthStore((s) => s.clearAllAuth)
  const clearProfile  = useProfileStore((s) => s.clearProfile)
  const navigate      = useNavigate()

  const handleLogout = async () => {
    try {
      await authAPI.logout()
      await Promise.allSettled([authAPI.logoutSpotify(), authAPI.logoutLastfm()])
    } catch {
      // Local logout must still succeed offline.
    }
    logout(); clearAllAuth(); clearProfile()
    navigate('/login')
  }

  const online = Boolean(backendWarm)

  return (
    <div
      className="shell-chrome shell-chrome--fade fixed right-4 top-3 z-40 flex items-center gap-2 sm:right-6 sm:top-4"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      {/* Status chip */}
      <div className="shell-glass hidden items-center gap-1.5 rounded-full px-3 py-1.5 sm:flex">
        <span
          className="shell-live-dot h-1.5 w-1.5 rounded-full"
          style={{ background: online ? '#74d4a0' : '#c1337f', boxShadow: `0 0 8px ${online ? '#74d4a0' : '#c1337f'}` }}
        />
        <span className="shell-mono text-[8.5px] text-[rgba(214,205,189,0.6)]">
          {online ? 'Auralith Online' : 'Auralith Waking'}
        </span>
      </div>

      {/* Avatar / orbit chip */}
      <Link
        to="/profile"
        aria-label={`${safeUsername} — open profile`}
        className="shell-glass flex items-center gap-2 rounded-full px-1.5 py-1.5 outline-none transition-colors hover:border-[#c1337f]/30 focus-visible:ring-2 focus-visible:ring-[#c1337f]/70"
      >
        <span className="h-7 w-7 overflow-hidden rounded-full ring-1 ring-[#c1337f]/25">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[11px] font-semibold"
              style={{ background: 'linear-gradient(135deg, rgba(193,19,127,0.34), rgba(160,84,136,0.2))', color: '#ebccdc' }}
            >
              {safeUsername[0]?.toUpperCase()}
            </span>
          )}
        </span>
        <span className="hidden pr-1 2xl:block">
          <span className="block text-[11px] font-medium leading-tight text-white">{safeUsername}</span>
          <span className="shell-mono block text-[7.5px] text-[rgba(214,205,189,0.4)]">Enter your orbit</span>
        </span>
      </Link>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Sign out"
        title="Sign out"
        className="shell-glass flex h-9 w-9 items-center justify-center rounded-full text-[rgba(214,205,189,0.55)] outline-none transition-colors hover:text-[#c1337f] focus-visible:ring-2 focus-visible:ring-[#c1337f]/70"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Bottom-center floating dock — full route nav ────────────────────────────
function Dock() {
  return (
    <div
      className="shell-chrome shell-chrome--fade fixed bottom-3 left-1/2 z-40 -translate-x-1/2"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav
        aria-label="All sections"
        className="shell-glass flex max-w-[95vw] items-center gap-1 overflow-x-auto rounded-[26px] px-3 py-2"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {DOCK_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            aria-label={item.label}
            title={item.label}
            className="group flex shrink-0 flex-col items-center gap-1 rounded-2xl px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#c1337f]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070512]"
          >
            {({ isActive }) => (
              <>
                <span
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border transition-transform duration-200 motion-safe:group-hover:-translate-y-1"
                  style={{
                    borderColor: isActive ? `${item.color}66` : 'rgba(255,255,255,0.08)',
                    background: isActive
                      ? `radial-gradient(circle, ${item.color}33, ${item.color}0a)`
                      : 'rgba(255,255,255,0.03)',
                    boxShadow: isActive ? `0 0 18px ${item.color}33` : 'none',
                  }}
                >
                  <item.icon
                    className="h-[18px] w-[18px]"
                    style={{ color: isActive ? item.color : 'rgba(214,205,189,0.62)' }}
                  />
                  {/* warm sector accent dot */}
                  <span
                    className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: item.color, opacity: isActive ? 1 : 0.5, boxShadow: isActive ? `0 0 6px ${item.color}` : 'none' }}
                  />
                </span>
                <span
                  className="shell-mono text-[7.5px] leading-none"
                  style={{ color: isActive ? item.color : 'rgba(214,205,189,0.5)' }}
                >
                  {item.short}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// ── Hide-UI toggle — stays visible (dimmed) so the chrome is recoverable ─────
function HideUiToggle() {
  const uiHidden       = useStore((s) => s.uiHidden)
  const toggleUiHidden = useStore((s) => s.toggleUiHidden)

  // Reflect state onto <body> so the CSS fade covers every chrome layer.
  useEffect(() => {
    document.body.classList.toggle('ui-hidden', uiHidden)
    return () => document.body.classList.remove('ui-hidden')
  }, [uiHidden])

  // Keyboard: H toggles (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'h' && e.key !== 'H') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      toggleUiHidden()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleUiHidden])

  return (
    <button
      type="button"
      onClick={toggleUiHidden}
      aria-pressed={uiHidden}
      aria-label={uiHidden ? 'Show interface' : 'Hide interface'}
      title={uiHidden ? 'Show UI (H)' : 'Hide UI (H)'}
      className="shell-glass fixed bottom-3 right-4 z-40 flex items-center gap-1.5 rounded-full px-3 py-2 text-[rgba(214,205,189,0.5)] outline-none transition-colors hover:text-[#c1337f] focus-visible:ring-2 focus-visible:ring-[#c1337f]/70 sm:right-6"
      style={{ marginBottom: 'env(safe-area-inset-bottom)', opacity: uiHidden ? 0.55 : 1 }}
    >
      {uiHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      <span className="shell-mono hidden text-[8.5px] sm:inline">{uiHidden ? 'Show UI' : 'Hide UI'}</span>
    </button>
  )
}

/**
 * ShellChrome
 * -----------
 * The floating immersive chrome that replaced the left sidebar. All pieces are
 * position:fixed, floating over the persistent galaxy (z-40, below page modals
 * at z-50). The galaxy stays edge-to-edge behind it.
 */
export default function ShellChrome() {
  return (
    <>
      <ColdStartBanner />
      <Brand />
      <TopStrip />
      <StatusCluster />
      <Dock />
      {/* Not faded by ui-hidden — it's the escape hatch back to the chrome. */}
      <HideUiToggle />
    </>
  )
}
