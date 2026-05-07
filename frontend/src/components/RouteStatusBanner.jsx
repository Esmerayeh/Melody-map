import { Loader2, RadioTower, ShieldAlert } from 'lucide-react'

function StatusIcon({ variant }) {
  if (variant === 'loading') return <Loader2 className="h-4 w-4 animate-spin" />
  if (variant === 'error') return <ShieldAlert className="h-4 w-4" />
  return <RadioTower className="h-4 w-4" />
}

export default function RouteStatusBanner({ variant = 'loading', title, subtitle, detail }) {
  return (
    <div className="noire-panel-soft rounded-[24px] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-brand-purple">
          <StatusIcon variant={variant} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
          {detail ? <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">{detail}</p> : null}
        </div>
      </div>
    </div>
  )
}
