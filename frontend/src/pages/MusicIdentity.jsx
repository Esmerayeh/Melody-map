import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Brain, Compass, Disc3, Sparkles } from 'lucide-react'
import useMusicProfile from '../hooks/useMusicProfile'
import ProfileBootPanel from '../components/ProfileBootPanel'
import MusicIdentityPanel from '../components/MusicIdentityPanel'
import { MOTION_TOKENS } from '../features/motion/motionTokens'
import { useRouteReadiness } from '../hooks/useRouteReadiness'

const pct = (v, max = 100) => Math.round(Math.min(Math.max((v ?? 0), 0), max))

function TraitBar({ label, value, color = '#7c6fff', icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay * 0.08, ...MOTION_TOKENS.focusSettle }}
      className="flex items-center gap-3"
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <span className="text-sm">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{label}</span>
          <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
        </div>
        <div className="trait-bar-track">
          <div className="trait-bar-fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 10px ${color}50` }} />
        </div>
      </div>
    </motion.div>
  )
}

function DnaBand({ label, pct: p, color, icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.09, ...MOTION_TOKENS.focusSettle }}
      className="flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <span className="text-base">{icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-sm font-bold tabular-nums" style={{ color }}>{p}%</span>
        </div>
        <div className="trait-bar-track">
          <div className="trait-bar-fill" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)`, boxShadow: `0 0 8px ${color}40` }} />
        </div>
      </div>
    </motion.div>
  )
}

export default function MusicIdentity() {
  const { profile, phase, confidence, dataQuality, readiness, tier } = useMusicProfile()
  const safeProfile = profile || {}

  const personality = safeProfile.personality || []
  const mbti = safeProfile.mbti
  const mbtiMeta = safeProfile.mbtiMeta
  const traits = useMemo(() => personality.slice(0, 5), [personality])

  const boot = useRouteReadiness({
    phase,
    profile,
    readiness,
    tier,
    require: { profile: true, identity: true },
    copy: {
      loading: {
        title: 'Your inner music self is coming into focus.',
        subtitle: 'We are listening for enough signal to reveal the full reading.',
        detail: 'Hold steady a moment.',
      },
      empty: {
        title: 'Your identity needs a connected signal.',
        subtitle: 'Connect a music source and the inner reading will appear.',
        detail: 'No listening history is available yet.',
      },
      error: {
        title: 'The identity reading could not load.',
        subtitle: 'The listening data is not reachable right now.',
        detail: 'Refresh once and the inner reading should return.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'We are rendering a lighter identity reading until the profile deepens.',
        detail: 'This is intentional, not an error.',
      },
    },
  })

  if (boot.blocked) {
    return (
      <ProfileBootPanel
        variant={boot.variant}
        title={boot.title}
        subtitle={boot.subtitle}
        detail={boot.detail}
        actionLabel={boot.variant === 'error' ? 'Reload the reading' : undefined}
        onAction={boot.variant === 'error' ? () => window.location.reload() : undefined}
      />
    )
  }

  return (
    <div className="cosmic-page space-y-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={MOTION_TOKENS.focusSettle}>
        <p className="page-header-kicker mb-2">Music Identity</p>
        <h1 className="page-header-title">Your inner music self</h1>
        <p className="page-header-copy mt-3">
          A deeper read of how you carry emotion, structure, and memory through sound.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>clarity: {confidence?.labels?.identity || 'soft signal'}</span>
          <span>atmospheres: {dataQuality?.genresCount || 0}</span>
          <span>deep signal: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%</span>
        </div>
        {safeProfile?.isDegraded && (
          <p className="mt-3 text-xs text-amber-300/80">
            This is a partial reading. We will deepen the identity as more listening signal arrives.
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="noire-panel rounded-[32px] p-6 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_25%_20%,rgba(124,111,255,0.18),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(245,114,182,0.12),transparent_60%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 bg-white/5">
                <Sparkles className="w-5 h-5 text-brand-purple" />
              </div>
              <div>
                <p className="page-header-kicker">Sonic personality</p>
                <p className="text-lg font-semibold text-white">{safeProfile.sonicPersonalityTitle || mbti?.name || 'Listening self'}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-300">
              {safeProfile.musicIdentitySummary || mbti?.desc || 'The inner reading is still forming, but the contours are visible.'}
            </p>
            <div className="mt-5 grid gap-3">
              {traits.length ? traits.map((trait, index) => (
                <TraitBar
                  key={trait.id || trait.label || index}
                  label={trait.label || trait.id || 'Trait'}
                  value={pct(trait.pct)}
                  color={trait.color || '#7c6fff'}
                  icon={trait.emoji || '*'}
                  delay={index * 0.1}
                />
              )) : (
                <p className="text-xs text-gray-500">More listening depth will reveal the strongest traits.</p>
              )}
            </div>
          </div>
        </div>

        <div className="noire-info-card rounded-[28px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-purple-300" />
            <p className="page-header-kicker">MBTI reading</p>
          </div>
          {mbti ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-gradient-aurora text-4xl font-semibold tracking-[0.2em]">{mbti.type}</span>
                <span className="text-sm text-gray-400">{mbti.name}</span>
              </div>
              <p className="mt-3 text-sm text-gray-400">{mbti.desc}</p>
              <div className="mt-4 space-y-2 text-xs text-gray-500">
                {Object.entries(mbti.axes || {}).map(([axis, data]) => (
                  <div key={axis} className="flex items-center justify-between">
                    <span>{axis.toUpperCase()}</span>
                    <span>{data.label} ({pct(data.score)}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              The four-letter read needs a steadier signal. Deep signal: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%.
            </p>
          )}
          {mbtiMeta?.missingInputs?.length > 0 && (
            <p className="mt-3 text-[11px] text-gray-500">
              missing inputs: {mbtiMeta.missingInputs.slice(0, 4).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="noire-panel rounded-[28px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="w-4 h-4 text-sky-300" />
            <p className="page-header-kicker">Taste DNA</p>
          </div>
          <div className="space-y-3">
            {(safeProfile.identityDNA || []).slice(0, 4).map((band, index) => (
              <DnaBand
                key={band.label || index}
                label={band.label || 'Signal band'}
                pct={pct(band.pct)}
                color={band.color || '#7c6fff'}
                icon={band.icon || '*'}
                delay={index * 0.12}
              />
            ))}
            {!safeProfile.identityDNA?.length && (
              <p className="text-xs text-gray-500">Your identity strands will appear as more signal arrives.</p>
            )}
          </div>
        </div>

        <div className="noire-orb-panel rounded-[28px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Disc3 className="w-4 h-4 text-pink-300" />
            <p className="page-header-kicker">Inner reflection</p>
          </div>
          <MusicIdentityPanel profile={safeProfile} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/galaxy"
          className="noire-chip rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'rgba(124,111,255,0.18)', border: '1px solid rgba(124,111,255,0.32)' }}
        >
          Enter the galaxy
        </Link>
        <Link
          to="/soulmate"
          className="noire-chip rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'rgba(244,114,182,0.16)', border: '1px solid rgba(244,114,182,0.3)' }}
        >
          Compare soulmates
        </Link>
      </div>
    </div>
  )
}
