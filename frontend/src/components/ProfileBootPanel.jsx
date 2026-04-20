import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION_TOKENS } from '../features/motion/motionTokens'
import { BrandMark, BrandWatermark } from './brand/BrandSystem'

const TONES = {
  loading: {
    kicker: 'tuning the signal',
    glow: 'rgba(124,111,255,0.24)',
  },
  partial: {
    kicker: 'partial signal',
    glow: 'rgba(250,204,21,0.22)',
  },
  sparse: {
    kicker: 'sparse signal',
    glow: 'rgba(125,211,252,0.2)',
  },
  failed: {
    kicker: 'signal interference',
    glow: 'rgba(248,113,113,0.22)',
  },
  error: {
    kicker: 'signal interference',
    glow: 'rgba(248,113,113,0.22)',
  },
  empty: {
    kicker: 'waiting for a source',
    glow: 'rgba(148,163,184,0.18)',
  },
}

export default function ProfileBootPanel({
  variant = 'loading',
  title,
  subtitle,
  detail,
  actionLabel,
  onAction,
  children,
}) {
  const tone = TONES[variant] || TONES.loading

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={MOTION_TOKENS.panel}
        className="boot-panel noire-panel w-full max-w-2xl rounded-[28px] p-8 text-center"
        style={{ '--boot-glow': tone.glow }}
        data-variant={variant}
      >
        <BrandWatermark className="absolute inset-x-auto right-[-6%] top-[-10%] w-72" opacity={0.08} rotate={8} />
        <div className="boot-orb" />
        <div className="mx-auto mb-4 flex w-fit items-center justify-center">
          <BrandMark size={84} muted={variant !== 'loading'} />
        </div>
        <p className="page-header-kicker mb-2" style={{ color: tone.glow }}>{tone.kicker}</p>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-3 text-sm text-gray-400">{subtitle}</p>}
        {detail && <p className="mt-4 text-xs uppercase tracking-[0.22em] text-gray-500">{detail}</p>}
        {variant === 'loading' && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin text-brand-purple" />
            <span>holding the shell open while the profile settles</span>
          </div>
        )}
        {children}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
          >
            {actionLabel}
          </button>
        )}
      </motion.div>
    </div>
  )
}
