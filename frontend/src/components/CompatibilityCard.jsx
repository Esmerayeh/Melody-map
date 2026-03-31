import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Orbit, Sparkles, Stars, Wand2 } from 'lucide-react'
import DeferredSoulOrb from './DeferredSoulOrb'

function MetricCard({ label, value, detail, accent }) {
  return (
    <div className="noire-info-card rounded-[24px] p-4">
      <p className="section-label mb-2">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <p className="text-3xl font-black" style={{ color: accent }}>{value}</p>
        <div className="h-2 flex-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.82))`, boxShadow: `0 0 18px ${accent}55` }} />
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{detail}</p>
    </div>
  )
}

function ChipRow({ items, accent = '#8F75FF', empty = 'still forming' }) {
  if (!items?.length) return <p className="text-xs text-slate-500">{empty}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="noire-chip px-3 py-1.5 text-xs"
          style={{ borderColor: `${accent}30`, color: accent, background: `${accent}12` }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function TrackCard({ track, accent }) {
  return (
    <div className="noire-panel-soft rounded-[22px] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{track.title}</p>
          <p className="mt-1 text-xs text-slate-400">{track.artist || 'unknown voice'}</p>
        </div>
        <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}28` }}>
          {track.score}
        </span>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">{track.reason}</p>
    </div>
  )
}

function IdentityColumn({ profile, side, accent }) {
  const mbti = profile?.mbti || {}
  const title = profile?.sonicPersonalityTitle || mbti?.name || 'Listening self'
  const traits = (profile?.personality || profile?.personalityTraits || []).slice(0, 4)
  return (
    <div className="noire-panel rounded-[28px] p-5">
      <p className="section-label mb-3">{side}</p>
      <p className="text-3xl font-black" style={{ color: accent }}>{mbti?.type || 'signal'}</p>
      <p className="mt-1 text-lg font-semibold text-white">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        {profile?.musicIdentitySummary || mbti?.desc || 'A quieter identity read is still taking shape here.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {traits.map((trait) => (
          <span key={trait.id || trait.label} className="noire-chip px-3 py-1.5 text-xs" style={{ color: trait.color || accent, borderColor: `${trait.color || accent}30`, background: `${trait.color || accent}12` }}>
            {trait.label || trait.id}
          </span>
        ))}
      </div>
    </div>
  )
}

function ShareCard({ result, userAName, userBName, shareHref }) {
  const [copied, setCopied] = useState(false)
  const shareText = `${userAName} × ${userBName} · ${result.relationshipArchetype} · ${result.overallCompatibility}%`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareHref ? `${shareText}\n${shareHref}` : shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="noire-action-card rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label mb-2">Shareable Card</p>
          <p className="text-xl font-black text-white">{result.relationshipArchetype}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {userAName} and {userBName} resolve as a {result.compatibilityTier} pairing, held together by {result.sharedAtmosphere?.[0] || 'a quieter shared pull'}.
          </p>
        </div>
        <button
          onClick={copy}
          className="noire-chip flex items-center gap-2 px-3 py-2 text-xs text-slate-200 transition-all hover:border-brand-purple/40 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'held close' : 'copy result'}
        </button>
      </div>
    </div>
  )
}

export default function CompatibilityCard({
  result,
  userAName = 'You',
  userBName = 'Soulmate',
  userAProfile = null,
  userBProfile = null,
  shareHref = '',
}) {
  const profileA = userAProfile || result?.profile_a || null
  const profileB = userBProfile || result?.profile_b || null
  const leftOrb = useMemo(() => ({
    ...(profileA || {}),
    mode: 'soulmate',
    resonance: {
      kind: result?.tensionScore >= 62 ? 'edge' : 'artist',
      mode: result?.overallCompatibility >= 75 ? 'focused' : 'live',
      explanation: result?.orbNarrative,
    },
  }), [profileA, result])
  const rightOrb = useMemo(() => ({
    ...(profileB || {}),
    mode: 'soulmate',
    resonance: {
      kind: result?.tensionScore >= 62 ? 'edge' : 'region',
      mode: result?.overallCompatibility >= 75 ? 'focused' : 'live',
      explanation: result?.orbNarrative,
    },
  }), [profileB, result])

  if (!result) return null

  const metrics = [
    {
      label: 'overall compatibility',
      value: result.overallCompatibility ?? result.match_score ?? 0,
      detail: result.compatibilityNarrative,
      accent: '#B68DFF',
    },
    {
      label: 'emotional resonance',
      value: result.emotionalCompatibility ?? 0,
      detail: 'how similarly you feel through music',
      accent: '#F28DDF',
    },
    {
      label: 'discovery edge',
      value: result.discoveryCompatibility ?? 0,
      detail: 'how likely you are to lead each other somewhere new',
      accent: '#9FD0FF',
    },
    {
      label: 'beautiful tension',
      value: result.tensionScore ?? 0,
      detail: 'how differently you carry the same night',
      accent: '#F5B97A',
    },
  ]

  return (
    <div className="space-y-5">
      <section className="noire-orb-panel relative overflow-hidden rounded-[34px] p-6 lg:p-8">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_45%,rgba(182,141,255,0.22),transparent_36%),radial-gradient(ellipse_at_20%_30%,rgba(242,141,223,0.12),transparent_30%),radial-gradient(ellipse_at_78%_68%,rgba(159,208,255,0.12),transparent_34%)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-white/10" style={{ backgroundImage: profileA?.avatar ? `url(${profileA.avatar})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div>
                <p className="text-lg font-semibold text-white">{userAName}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{profileA?.mbti?.type || profileA?.mbtiType || 'soft signal'}</p>
              </div>
            </div>
            <DeferredSoulOrb {...leftOrb} size={180} showLabels={false} />
          </div>

          <div className="mx-auto max-w-md text-center">
            <p className="page-header-kicker mb-3">The Dual Orbit</p>
            <h2 className="text-4xl font-black text-white lg:text-5xl">{result.relationshipArchetype}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.archetypeSummary}</p>
            <div className="mx-auto mt-5 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3">
              <HeartHandshake className="h-4 w-4 text-brand-purple" />
              <span className="text-3xl font-black text-white">{result.overallCompatibility}</span>
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">{result.compatibilityTier}</span>
            </div>
            <p className="mt-4 text-sm italic text-slate-300">{result.compatibilityNarrative}</p>
          </div>

          <div className="flex flex-col items-center gap-3 text-center lg:items-end lg:text-right">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{userBName}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{profileB?.mbti?.type || profileB?.mbtiType || 'soft signal'}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-white/10" style={{ backgroundImage: profileB?.avatar ? `url(${profileB.avatar})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            </div>
            <DeferredSoulOrb {...rightOrb} size={180} showLabels={false} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <IdentityColumn profile={profileA} side={userAName} accent="#B68DFF" />
            <IdentityColumn profile={profileB} side={userBName} accent="#9FD0FF" />
          </div>

          <div className="noire-panel rounded-[28px] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Stars className="h-4 w-4 text-brand-purple" />
              <p className="section-label">How Your Personalities Meet</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{result.mbtiNarrative}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">shared traits</p>
                <ChipRow items={result.sharedTraits} />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">where it differs</p>
                <ChipRow items={result.contrastingTraits} accent="#F5B97A" empty="the polarity is quiet here" />
              </div>
            </div>
          </div>

          <div className="noire-panel rounded-[28px] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Orbit className="h-4 w-4 text-brand-purple" />
              <p className="section-label">Soul Orb Resonance</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{result.orbNarrative}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MetricCard label="orb resonance" value={result.orbResonanceScore} detail={result.orbHarmony || 'asymmetrical'} accent="#B68DFF" />
              <MetricCard label="phase alignment" value={result.phaseAlignment || result.orbResonanceScore} detail="how cleanly the pulse settles" accent="#9FD0FF" />
              <MetricCard label="rarity" value={result.rarityScore} detail={result.rarityLabel || 'uncommon'} accent="#F28DDF" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="noire-panel rounded-[28px] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-purple" />
              <p className="section-label">Shared Taste / Shared Atmosphere</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{result.sharedAtmosphereNarrative}</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">shared artists</p>
                <ChipRow items={result.sharedArtists} />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">shared genres</p>
                <ChipRow items={result.sharedGenres} accent="#9FD0FF" />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">shared atmosphere</p>
                <ChipRow items={result.sharedAtmosphere} accent="#F28DDF" empty="your overlap arrives more through behavior than mood labels" />
              </div>
            </div>
          </div>

          <div className="noire-action-card rounded-[28px] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-brand-purple" />
              <p className="section-label">Beautiful Tension</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{result.beautifulTensionNarrative}</p>
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">tension type</p>
              <p className="mt-2 text-lg font-semibold text-white">{result.tensionType || 'gentle contrast'}</p>
              <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#F28DDF,#F5B97A)] shadow-[0_0_24px_rgba(242,141,223,0.34)]" style={{ width: `${result.tensionScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="noire-panel rounded-[28px] p-5">
          <p className="section-label mb-3">Songs Between You</p>
          <p className="text-sm leading-relaxed text-slate-300">{result.discoveryNarrative}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(result.bridgeTracks || []).slice(0, 6).map((track) => (
              <TrackCard key={`${track.title}-${track.artist}`} track={track} accent="#B68DFF" />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="noire-action-card rounded-[28px] p-5">
            <p className="section-label mb-3">From {userAName}, for {userBName}</p>
            <div className="space-y-3">
              {(result.userAToUserBRecommendations || []).slice(0, 3).map((track) => (
                <TrackCard key={`${track.title}-${track.artist}-a`} track={track} accent="#9FD0FF" />
              ))}
            </div>
          </div>

          <div className="noire-action-card rounded-[28px] p-5">
            <p className="section-label mb-3">From {userBName}, for {userAName}</p>
            <div className="space-y-3">
              {(result.userBToUserARecommendations || []).slice(0, 3).map((track) => (
                <TrackCard key={`${track.title}-${track.artist}-b`} track={track} accent="#F28DDF" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <ShareCard result={result} userAName={userAName} userBName={userBName} shareHref={shareHref} />

      {result.note && <p className="text-xs text-amber-300/80">{result.note}</p>}
    </div>
  )
}
