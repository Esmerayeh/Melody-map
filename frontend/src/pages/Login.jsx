import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Music2, Mail, Lock, User, Loader2 } from "lucide-react"
import toast from "react-hot-toast"
import { authAPI } from "../services/api"
import useStore from "../store/useStore"
import useBackendWake from "../hooks/useBackendWake"

function Particles() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    let raf
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener("resize", resize)
    const dots = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2, a: Math.random() * 0.5 + 0.1,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach((d) => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0) d.x = canvas.width; if (d.x > canvas.width) d.x = 0
        if (d.y < 0) d.y = canvas.height; if (d.y > canvas.height) d.y = 0
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(124,111,255," + d.a + ")"; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ username: "", email: "", password: "" })
  const navigate = useNavigate()
  const setUser  = useStore((s) => s.setUser)
  const { waking, wake } = useBackendWake()

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const fn = isLogin ? authAPI.login : authAPI.register
      const { data } = await fn(form)
      localStorage.setItem("token", data.token)
      localStorage.setItem("userId", data.user_id)
      setUser({ id: data.user_id })
      toast.success(isLogin ? "Welcome back!" : "Account created!")
      navigate("/")
    } catch (err) {
      toast.error(err.response?.data?.error || "Something went wrong")
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex overflow-hidden bg-surface">
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d0d1a 0%, #151528 100%)" }}>
        <Particles />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-brand-purple/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-brand-pink/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center shadow-glow-sm">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gradient">Melody Map</span>
        </div>
        <div className="relative z-10">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-5xl font-black text-white leading-tight mb-4">
            Your music,<br /><span className="text-gradient">visualized.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="text-slate-400 text-lg leading-relaxed max-w-sm">
            Explore your taste as a galaxy. Find your music soulmate. Generate aesthetic moodboards from your listening history.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-2 mt-8">
            {["dreamy", "nostalgic", "neon", "atmospheric", "cosmic"].map((tag) => (
              <span key={tag} className="pill">{tag}</span>
            ))}
          </motion.div>
        </div>
        <p className="relative z-10 text-slate-600 text-xs">2026 Melody Map</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-brand-purple/15 rounded-full blur-3xl" />
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-sm relative">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center">
              <Music2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-gradient">Melody Map</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{isLogin ? "Welcome back" : "Create account"}</h2>
          <p className="text-slate-400 text-sm mb-7">{isLogin ? "Sign in to your music universe" : "Start mapping your music taste"}</p>

          <button onClick={() => wake(`${import.meta.env.VITE_API_URL || ''}/auth/spotify/login`)}
            disabled={waking}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm text-white mb-5 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
            style={{ background: "#1DB954" }}>
            {waking
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Waking up Melody Map...</>
              : <><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg> Continue with Spotify</>
            }
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type="text" placeholder="Username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/4 border border-white/8 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/60 transition-all"
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input type="email" placeholder="Email address"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/4 border border-white/8 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/60 transition-all"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input type="password" placeholder="Password"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/4 border border-white/8 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/60 transition-all"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-glow w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-purple to-brand-pink hover:shadow-glow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-brand-purple hover:text-indigo-300 font-medium transition-colors">
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
