import clsx from 'clsx'
import artwork from '../../assets/brand/melody-map-brand.png'

export const BRAND_ARTWORK = artwork

export function BrandMark({
  size = 44,
  mode = 'orb',
  className = '',
  muted = false,
  alt = 'Melody Map',
}) {
  const dimension = typeof size === 'number' ? `${size}px` : size

  if (mode === 'full') {
    return (
      <img
        src={artwork}
        alt={alt}
        className={clsx('block object-contain', className)}
        style={{
          width: dimension,
          filter: muted ? 'saturate(0.88) brightness(0.94)' : 'drop-shadow(0 0 28px rgba(171, 145, 255, 0.22))',
        }}
      />
    )
  }

  return (
    <div
      aria-label={alt}
      role="img"
      className={clsx(
        'relative shrink-0 overflow-hidden rounded-full border border-white/10',
        className,
      )}
      style={{
        width: dimension,
        height: dimension,
        backgroundImage: `url(${artwork})`,
        backgroundSize: '235% auto',
        backgroundPosition: '50% 25%',
        boxShadow: muted
          ? '0 0 22px rgba(162, 140, 255, 0.12)'
          : '0 0 34px rgba(162, 140, 255, 0.22), 0 0 90px rgba(112, 153, 255, 0.08)',
      }}
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_32%,rgba(4,6,18,0.08)_72%,rgba(4,6,18,0.34)_100%)]" />
    </div>
  )
}

export function BrandWordmark({ compact = false, className = '', muted = false }) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div className="relative">
        <div className="absolute inset-[-24%] rounded-full bg-[radial-gradient(circle,rgba(168,132,255,0.24),transparent_70%)] blur-xl" />
        <BrandMark size={compact ? 38 : 48} muted={muted} />
      </div>
      <div className="min-w-0">
        <span className="block truncate font-cinzel text-[1rem] tracking-[0.34em] text-[#f6eeff]">
          Melody Map
        </span>
        <span className="block truncate text-[10px] uppercase tracking-[0.42em] text-white/35">
          Living music intelligence
        </span>
      </div>
    </div>
  )
}

export function BrandBackdrop({ className = '', opacity = 0.22 }) {
  return (
    <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      <div
        className="absolute inset-[-6%]"
        style={{
          backgroundImage: `url(${artwork})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(36px) saturate(0.84) brightness(0.26)',
          opacity,
          transform: 'scale(1.1)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(180,146,255,0.18),transparent_22%),radial-gradient(circle_at_12%_22%,rgba(110,142,255,0.16),transparent_28%),radial-gradient(circle_at_84%_78%,rgba(255,162,210,0.12),transparent_24%),linear-gradient(180deg,rgba(2,4,14,0.92),rgba(5,6,18,0.94))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:120px_120px] opacity-[0.14]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,3,10,0.18)_55%,rgba(2,3,10,0.72)_100%)]" />
    </div>
  )
}

export function BrandWatermark({
  className = '',
  opacity = 0.08,
  rotate = -8,
  scale = 1,
}) {
  return (
    <img
      src={artwork}
      alt=""
      aria-hidden="true"
      className={clsx('pointer-events-none select-none object-contain', className)}
      style={{
        opacity,
        filter: 'blur(1px) saturate(0.92)',
        transform: `rotate(${rotate}deg) scale(${scale})`,
      }}
    />
  )
}

export function BrandConstellation({ className = '' }) {
  return (
    <svg
      viewBox="0 0 720 320"
      className={clsx('pointer-events-none absolute inset-x-0 top-0 h-full w-full', className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M28 162C114 138 196 139 266 158C328 176 396 182 460 160C526 138 612 136 692 162"
        stroke="rgba(174,157,255,0.18)"
        strokeWidth="1.2"
        strokeDasharray="3 8"
      />
      <path
        d="M102 70C168 100 240 126 360 128C480 130 550 98 618 66"
        stroke="rgba(255,190,222,0.18)"
        strokeWidth="1"
      />
      <path
        d="M120 252C196 214 280 196 360 194C444 192 520 214 602 252"
        stroke="rgba(151,198,255,0.14)"
        strokeWidth="1"
      />
      {[
        [128, 76],
        [228, 118],
        [358, 128],
        [492, 110],
        [602, 74],
        [152, 240],
        [278, 202],
        [430, 194],
        [562, 232],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="rgba(244,236,255,0.78)" />
      ))}
    </svg>
  )
}

export function AssetUsageMap() {
  const rows = [
    ['Favicon / PWA', 'Orb mark SVG + artwork PNG fallback'],
    ['Navbar + shell', 'Orb logo, blurred watermark, sacred-grid backdrop'],
    ['Galaxy home', 'Full-screen blurred artwork behind the observatory'],
    ['Profile chamber', 'Soul Orb framed with artwork watermark and halo surfaces'],
    ['Auralith', 'Orb badge, intelligence halo, listening console backdrop'],
    ['Login / loading / empty states', 'Artwork centerpiece with orb-crop fallback'],
  ]

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-3">
        <BrandMark size={38} muted />
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Asset usage map</p>
          <p className="text-sm font-semibold text-white">Where the core image now drives the product</p>
        </div>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-2xl border border-white/8 bg-[#0a0c1d]/56 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-white">{label}</span>
            <span className="text-xs uppercase tracking-[0.18em] text-white/45">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
