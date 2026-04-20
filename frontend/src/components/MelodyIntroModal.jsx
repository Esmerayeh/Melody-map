import { Brain, Disc3, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrandMark } from './brand/BrandSystem'

const PILLARS = [
  {
    title: 'Galaxy',
    icon: Disc3,
    tone: '#9eb6ff',
    copy: 'Your outer map. It reveals artists, genres, and emotional regions as a living field you can explore.',
  },
  {
    title: 'Soul Orb',
    icon: Sparkles,
    tone: '#d6c9ff',
    copy: 'Your inner signal. It compresses your listening identity into one responsive presence.',
  },
  {
    title: 'Auralith',
    icon: Brain,
    tone: '#f4b4e4',
    copy: 'Your interpreter. It turns your map and identity into prompts, playlists, and emotional reading.',
  },
]

export default function MelodyIntroModal({ open, onClose, onEnableDemo }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-5 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="brand-panel living-grid relative w-full max-w-4xl p-6 lg:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 flex items-center gap-4">
              <BrandMark size={58} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">First 30 seconds</p>
                <h2 className="text-2xl font-semibold text-white">Melody Map in plain language</h2>
              </div>
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
              Start with the map, move inward to the orb, then use Auralith once the first two surfaces have given you context.
              If you have not connected a listening source yet, you can enter demo mode and experience the full system immediately.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {PILLARS.map(({ title, icon: Icon, tone, copy }) => (
                <div key={title} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: `${tone}33`, background: `${tone}15` }}>
                    <Icon className="h-4 w-4" style={{ color: tone }} />
                  </div>
                  <p className="text-lg font-semibold text-white">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                Demo mode uses a fully formed sample listener so every route feels alive before you connect real music data.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.07]"
                >
                  I understand
                </button>
                <button
                  type="button"
                  onClick={onEnableDemo}
                  className="orb-button rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                >
                  Enter demo profile
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
