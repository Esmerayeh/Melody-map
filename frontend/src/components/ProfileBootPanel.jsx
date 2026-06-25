import { Loader2, RefreshCw, RadioTower, ShieldAlert, Sparkles } from 'lucide-react'

// Quiet warm notices — never red, never error-looking. "Partial signal, softly
// held" is the tone for every state, including failures (warm rose, not red).
const TONES = {
  loading: {
    kicker: 'system activity',
    glow: '#de83b4',
    accent: '#ebccdc',
    line: 'Signal layers are coming online in sequence.',
  },
  partial: {
    kicker: 'partial reading',
    glow: '#c1337f',
    accent: '#ebccdc',
    line: 'The first layer is here. Deeper modules are still resolving.',
  },
  sparse: {
    kicker: 'light profile',
    glow: '#c9a36a',
    accent: '#ebccdc',
    line: 'A leaner read is available while more signal lands.',
  },
  failed: {
    kicker: 'connection issue',
    glow: '#d9a0a0',
    accent: '#ebccdc',
    line: 'The shell is still stable, but the data route needs another try.',
  },
  error: {
    kicker: 'connection issue',
    glow: '#d9a0a0',
    accent: '#ebccdc',
    line: 'The shell is still stable, but the data route needs another try.',
  },
  empty: {
    kicker: 'awaiting signal',
    glow: '#c9b79c',
    accent: '#ebccdc',
    line: 'You can enter the shell now. Live listening data appears after connect.',
  },
}

function StatusIcon({ variant }) {
  if (variant === 'loading') return <Loader2 className="h-4 w-4 animate-spin" />
  if (variant === 'error' || variant === 'failed') return <ShieldAlert className="h-4 w-4" />
  return <RadioTower className="h-4 w-4" />
}

function PreviewCard({ title, value, detail, tone, skeleton = false }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4 backdrop-blur-xl">
      <p className="section-label mb-2">{title}</p>
      {skeleton ? (
        <>
          <div className="skeleton h-6 w-3/5" />
          <div className="skeleton mt-3 h-3 w-4/5" />
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-white" style={{ color: tone.accent }}>{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{detail}</p>
        </>
      )}
    </div>
  )
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
  const previewState = variant === 'loading' || variant === 'partial' || variant === 'sparse'

  return (
    <div className="cosmic-page">
      <div className="noire-panel relative overflow-hidden rounded-[34px] p-6 lg:p-8">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 14% 18%, ${tone.glow}22, transparent 38%), radial-gradient(ellipse at 82% 72%, ${tone.accent}12, transparent 34%)`,
          }}
        />
        <div className="relative z-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"
                  style={{ color: tone.glow }}
                >
                  <StatusIcon variant={variant} />
                </div>
                <div>
                  <p className="page-header-kicker mb-1" style={{ color: tone.glow }}>{tone.kicker}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">Melody Map shell is live</p>
                </div>
              </div>
              <h2 className="page-header-title">{title}</h2>
              {subtitle && <p className="page-header-copy mt-4">{subtitle}</p>}
              <p className="mt-4 text-sm text-slate-400">{tone.line}</p>
              {detail && <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">{detail}</p>}

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="pill"><Sparkles className="mr-1 h-3 w-3" />shell loaded</span>
                <span className="pill">progressive reveal</span>
                <span className="pill">no blank route</span>
              </div>

              {actionLabel && onAction && (
                <button
                  type="button"
                  onClick={onAction}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/[0.08]"
                >
                  <RefreshCw className="h-4 w-4" />
                  {actionLabel}
                </button>
              )}
            </div>

            <div className="w-full max-w-[420px] rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-2xl">
              <p className="section-label mb-3">What is still forming</p>
              <div className="space-y-3">
                <PreviewCard
                  title="Identity layer"
                  value={previewState ? 'traits, moods, and orbit read' : 'ready'}
                  detail="The first personality contours can appear before the deeper analysis fully resolves."
                  tone={tone}
                  skeleton={variant === 'loading'}
                />
                <PreviewCard
                  title="Analytics layer"
                  value={previewState ? 'energy, light, movement' : 'ready'}
                  detail="Snapshot metrics can render before full charts and advanced confidence scores settle."
                  tone={tone}
                  skeleton={variant === 'loading'}
                />
                <PreviewCard
                  title="Galaxy layer"
                  value={previewState ? 'anchors, regions, bridges' : 'ready'}
                  detail="The field should open with a visible first layer instead of making you wait on a blank route."
                  tone={tone}
                  skeleton={variant === 'loading'}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-4">
              <p className="section-label mb-2">Shell state</p>
              <p className="text-sm text-white">Immediate</p>
              <p className="mt-2 text-xs text-slate-500">Navigation and layout should feel present before every secondary request finishes.</p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-4">
              <p className="section-label mb-2">Data posture</p>
              <p className="text-sm text-white">{variant === 'error' ? 'Recoverable' : previewState ? 'Progressive' : 'Ready'}</p>
              <p className="mt-2 text-xs text-slate-500">Loading, partial data, and failure should feel different so the product stays trustworthy.</p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-4">
              <p className="section-label mb-2">Interaction promise</p>
              <p className="text-sm text-white">Something to inspect now</p>
              <p className="mt-2 text-xs text-slate-500">Even before the full read resolves, the route should offer previews, scaffolds, and visible structure.</p>
            </div>
          </div>
        </div>

        {children ? <div className="relative z-10 mt-6">{children}</div> : null}
      </div>
    </div>
  )
}
