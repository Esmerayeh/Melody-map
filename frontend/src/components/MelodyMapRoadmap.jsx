import { ArrowUpRight, BrainCircuit, Compass, Palette, Rocket, Share2, Sparkles, Waves } from 'lucide-react'
import { motion } from 'framer-motion'
import { AssetUsageMap, BrandMark } from './brand/BrandSystem'

const ROADMAP_BUCKETS = [
  {
    title: 'UX Foundation',
    icon: Compass,
    tone: '#9eb6ff',
    items: [
      'Make the first 30 seconds obvious with guided entry points and demo states.',
      'Explain what is live, syncing, partial, or personalized on every intelligence surface.',
      'Save recent sessions so users can return to the last place the system felt alive.',
    ],
  },
  {
    title: 'Visual System',
    icon: Palette,
    tone: '#f4b4e4',
    items: [
      'Unify shell, loaders, empty states, and share surfaces around the uploaded orb artwork.',
      'Use the sacred-geometry orb as the source for buttons, highlights, and watermarks.',
      'Add performance-aware motion tiers so low-end devices still feel premium.',
    ],
  },
  {
    title: 'Living Intelligence',
    icon: BrainCircuit,
    tone: '#d6c9ff',
    items: [
      'Let Auralith remember prompts, refine answers, and produce reusable taste artifacts.',
      'Show why each recommendation fits the listener using real profile signals.',
      'Make the Soul Orb react to listening state, AI output, and page transitions.',
    ],
  },
  {
    title: 'Growth Loops',
    icon: Share2,
    tone: '#e7c79f',
    items: [
      'Generate share cards from orb identity, galaxy snapshots, and soulmate outcomes.',
      'Add public profile pages with privacy controls and embeddable highlights.',
      'Create social hooks around compatibility, taste evolution, and saved AI sessions.',
    ],
  },
]

const PHASES = [
  {
    label: 'Now shipping',
    icon: Sparkles,
    tone: '#d6c9ff',
    detail: 'Brand alignment, browser icon/logo usage, guided dashboard framing, roadmap visibility.',
  },
  {
    label: 'Next slice',
    icon: Waves,
    tone: '#9eb6ff',
    detail: 'Auralith session memory, richer onboarding, and stronger empty-state storytelling.',
  },
  {
    label: 'After that',
    icon: Rocket,
    tone: '#f4b4e4',
    detail: 'Shareable identity artifacts, public profiles, and deeper multi-user discovery loops.',
  },
]

export default function MelodyMapRoadmap() {
  return (
    <section className="space-y-4">
      <div className="brand-panel living-grid p-6">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3">
              <BrandMark size={42} muted />
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Melody Map roadmap</p>
            </div>
            <h2 className="text-2xl font-semibold text-white">A concrete path from striking concept to sticky product.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              This roadmap turns Melody Map into a living music intelligence system by focusing on clarity first, then depth,
              then shareable value. The goal is to make the experience easier to enter and harder to leave.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
            {PHASES.map(({ label, icon: Icon, tone, detail }) => (
              <div key={label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border" style={{ borderColor: `${tone}33`, background: `${tone}14` }}>
                  <Icon className="h-4 w-4" style={{ color: tone }} />
                </div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          {ROADMAP_BUCKETS.map(({ title, icon: Icon, tone, items }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-[28px] border border-white/10 bg-[#0a0c1d]/68 p-5 backdrop-blur-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: `${tone}33`, background: `${tone}14` }}>
                  <Icon className="h-4 w-4" style={{ color: tone }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: tone }}>Priority lane</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tone }} />
                    <p className="text-sm leading-relaxed text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </motion.article>
          ))}
        </div>

        <AssetUsageMap />
      </div>
    </section>
  )
}
