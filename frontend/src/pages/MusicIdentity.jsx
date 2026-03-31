import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Brain, Compass, Disc3, Sparkles } from 'lucide-react'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicIdentityPanel from '../components/MusicIdentityPanel'

function CTA({ to, icon: Icon, label, detail, accent }) {
  return (
    <Link
      to={to}
      className="block rounded-[24px] p-4 transition-all glass-hover"
      style={{
        background: `${accent}0f`,
        border: `1px solid ${accent}22`,
      }}
    >
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ background: `${accent}18`, border: `1px solid ${accent}24` }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </Link>
  )
}

export default function MusicIdentity() {
  const { profile, loading } = useMusicProfile()

  return (
    <div className="cosmic-page space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[32px] overflow-hidden relative noire-panel"
        style={{
          background: 'linear-gradient(135deg, rgba(143,117,255,0.14), rgba(242,141,223,0.07) 42%, rgba(159,208,255,0.04) 100%)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 24% 22%, rgba(143,117,255,0.16), transparent 36%), radial-gradient(ellipse at 82% 78%, rgba(96,165,250,0.08), transparent 34%)',
          }}
        />
        <div className="relative z-10 p-6 lg:p-8">
          <p className="page-header-kicker mb-2">The Inner Music Self</p>
          <h1 className="page-header-title">Music Identity</h1>
          <p className="page-header-copy mt-3 max-w-3xl">
            A steadier reading of the patterns, contradictions, and quiet impulses that keep returning in your listening.
          </p>
        </div>
      </motion.section>

      {loading && (
        <div className="rounded-[28px] p-8 noire-panel text-sm text-slate-400">
          tuning into your signal...
        </div>
      )}

      {!loading && profile && (
        <>
          <MusicIdentityPanel profile={profile} />

          {profile.mbti && profile.personality?.length > 0 ? (
            <div className="rounded-[28px] p-6 noire-panel">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-brand-purple" />
                <p className="section-label">What stays with you</p>
              </div>
              <p className="text-2xl font-black text-white">
                {profile.mbti.type} · {profile.mbti.name}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                {profile.mbti.desc}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.personality.slice(0, 4).map((trait) => (
                  <span
                    key={trait.id}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium"
                    style={{
                      borderColor: `${trait.color}33`,
                      background: `${trait.color}12`,
                      color: trait.color,
                    }}
                  >
                    {trait.emoji} {trait.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-3">
            <CTA
              to="/discover"
              icon={Compass}
              label="Drift from this reading"
              detail="Let these softer contours pull new signals toward you."
              accent="#00D1FF"
            />
            <CTA
              to="/galaxy?mode=artist"
              icon={Disc3}
              label="See it inside the galaxy"
              detail="Move through the artists and regions that shaped this self."
              accent="#8F75FF"
            />
            <CTA
              to="/aesthetic"
              icon={Sparkles}
              label="Let it become atmosphere"
              detail="Translate this inner reading into color, texture, and mood."
              accent="#F28DDF"
            />
          </section>
        </>
      )}
    </div>
  )
}
