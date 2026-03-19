import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Music2, Mic2, Zap, Heart, Activity, Disc3, BarChart2 } from 'lucide-react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie,
} from 'recharts'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicIdentityPanel from '../components/MusicIdentityPanel'
import MusicSoulOrb from '../components/MusicSoulOrb'

const clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0))
const pct = (v) => Math.round(clamp(v) * 100)
const fmt = (v) => (v != null ? Number(v).toFixed(0) : 'N/A')
const GENRE_COLORS = ['#a78bfa','#f472b6','#34d399','#60a5fa','#fbbf24','#fb923c','#e879f9','#2dd4bf']
const STAT_CARDS = [
  { key: 'energy',       label: 'Energy',       icon: Zap,      color: '#f472b6', desc: 'Intensity & activity' },
  { key: 'valence',      label: 'Positivity',   icon: Heart,    color: '#a78bfa', desc: 'Musical happiness' },
  { key: 'danceability', label: 'Danceability', icon: Activity, color: '#34d399', desc: 'Rhythm & groove' },
  { key: 'acousticness', label: 'Acousticness', icon: Music2,   color: '#60a5fa', desc: 'Acoustic vs electronic' },
]

function StatCard({ label, icon: Icon, color, value, desc, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 28 }}
      className="rounded-2xl p-5 border relative overflow-hidden"
      style={{ background: `${color}0d`, borderColor: `${color}25` }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: `${color}18` }} />
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-2xl font-black" style={{ color }}>{value}%</span>
      </div>
      <p className="text-sm font-semibold text-white relative z-10">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5 relative z-10">{desc}</p>
      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden relative z-10">
        <motion.div className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
          initial={{ width: 0 }} animate={{ width: `${value}%` }}
          transition={{ delay: delay + 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
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
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.18} strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function GenrePills({ genres }) {
  if (!genres?.length) return <p className="text-gray-500 text-sm">No genre data</p>
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
    { label: 'Mid',    range: [80,  120], color: '#a78bfa' },
    { label: 'Upbeat', range: [120, 160], color: '#f472b6' },
    { label: 'Fast',   range: [160, 300], color: '#fb923c' },
  ]
  const t = tempo || 120
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
  if (!data.length) return <p className="text-gray-500 text-sm">No artist data</p>
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
  if (!top.length) return <p className="text-gray-500 text-sm">No data</p>
  const data = top.map((g, i) => {
    const name = typeof g === 'string' ? g : g.genre
    return { name, value: Math.round(100 / top.length), color: GENRE_COLORS[i % GENRE_COLORS.length] }
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
  const { profile, loading } = useMusicProfile()
  const af = useMemo(() => profile?.audioFeatures || {}, [profile])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-brand-purple animate-spin" />
    </div>
  )

  if (!profile) return (
    <div className="p-6 max-w-7xl mx-auto">
      <p className="text-gray-400 text-sm">Connect a music source to see your analytics.</p>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">A deep look at your listening patterns and sonic identity.</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, label, icon, color, desc }, i) => (
          <StatCard key={key} label={label} icon={icon} color={color} value={pct(af[key])} desc={desc} delay={i * 0.07} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/8 bg-white/2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-semibold text-white">Audio Feature Radar</p>
          </div>
          <AudioRadar af={af} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl border border-white/8 bg-white/2 p-5 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-4 self-start">
            <Disc3 className="w-4 h-4 text-pink-400" />
            <p className="text-sm font-semibold text-white">Soul Orb</p>
          </div>
          <MusicSoulOrb
            personality={profile?.personality}
            mbti={profile?.mbti}
            audioFeatures={profile?.audioFeatures}
            size={160}
            showLabels
          />
        </motion.div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl border border-white/8 bg-white/2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-green-400" />
            <p className="text-sm font-semibold text-white">Tempo Profile</p>
          </div>
          <TempoBar tempo={af.tempo} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-2xl border border-white/8 bg-white/2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Music2 className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-semibold text-white">Genre Diversity</p>
          </div>
          <DiversityPie genres={profile.genres} />
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mic2 className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-semibold text-white">Top Artists by Popularity</p>
        </div>
        <ArtistFrequency topArtists={profile.topArtists} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-fuchsia-400" />
          <p className="text-sm font-semibold text-white">Your Genres</p>
        </div>
        <GenrePills genres={profile.genres} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <MusicIdentityPanel profile={profile} />
      </motion.div>
    </div>
  )
}
