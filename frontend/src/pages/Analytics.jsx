import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Music2, Mic2, Zap, Heart, Activity, Disc3, BarChart2 } from 'lucide-react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie,
} from 'recharts'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicIdentityPanel from '../components/MusicIdentityPanel'
import DeferredSoulOrb from '../components/DeferredSoulOrb'
import RouteStatusBanner from '../components/RouteStatusBanner'
import { useRouteReadiness } from '../hooks/useRouteReadiness'
import ModuleBoundary from '../components/shell/ModuleBoundary'
import ShellSkeleton from '../components/shell/ShellSkeleton'

const normalizeUnit = (value) => {
  if (value == null || Number.isNaN(Number(value))) return null
  return Math.min(1, Math.max(0, Number(value)))
}
const pct = (value) => {
  const normalized = normalizeUnit(value)
  return normalized == null ? null : Math.round(normalized * 100)
}
const fmt = (v) => (v != null ? Number(v).toFixed(0) : 'soft signal')
const GENRE_COLORS = ['#e0a35c','#B994FF','#9DB7FF','#EAE6FF','#F0C8FF','#7A6BD8','#D6D0F0','#C7BEFF']
const STAT_CARDS = [
  { key: 'energy',       label: 'Intensity',       icon: Zap,      color: '#f472b6', desc: 'heat and forward pull' },
  { key: 'valence',      label: 'Light',   icon: Heart,    color: '#f0c089', desc: 'brightness inside the feeling' },
  { key: 'danceability', label: 'Movement', icon: Activity, color: '#9DB7FF', desc: 'how much the body wants in' },
  { key: 'acousticness', label: 'Texture', icon: Music2,   color: '#60a5fa', desc: 'wood, wire, or circuitry' },
]

function StatCard({ label, icon: Icon, color, value, desc, delay }) {
  const isAvailable = value != null
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 28 }}
      className="noire-info-card rounded-2xl p-5 border relative overflow-hidden"
      style={{ background: `${color}0d`, borderColor: `${color}25` }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: `${color}18` }} />
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-2xl font-black" style={{ color }}>{isAvailable ? `${value}%` : 'soft signal'}</span>
      </div>
      <p className="text-sm font-semibold text-white relative z-10">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5 relative z-10">{desc}</p>
      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden relative z-10">
        {isAvailable ? (
          <motion.div className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
            initial={{ width: 0 }} animate={{ width: `${value}%` }}
            transition={{ delay: delay + 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
        ) : (
          <div className="h-full rounded-full bg-white/5" />
        )}
      </div>
    </motion.div>
  )
}

function AudioRadar({ af }) {
  const data = [
    { feature: 'Energy',           value: pct(af.energy) },
    { feature: 'Valence',          value: pct(af.valence) },
    { feature: 'Danceability',     value: pct(af.danceability) },
    { feature: 'Acousticness',     value: pct(af.acousticness) },
    { feature: 'Instrumentalness', value: pct(af.instrumentalness) },
    { feature: 'Speechiness',      value: pct(af.speechiness) },
  ]
  const available = data.filter((item) => item.value != null)
  if (available.length < 3) {
    return <p className="text-sm text-gray-500 px-2 py-8">the pattern is still forming -- not enough deep signal for a full shape yet.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={available} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Radar dataKey="value" stroke="#f0c089" fill="#f0c089" fillOpacity={0.18} strokeWidth={2} dot={{ fill: '#f0c089', r: 3 }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function GenrePills({ genres }) {
  if (!genres?.length) return <p className="text-gray-500 text-sm">the atmosphere is still coming into focus</p>
  const items = genres.slice(0, 16).map((g) => (typeof g === 'string' ? g : g.genre))
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((g, i) => (
        <motion.span key={g} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
          className="px-3 py-1 rounded-full text-xs font-medium border"
          style={{ color: GENRE_COLORS[i % GENRE_COLORS.length], borderColor: `${GENRE_COLORS[i % GENRE_COLORS.length]}40`, background: `${GENRE_COLORS[i % GENRE_COLORS.length]}12` }}>
          {g}
        </motion.span>
      ))}
    </div>
  )
}

function TempoBar({ tempo }) {
  const zones = [
    { label: 'Slow',   range: [0,   80],  color: '#60a5fa' },
    { label: 'Mid',    range: [80,  120], color: '#f0c089' },
    { label: 'Upbeat', range: [120, 160], color: '#f472b6' },
    { label: 'Fast',   range: [160, 300], color: '#fb923c' },
  ]
  if (tempo == null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Average tempo</span>
          <span className="text-lg font-black text-gray-500">soft signal</span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-white/5" />
        <p className="text-xs text-gray-500 mt-2">there is not enough track-level signal yet to hear the pace clearly.</p>
      </div>
    )
  }
  const t = tempo
  const active = zones.find((z) => t >= z.range[0] && t < z.range[1]) || zones[1]
  const pctPos = Math.min(100, Math.max(0, ((t - 60) / (200 - 60)) * 100))
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Average Tempo</span>
        <span className="text-lg font-black" style={{ color: active.color }}>{fmt(tempo)} BPM</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-white/5">
        <div className="absolute inset-0 flex">
          {zones.map((z) => <div key={z.label} className="flex-1 h-full opacity-20" style={{ background: z.color }} />)}
        </div>
        <motion.div className="absolute top-0 w-3 h-3 rounded-full border-2 border-white" style={{ background: active.color }}
          initial={{ left: 0 }} animate={{ left: `calc(${pctPos}% - 6px)` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div className="flex justify-between mt-1">
        {zones.map((z) => <span key={z.label} className="text-[10px]" style={{ color: z.color }}>{z.label}</span>)}
      </div>
    </div>
  )
}

function ArtistFrequency({ topArtists }) {
  const data = (topArtists || []).slice(0, 8).map((a) => ({ name: (a.name || '').slice(0, 14), popularity: a.popularity || 0 }))
  const hasSignal = data.some((item) => item.popularity > 0)
  if (!data.length || !hasSignal) return <p className="text-gray-500 text-sm">no strong artist pull yet</p>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
        <Tooltip contentStyle={{ background: '#0d1025', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#e2e8f0' }} formatter={(v) => [`${v}`, 'Popularity']} />
        <Bar dataKey="popularity" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} fillOpacity={0.8} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DiversityPie({ genres }) {
  const top = (genres || []).slice(0, 6)
  if (!top.length) return <p className="text-gray-500 text-sm">not enough signal yet</p>
  const weightedTotal = top.reduce((sum, genre) => sum + (typeof genre === 'string' ? 1 : Number(genre.count) || 0), 0) || top.length
  const data = top.map((g, i) => {
    const name = typeof g === 'string' ? g : g.genre
    const weight = typeof g === 'string' ? 1 : Number(g.count) || 0
    return { name, value: Math.round((weight / weightedTotal) * 100), color: GENRE_COLORS[i % GENRE_COLORS.length] }
  })
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-gray-300 truncate max-w-[120px]">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Analytics() {
  const { profile, loading, canComputeAnalytics, dataQuality, confidence, phase, readiness, tier } = useMusicProfile()
  const safeProfile = profile || {}
  const af = useMemo(() => safeProfile.audioFeatures || {}, [safeProfile])

  const boot = useRouteReadiness({
    phase,
    profile,
    readiness,
    tier,
    require: { profile: true, analytics: true },
    copy: {
      loading: {
        title: 'The signal reading is tuning in.',
        subtitle: 'We are collecting the deeper track-level signal before the full read appears.',
        detail: 'This will settle shortly.',
      },
      empty: {
        title: 'Connect a music source to read the signal.',
        subtitle: 'When your listening history is connected, the deeper read will appear here.',
        detail: 'No signal is present yet.',
      },
      error: {
        title: 'We could not read your signal.',
        subtitle: 'The listening data could not be reached just now.',
        detail: 'Refresh once and the signal should return.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'We are rendering a lighter reading until the profile deepens.',
        detail: 'This is intentional, not an error.',
      },
    },
  })

  return (
    <div className="cosmic-page space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="page-header-kicker mb-2">Deep Read</p>
        <h1 className="page-header-title">Signal Reading</h1>
        <p className="page-header-copy mt-3">A quieter look at movement, light, texture, and the shape your listening takes.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>voices in view: {dataQuality?.topArtistsCount || 0}/50</span>
          <span>songs in view: {dataQuality?.topTracksCount || 0}/50</span>
          <span>deep signal: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%</span>
          <span>signal reading: {confidence?.labels?.analytics || 'soft signal'}</span>
        </div>
        {!canComputeAnalytics && (
          <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">Partial signal, visible first layer</p>
            <p className="mt-2 text-xs text-slate-400">
              Movement, mood, and artist pull are available now. Advanced chart confidence and deeper track-level metrics are still computing in the background.
            </p>
          </div>
        )}
      </motion.div>
      {boot.variant !== 'ready' && (
        <RouteStatusBanner
          variant={boot.variant}
          title={boot.title}
          subtitle={boot.subtitle}
          detail={boot.detail}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="noire-info-card rounded-[24px] p-4">
          <p className="section-label mb-2">Strongest trend</p>
          <p className="text-lg font-semibold text-white">{safeProfile.analyticsMetrics?.mood || 'Nocturnal pull'}</p>
          <p className="mt-2 text-xs text-slate-500">The dominant emotional climate currently shaping the read.</p>
        </div>
        <div className="noire-info-card rounded-[24px] p-4">
          <p className="section-label mb-2">Top artist cluster</p>
          <p className="text-lg font-semibold text-white">{safeProfile.topArtists?.[0]?.name || 'Settling now'}</p>
          <p className="mt-2 text-xs text-slate-500">The loudest anchor currently visible even before deeper clustering resolves.</p>
        </div>
        <div className="noire-info-card rounded-[24px] p-4">
          <p className="section-label mb-2">Listening balance</p>
          <p className="text-lg font-semibold text-white">{pct(af.energy) != null ? `${pct(af.energy)} / ${pct(af.valence) || 0}` : 'Soft signal'}</p>
          <p className="mt-2 text-xs text-slate-500">A quick read of intensity against brightness so the page always opens with something concrete.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon, color, desc }, i) => (
          <StatCard key={key} label={label} icon={icon} color={color} value={pct(af[key])} desc={desc} delay={i * 0.07} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ModuleBoundary
          title="Sonic shape"
          loading={loading && !profile}
          degraded={Boolean(safeProfile?.isDegraded)}
          fallback={<ShellSkeleton lines={4} />}
        >
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="noire-info-card p-5 rounded-[28px]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-white">Sonic shape</p>
            </div>
            <AudioRadar af={af} />
          </motion.div>
        </ModuleBoundary>
        <ModuleBoundary
          title="Listening entity"
          loading={loading && !profile}
          degraded={Boolean(safeProfile?.isDegraded)}
          fallback={<ShellSkeleton lines={4} />}
        >
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="noire-orb-panel p-5 rounded-[32px] flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-4 self-start">
              <Disc3 className="w-4 h-4 text-pink-400" />
              <p className="text-sm font-semibold text-white">The listening entity</p>
            </div>
            <DeferredSoulOrb
              personality={safeProfile.personality}
              personalityMeta={safeProfile.personalityMeta}
              mbti={safeProfile.mbti}
              mbtiMeta={safeProfile.mbtiMeta}
              audioFeatures={safeProfile.audioFeatures}
              analyticsMetrics={safeProfile.analyticsMetrics}
              confidence={safeProfile.confidence}
              dataQuality={safeProfile.dataQuality}
              genres={safeProfile.genres}
              topArtists={safeProfile.topArtists}
              size={160}
              showLabels
              lowPower={tier === 'sparse' || tier === 'limited'}
            />
          </motion.div>
        </ModuleBoundary>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="noire-info-card p-5 rounded-[28px]">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#9DB7FF]" />
            <p className="text-sm font-semibold text-white">Pulse and pace</p>
          </div>
          <TempoBar tempo={af.tempo} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="noire-info-card p-5 rounded-[28px]">
          <div className="flex items-center gap-2 mb-4">
            <Music2 className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-semibold text-white">Atmospheric spread</p>
          </div>
          <DiversityPie genres={safeProfile.genres} />
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="noire-info-card p-5 rounded-[28px]">
        <div className="flex items-center gap-2 mb-4">
          <Mic2 className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-semibold text-white">The loudest pull</p>
        </div>
        <ArtistFrequency topArtists={safeProfile.topArtists} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="noire-info-card p-5 rounded-[28px]">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-rose-400" />
          <p className="text-sm font-semibold text-white">The atmospheres you return to</p>
        </div>
        <GenrePills genres={safeProfile.genres} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <MusicIdentityPanel profile={safeProfile} />
      </motion.div>
    </div>
  )
}
