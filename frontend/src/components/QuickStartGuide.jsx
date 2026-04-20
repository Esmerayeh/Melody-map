import { Brain, Disc3, Sparkles, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandMark } from './brand/BrandSystem'

const STEPS = [
  {
    to: '/galaxy',
    title: 'Open Galaxy',
    icon: Disc3,
    tone: '#9eb6ff',
    copy: 'See the outer map first. It gives the fastest intuition for taste shape, clusters, and emotional neighborhoods.',
  },
  {
    to: '/profile',
    title: 'Read the Soul Orb',
    icon: Sparkles,
    tone: '#d6c9ff',
    copy: 'Then move inward. The profile chamber turns listening data into presence, identity, and resonance.',
  },
  {
    to: '/auralith',
    title: 'Talk to Auralith',
    icon: Brain,
    tone: '#f4b4e4',
    copy: 'Use the AI interpreter last, when the map and orb have already given context to the prompt.',
  },
]

export default function QuickStartGuide({ isConnected }) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,13,27,0.84),rgba(8,9,18,0.78))] p-6 backdrop-blur-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark size={42} muted />
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Start here</p>
            <h3 className="text-lg font-semibold text-white">How Melody Map works best</h3>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/45">
          <Waves className="h-3.5 w-3.5 text-brand-cyan" />
          {isConnected ? 'Signal live' : 'Connect source'}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {STEPS.map(({ to, title, icon: Icon, tone, copy }) => (
          <Link
            key={title}
            to={to}
            className="group rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border" style={{ borderColor: `${tone}33`, background: `${tone}14` }}>
              <Icon className="h-4 w-4" style={{ color: tone }} />
            </div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{copy}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-[22px] border border-white/8 bg-[#0a0d1f]/68 px-4 py-3">
        <p className="text-sm leading-relaxed text-slate-400">
          {isConnected
            ? 'Best flow: scan the outer galaxy, check the inner orb, then ask Auralith for something precise. Each surface should deepen the next one.'
            : 'You can still enter through the app shell now, but the full experience wakes up once a listening source is connected.'}
        </p>
      </div>
    </section>
  )
}
