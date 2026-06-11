import { useMemo, useRef, useState } from 'react'
import { Copy, Download, MessageCircle, Share2, Sparkles, Stars, Wand2, HeartHandshake } from 'lucide-react'
import DeferredSoulOrb from './DeferredSoulOrb'
import SoulmateShareCard from './share/SoulmateShareCard'
import { auralithAPI } from '../services/api'
import {
  buildSoulmateShareText,
  copyShareText,
  downloadElementAsPng,
  getInstagramStoryInstructions,
  shareToWhatsApp,
  shareViaSystem,
} from '../utils/shareUtils'

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
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{track.whyItFitsBoth || track.reason}</p>
    </div>
  )
}

function IdentityColumn({ profile, side, accent }) {
  const mbti = profile?.mbti || {}
  const identity = profile?.musicIdentity || {}
  const title = identity?.type?.name || profile?.sonicPersonalityTitle || mbti?.name || 'Listening self'
  const moodLine = identity?.type?.tagline || profile?.emotionalSignature || profile?.listeningStyle || mbti?.code || 'music identity'
  const traits = (profile?.personality || profile?.personalityTraits || []).slice(0, 4)
  return (
    <div className="noire-panel rounded-[28px] p-5">
      <p className="section-label mb-3">{side}</p>
      <p className="text-3xl font-black" style={{ color: accent }}>{title}</p>
      <p className="mt-1 text-lg font-semibold text-white">{moodLine}</p>
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

function PaletteRow({ colors = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.slice(0, 6).map((color) => (
        <span key={color} className="h-8 w-8 rounded-full border border-white/10" style={{ background: color, boxShadow: `0 0 22px ${color}44` }} />
      ))}
    </div>
  )
}

function CombinedSoulOrbPanel({ orb }) {
  if (!orb) return null
  const colors = orb.colors || ['#8f75ff', '#f28ddf', '#8baaff']
  return (
    <div className="noire-orb-panel relative overflow-hidden rounded-[28px] p-5">
      <div className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at 34% 44%, ${colors[0]}44, transparent 30%), radial-gradient(circle at 66% 48%, ${colors[1] || colors[0]}38, transparent 32%), linear-gradient(145deg, rgba(7,8,18,.94), rgba(22,12,36,.82))` }} />
      <div className="relative z-10 grid gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
        <div className="relative mx-auto h-44 w-44">
          <div className="absolute inset-5 rounded-full blur-xl" style={{ background: colors[0], opacity: 0.22 }} />
          <div className="absolute inset-8 rounded-full" style={{ background: `radial-gradient(circle at 42% 36%, #fff, ${colors[0]} 18%, ${colors[1] || colors[0]} 48%, rgba(8,9,24,.42) 72%)`, boxShadow: `0 0 ${Math.max(32, orb.haloStrength || 48)}px ${colors[0]}66` }} />
          <div className="absolute left-5 right-5 top-1/2 h-px -rotate-12" style={{ background: `linear-gradient(90deg, transparent, ${colors[2] || '#8baaff'}, transparent)` }} />
          <div className="absolute inset-2 rounded-full border border-white/14" style={{ transform: `scale(${1 + ((orb.orbitDistance || 42) / 280)})` }} />
        </div>
        <div>
          <p className="section-label mb-2">Combined soul orb</p>
          <h3 className="text-2xl font-semibold text-white">{orb.name || 'Dual orbit orb'}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{orb.description}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard label="pulse sync" value={orb.pulseSync || 0} detail={orb.mode || 'soft braided orbit'} accent={colors[0]} />
            <MetricCard label="halo" value={orb.haloStrength || 0} detail="emotional alignment" accent={colors[1] || colors[0]} />
            <MetricCard label="orbit span" value={orb.orbitDistance || 0} detail="contrast distance" accent={colors[2] || '#8baaff'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DuoIdentityPanel({ identity }) {
  if (!identity) return null
  return (
    <div className="noire-panel rounded-[28px] p-5">
      <p className="section-label mb-2">Duo music identity</p>
      <h3 className="text-3xl font-semibold text-white">{identity.pairName || identity.compatibilityArchetype || 'Shared orbit'}</h3>
      <p className="mt-2 text-sm italic leading-relaxed text-slate-300">{identity.oneLine}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">where you meet</p>
          <p className="mt-2 text-sm text-slate-300">{identity.whereYouMeet}</p>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">where you diverge</p>
          <p className="mt-2 text-sm text-slate-300">{identity.whereYouDiverge}</p>
        </div>
      </div>
    </div>
  )
}

function SharedAtmospherePanel({ atmosphere }) {
  if (!atmosphere) return null
  return (
    <div className="noire-panel rounded-[28px] p-5">
      <p className="section-label mb-2">Shared atmosphere</p>
      <h3 className="text-2xl font-semibold text-white">{atmosphere.name || 'Shared atmosphere'}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{atmosphere.explanation}</p>
      <div className="mt-4">
        <PaletteRow colors={atmosphere.palette || []} />
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">visual tags</p>
        <ChipRow items={atmosphere.visualTags || []} accent="#F28DDF" />
      </div>
      <div className="mt-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">visual search layer</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{(atmosphere.unsplashQueries || []).join(' / ') || 'No visual query generated yet.'}</p>
      </div>
    </div>
  )
}

function AuralithSoulmatePanel({ result }) {
  const [prompt, setPrompt] = useState('Why are we compatible?')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ask = async (nextPrompt = prompt) => {
    const trimmed = String(nextPrompt || '').trim()
    if (!trimmed) return
    setPrompt(trimmed)
    setLoading(true)
    setError('')
    try {
      const response = await auralithAPI.soulmate({ prompt: trimmed, comparison: result })
      setAnswer(response.data?.data || response.data)
    } catch (err) {
      setError(err?.normalized?.message || err.message || 'Auralith could not read this match yet.')
    } finally {
      setLoading(false)
    }
  }

  const prompts = ['Why are we compatible?', 'What songs would we both love?', 'Where do our tastes differ?', 'What does our shared atmosphere feel like?']

  return (
    <section className="noire-action-card rounded-[28px] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-purple" />
        <p className="section-label">Ask Auralith about this match</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="min-h-[44px] flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
          placeholder="Ask about compatibility, songs, atmosphere, or contrast"
        />
        <button type="button" onClick={() => ask()} disabled={loading} className="touch-target rounded-full border border-brand-purple/30 bg-brand-purple/15 px-5 py-3 text-sm text-white disabled:opacity-60">
          {loading ? 'Reading...' : 'Ask'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((item) => (
          <button key={item} type="button" onClick={() => ask(item)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
            {item}
          </button>
        ))}
      </div>
      {answer?.answer ? (
        <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
          <p className="text-sm leading-relaxed text-slate-200">{answer.answer}</p>
          {(answer.evidence || []).length ? (
            <div className="mt-3 space-y-2">
              {answer.evidence.slice(0, 3).map((item) => (
                <p key={item} className="text-xs leading-relaxed text-slate-500">{item}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </section>
  )
}

function ShareCard({ result, userAName, userBName, shareHref }) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('')
  const cardRef = useRef(null)
  const shareText = buildSoulmateShareText({ ...result, userAName, userBName })

  const copy = async () => {
    try {
      await copyShareText(shareHref ? `${shareText}\n${shareHref}` : shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <SoulmateShareCard ref={cardRef} match={result} userAName={userAName} userBName={userBName} />
      <div className="noire-action-card rounded-[28px] p-5">
      <div className="flex flex-col gap-4">
        <div>
          <p className="section-label mb-2">Shareable match card</p>
          <p className="text-xl font-black text-white">{result.relationshipArchetype}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {userAName} and {userBName} resolve as a {result.compatibilityTier} pairing. The card uses summary-level overlap only, never raw listening history.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={copy}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition-all hover:border-brand-purple/40 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await downloadElementAsPng(cardRef.current, 'melody-map-soulmate-match.png')
              setStatus('Match card downloaded.')
            } catch (error) {
              setStatus(error.message || 'Match card export failed.')
            }
          }}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-100"
        >
          <Download className="h-4 w-4" />
          Download match card
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await shareViaSystem({ title: 'Melody Map soulmate match', text: shareText, url: shareHref })
              setStatus('Share sheet opened, or copied as a fallback.')
            } catch (error) {
              setStatus(error.message || 'Could not share this match.')
            }
          }}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-4 py-2 text-sm text-fuchsia-100"
        >
          <Share2 className="h-4 w-4" />
          Share match
        </button>
        <button
          type="button"
          onClick={() => {
            shareToWhatsApp({ text: shareText, url: shareHref })
            setStatus('WhatsApp share opened.')
          }}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </button>
        </div>
        <p className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-400">
          Instagram Story: {getInstagramStoryInstructions()}
        </p>
        {status ? <p className="text-xs text-slate-500">{status}</p> : null}
      </div>
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
  const duoIdentity = result.duoIdentity || null
  const combinedOrb = result.combinedSoulOrb || null
  const sharedAtmosphere = result.sharedAtmosphereIdentity || null
  const songsBothMayLove = (result.songsBothMayLove?.length ? result.songsBothMayLove : result.bridgeTracks) || []

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

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <DuoIdentityPanel identity={duoIdentity} />
        <CombinedSoulOrbPanel orb={combinedOrb} />
      </section>

      {result.evidenceReceipts?.length ? (
        <section className="noire-panel rounded-[28px] p-5">
          <p className="section-label mb-3">Why this match exists</p>
          <div className="grid gap-3 md:grid-cols-2">
            {result.evidenceReceipts.slice(0, 6).map((receipt) => (
              <p key={receipt} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-sm leading-relaxed text-slate-300">
                {receipt}
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Share cards use summary overlap only and do not expose raw listening history.</p>
        </section>
      ) : null}

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

          <SharedAtmospherePanel atmosphere={sharedAtmosphere} />
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
          <p className="section-label mb-3">Songs you both may love</p>
          <p className="text-sm leading-relaxed text-slate-300">{result.discoveryNarrative}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {songsBothMayLove.slice(0, 6).map((track) => (
              <TrackCard key={`${track.title}-${track.artist}`} track={track} accent="#B68DFF" />
            ))}
            {!songsBothMayLove.length ? (
              <p className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-500">Not enough shared or bridgeable tracks are exposed yet.</p>
            ) : null}
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

      <AuralithSoulmatePanel result={result} />

      <ShareCard result={result} userAName={userAName} userBName={userBName} shareHref={shareHref} />

      {result.note && <p className="text-xs text-amber-300/80">{result.note}</p>}
    </div>
  )
}
