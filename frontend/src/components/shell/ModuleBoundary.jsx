import React from 'react'

export default function ModuleBoundary({
  title,
  loading = false,
  error = null,
  degraded = false,
  fallback = null,
  children,
}) {
  if (error) {
    return (
      <section className="noire-info-card rounded-[24px] p-5">
        <p className="section-label mb-2">{title || 'Module'}</p>
        <p className="text-sm font-semibold text-white">This layer slipped into a recoverable fault.</p>
        <p className="mt-2 text-xs text-slate-400">{error}</p>
      </section>
    )
  }

  if (loading && fallback) {
    return (
      <section className="noire-info-card rounded-[24px] p-5">
        <p className="section-label mb-3">{title || 'Module'}</p>
        {fallback}
      </section>
    )
  }

  return (
    <section className={degraded ? 'relative' : undefined}>
      {degraded ? (
        <div className="mb-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
          This module is rendering from a partial signal and will deepen as more data arrives.
        </div>
      ) : null}
      {children}
    </section>
  )
}
