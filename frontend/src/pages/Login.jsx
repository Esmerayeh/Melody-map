import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, Lock, User, Loader2, RadioTower, TimerReset, ShieldAlert, Eye, Radio } from "lucide-react"
import toast from "react-hot-toast"
import { authAPI } from "../services/api"
import useStore from "../store/useStore"
import useAuthStore from "../store/useAuthStore"
import useBackendWake from "../hooks/useBackendWake"
import useAdaptiveExperience from '../hooks/useAdaptiveExperience'
import { useGalaxyStageConfig } from '../features/galaxy/useGalaxyStage'

// Spotify glyph — kept inline so the connect button needs no asset.
function SpotifyGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [pendingProvider, setPendingProvider] = useState(null)
  const [form, setForm] = useState({ username: "", email: "", password: "" })
  const navigate = useNavigate()
  const setUser  = useStore((s) => s.setUser)
  const setSessionToken = useAuthStore((s) => s.setSessionToken)
  const setAuthUser = useAuthStore((s) => s.setUser)
  const { waking, wake, phase, message, timedOut } = useBackendWake()
  const adaptive = useAdaptiveExperience()

  // Put the living galaxy behind the login as a calm, ambient backdrop (model:
  // null → stars/nebulae/core, no data nodes). Honors reduced-motion / low-power
  // so signing in feels like easing into the universe, never nauseating.
  useGalaxyStageConfig(
    {
      model: null,
      sparseMode: adaptive.sparseGraphics,
      lowPower: adaptive.lowPowerMode,
      reducedMotion: adaptive.reducedMotion,
      webglEnabled: adaptive.webglSupported,
      traversalEnabled: false,
      autoRotateSpeed: adaptive.reducedMotion ? 0 : 0.05,
    },
    [adaptive.sparseGraphics, adaptive.lowPowerMode, adaptive.reducedMotion, adaptive.webglSupported],
  )

  // ── Auth logic (unchanged from Step 1) ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const fn = isLogin ? authAPI.login : authAPI.register
      const { data } = await fn(form)
      setSessionToken("cookie-session")
      setAuthUser({ id: data.user_id })
      setUser({ id: data.user_id })
      toast.success(isLogin ? "Welcome back!" : "Account created!")
      navigate("/")
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Something went wrong")
    } finally { setLoading(false) }
  }

  // Both providers ride the same cold-start-aware wake → backend OAuth initiation.
  const connectSpotify = () => {
    setPendingProvider('spotify')
    wake(`${import.meta.env.VITE_API_URL || ''}/auth/spotify/login`)
  }
  const connectLastfm = () => {
    setPendingProvider('lastfm')
    wake(`${import.meta.env.VITE_API_URL || ''}/auth/lastfm/login`)
  }

  // Entrance respects reduced-motion: static when reduced, a soft rise otherwise.
  const rise = adaptive.reducedMotion
    ? { initial: false }
    : { initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }

  const inputClass =
    "w-full rounded-[14px] border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-[#f3eee6] " +
    "placeholder:text-[rgba(214,205,189,0.4)] outline-none transition-colors focus:border-[#e0a35c]/55 " +
    "focus:ring-2 focus:ring-[#e0a35c]/25"

  return (
    <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5 py-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      {/* Warm vignette seats the glass over the live galaxy for legibility. Static. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-[1]"
        style={{ background: 'radial-gradient(ellipse 58% 52% at 50% 44%, rgba(6,5,16,0.62) 0%, transparent 72%)' }}
      />

      <motion.div
        {...rise}
        className="shell-glass w-full max-w-md rounded-[30px] px-7 py-9 shadow-[0_34px_100px_rgba(0,0,0,0.52)] sm:px-9"
      >
        {/* Brand + demo */}
        <div className="mb-8 flex items-center justify-between">
          <span className="text-[21px] leading-none text-[#f3eee6]" style={{ fontFamily: 'var(--mm-font-display)' }}>
            Melody Map
          </span>
          <Link
            to="/demo"
            className="shell-mono inline-flex items-center gap-1.5 text-[9px] text-[rgba(214,205,189,0.5)] outline-none transition-colors hover:text-[#e0a35c] focus-visible:text-[#e0a35c]"
          >
            <Eye className="h-3 w-3" /> Demo
          </Link>
        </div>

        {/* Kicker + editorial headline */}
        <p className="page-header-kicker mb-3">Enter the universe</p>
        <h1
          className="mb-3 text-[2rem] leading-[1.04]"
          style={{ fontFamily: 'var(--mm-font-display)', fontStyle: 'italic', color: 'var(--mm-color-copy)', textWrap: 'balance' }}
        >
          {isLogin ? 'Step back into your orbit.' : 'Your music, made living.'}
        </h1>
        <p className="mb-7 max-w-sm text-sm leading-relaxed text-[rgba(210,200,184,0.72)]">
          Connect once and your galaxy forms itself around your actual taste — every listen reshapes the universe.
        </p>

        {/* Connect actions — two clear ways in */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={connectSpotify}
            disabled={waking}
            className="group flex w-full items-center justify-center gap-3 rounded-[14px] py-3 text-sm font-semibold text-[#1a1206] outline-none transition-all hover:opacity-95 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#e0a35c]/70 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #e0a35c 0%, #ffb35a 52%, #f3d9b0 100%)' }}
          >
            {waking && pendingProvider === 'spotify'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing Spotify connection…</>
              : <><SpotifyGlyph className="h-5 w-5" /> Connect Spotify</>}
          </button>

          <button
            type="button"
            onClick={connectLastfm}
            disabled={waking}
            className="group flex w-full items-center justify-center gap-3 rounded-[14px] border border-[#c97b7b]/30 bg-white/[0.035] py-3 text-sm font-semibold text-[#f3eee6] outline-none transition-all hover:border-[#c97b7b]/55 hover:bg-white/[0.06] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#c97b7b]/60 disabled:opacity-70"
          >
            {waking && pendingProvider === 'lastfm'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing Last.fm connection…</>
              : <><Radio className="h-5 w-5 text-[#d98c8c]" /> Connect Last.fm</>}
          </button>
        </div>

        {/* Quiet auth-route status (reuses the cold-start aware wake state) */}
        <div className="mt-4 flex items-start gap-2.5 rounded-[16px] border border-white/8 bg-white/[0.025] px-3.5 py-3">
          <span className="mt-0.5 text-[#e0a35c]">
            {phase === "cold-start"
              ? <TimerReset className="h-3.5 w-3.5" />
              : phase === "redirecting"
              ? <RadioTower className="h-3.5 w-3.5" />
              : timedOut
              ? <ShieldAlert className="h-3.5 w-3.5" />
              : <RadioTower className="h-3.5 w-3.5" />}
          </span>
          <p className="text-[11px] leading-relaxed text-[rgba(214,205,189,0.6)]">
            {waking
              ? message
              : "The shell appears instantly. If the signal is waking, you'll see it here — never a frozen screen."}
          </p>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="shell-mono text-[9px] text-[rgba(214,205,189,0.4)]">or with email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email / password (kept) */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(214,205,189,0.45)]" />
              <input
                type="text" placeholder="Username" className={inputClass}
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required
              />
            </div>
          )}
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(214,205,189,0.45)]" />
            <input
              type="email" placeholder="Email address" className={inputClass}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(214,205,189,0.45)]" />
            <input
              type="password" placeholder="Password" className={inputClass}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#e0a35c]/25 bg-white/[0.04] py-3 text-sm font-semibold text-[#f3eee6] outline-none transition-all hover:border-[#e0a35c]/45 hover:bg-white/[0.06] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#e0a35c]/60 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? "Sign in with email" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[rgba(214,205,189,0.55)]">
          {isLogin ? "New to Melody Map? " : "Already have an orbit? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-[#e0a35c] outline-none transition-colors hover:text-[#ffb35a] focus-visible:text-[#ffb35a]"
          >
            {isLogin ? "Create an account" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  )
}
