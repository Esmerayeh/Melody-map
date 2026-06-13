import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Brain, Compass, Disc3, Download, MessageCircle, Share2, Sparkles } from 'lucide-react'
import useMusicProfile from '../hooks/useMusicProfile'
import RouteStatusBanner from '../components/RouteStatusBanner'
import MusicIdentityPanel from '../components/MusicIdentityPanel'
import { MOTION_TOKENS } from '../features/motion/motionTokens'
import { useRouteReadiness } from '../hooks/useRouteReadiness'
import ShareableIdentityCard from '../components/identity/ShareableIdentityCard'
import { exportElementAsPng } from '../components/identity/identityCardExport'
import {
  buildIdentityShareText,
  buildSoulOrbShareText,
  copyShareText,
  getCurrentShareUrl,
  getInstagramStoryInstructions,
  shareToWhatsApp,
  shareViaSystem,
} from '../utils/shareUtils'
import { shareAPI } from '../services/api'
import SoulOrbShareCard from '../components/share/SoulOrbShareCard'

const pct = (v, max = 100) => Math.round(Math.min(Math.max((v ?? 0), 0), max))

function TraitBar({ label, value, color = '#e0a35c', icon, delay = 0 }) {
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
  const cardRef = useRef(null)
  const orbCardRef = useRef(null)
  const [shareStatus, setShareStatus] = useState('')
  const safeProfile = profile || {}

  const personality = safeProfile.personality || []
  const musicIdentity = safeProfile.musicIdentity || {}
  const identityType = musicIdentity.type || {}
  const sonicAxes = safeProfile.sonicAxes || musicIdentity.axes || []
  const identityMetrics = safeProfile.identityMetrics || musicIdentity.metrics || []
  const topIdentityMetrics = musicIdentity.topMetrics || identityMetrics.filter((metric) => metric?.available !== false).slice(0, 3)
  const traits = useMemo(() => personality.slice(0, 5), [personality])
  const identityReceipts = useMemo(() => (
    safeProfile.livingIdentity?.receipts ||
    safeProfile.spotifyEvidence?.receipts ||
    safeProfile.listeningEvidence?.receipts ||
    []
  ), [safeProfile])
  const identitySignals = useMemo(() => (
    safeProfile.identitySignals || []
  ).filter((signal) => signal?.available !== false && signal?.evidence?.length), [safeProfile])

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

  return (
    <div className="cosmic-page space-y-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={MOTION_TOKENS.focusSettle}>
        <p className="page-header-kicker mb-2">Music identity</p>
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
          <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">Identity read is already open</p>
            <p className="mt-2 text-xs text-slate-400">
              Core traits, mood strands, and the first sonic fingerprint are visible now. Advanced DNA layers deepen as more listening history settles.
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

      <div className="grid gap-4 md:grid-cols-4">
        <div className="noire-info-card rounded-[22px] p-4">
          <p className="section-label mb-2">Immediate trait</p>
          <p className="text-white font-semibold">{traits[0]?.label || 'Signal forming'}</p>
          <p className="mt-2 text-xs text-slate-500">The strongest visible contour in your current listening self.</p>
        </div>
        <div className="noire-info-card rounded-[22px] p-4">
          <p className="section-label mb-2">Top mood</p>
          <p className="text-white font-semibold">{safeProfile.analyticsMetrics?.mood || 'Needs audio features'}</p>
          <p className="mt-2 text-xs text-slate-500">The emotional weather most often repeated across your profile.</p>
        </div>
        <div className="noire-info-card rounded-[22px] p-4">
          <p className="section-label mb-2">Top genre strip</p>
          <p className="text-white font-semibold">{safeProfile.genres?.[0]?.genre || safeProfile.genres?.[0] || 'Still resolving'}</p>
          <p className="mt-2 text-xs text-slate-500">The first anchor in your visible taste DNA.</p>
        </div>
        <div className="noire-info-card rounded-[22px] p-4">
          <p className="section-label mb-2">Sonic fingerprint</p>
          <p className="text-white font-semibold">{identityType.name || safeProfile.sonicPersonalityTitle || 'Soft signal'}</p>
          <p className="mt-2 text-xs text-slate-500">A short identity label so the route never opens empty.</p>
        </div>
      </div>

      <div className="noire-panel rounded-[28px] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-header-kicker mb-2">Why this read exists</p>
            <h2 className="text-2xl font-semibold text-white">Receipts from your Spotify signal</h2>
          </div>
          <p className="text-xs text-slate-500">No static personality script. Every line below is derived from listening data.</p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            {identityReceipts.slice(0, 5).map((receipt, index) => (
              <div key={`${receipt}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-sm leading-relaxed text-slate-300">
                {receipt}
              </div>
            ))}
            {!identityReceipts.length && (
              <p className="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-sm text-slate-400">
                Melody Map needs more Spotify history before it can show identity receipts without guessing.
              </p>
            )}
          </div>
          <div className="space-y-3">
            {identitySignals.slice(0, 3).map((signal) => (
              <div key={signal.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{signal.label}</p>
                  <span className="text-sm tabular-nums" style={{ color: signal.color || '#f0c089' }}>{pct(signal.pct)}%</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{signal.evidence?.[0]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="noire-panel rounded-[32px] p-6 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_25%_20%,rgba(224,163,92,0.18),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(245,114,182,0.12),transparent_60%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 bg-white/5">
                <Sparkles className="w-5 h-5 text-brand-purple" />
              </div>
              <div>
                <p className="page-header-kicker">Music identity type</p>
                <p className="text-lg font-semibold text-white">{identityType.name || safeProfile.sonicPersonalityTitle || 'Listening self'}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-300">
              {musicIdentity.poeticLine || safeProfile.musicIdentitySummary || identityType.description || 'The inner reading is still forming, but the contours are visible.'}
            </p>
            {identityType.tagline && (
              <p className="mt-3 text-sm italic leading-relaxed text-amber-200/80">{identityType.tagline}</p>
            )}
            <div className="mt-5 grid gap-3">
              {traits.length ? traits.map((trait, index) => (
                <TraitBar
                  key={trait.id || trait.label || index}
                  label={trait.label || trait.id || 'Trait'}
                  value={pct(trait.pct)}
                  color={trait.color || '#e0a35c'}
                  icon={trait.emoji || '✦'}
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
            <Brain className="w-4 h-4 text-amber-300" />
              <p className="page-header-kicker">Sonic axes</p>
          </div>
          {sonicAxes.length ? (
            <>
              <p className="text-sm leading-relaxed text-slate-400">
                Melody Map reads four Spotify-derived axes. These are music behavior patterns, not psychological diagnoses.
              </p>
              <div className="mt-4 space-y-3">
                {sonicAxes.map((axis) => (
                  <div key={axis.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{axis.direction}</p>
                      <span className="text-xs text-amber-200">{axis.score == null ? 'forming' : `${pct(axis.score)}%`}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{axis.left} / {axis.right}</p>
                    {axis.evidence?.[0] && <p className="mt-2 text-xs leading-relaxed text-slate-400">{axis.evidence[0]}</p>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Your identity is still forming. Deep signal: {Math.round((dataQuality?.audioCoverage || 0) * 100)}%.
            </p>
          )}
          {musicIdentity?.confidence?.missing?.length > 0 && (
            <p className="mt-3 text-[11px] text-gray-500">
              missing inputs: {musicIdentity.confidence.missing.slice(0, 4).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="noire-panel rounded-[28px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="w-4 h-4 text-sky-300" />
            <p className="page-header-kicker">Your sonic field</p>
          </div>
          <div className="space-y-3">
            {(topIdentityMetrics.length ? topIdentityMetrics : safeProfile.identityDNA || []).slice(0, 4).map((band, index) => (
              <DnaBand
                key={band.label || index}
                label={band.label || 'Signal band'}
                pct={pct(band.pct)}
                color={band.color || '#e0a35c'}
                icon={band.icon || '✧'}
                delay={index * 0.12}
              />
            ))}
            {!topIdentityMetrics.length && !safeProfile.identityDNA?.length && (
              <p className="text-xs text-gray-500">Your field metrics will appear as more Spotify signal arrives.</p>
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

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <ShareableIdentityCard ref={cardRef} profile={safeProfile} />
        <div className="noire-panel rounded-[28px] p-6">
          <p className="page-header-kicker mb-2">Share your music identity</p>
          <p className="text-sm text-slate-400">Export a visual snapshot of your identity type, sonic axes, top metrics, and evidence anchors without exposing raw listening history.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await exportElementAsPng(cardRef.current)
                    setShareStatus(result?.method === 'preview'
                      ? 'Mobile browser opened the card in a new tab for saving.'
                      : 'Identity card downloaded.')
                  } catch (error) {
                    setShareStatus(error.message || 'Identity card export failed.')
                  }
                }}
                className="touch-target flex items-center justify-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-100"
              >
                <Download className="h-4 w-4" />
                Download image
              </button>
            <button
              type="button"
                onClick={async () => {
                  const shareText = buildIdentityShareText(safeProfile)
                  try {
                    await copyShareText(shareText)
                    await shareAPI.identityCard({
                      archetype: identityType.name || safeProfile?.personality?.[0]?.label || safeProfile?.sonicPersonalityTitle,
                      identityType: identityType.name,
                    topGenres: (safeProfile?.genres || []).map((item) => item.genre || item),
                  }).catch(() => {})
                  setShareStatus('Share text copied.')
                  } catch (error) {
                    setShareStatus(error.message || 'Could not copy share text.')
                  }
                }}
                className="touch-target flex items-center justify-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm text-rose-100"
              >
                <Share2 className="h-4 w-4" />
                Copy share text
              </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await shareViaSystem({
                    title: 'My Melody Map identity',
                    text: buildIdentityShareText(safeProfile),
                    url: getCurrentShareUrl(),
                  })
                  setShareStatus('Share sheet opened, or the text was copied as a fallback.')
                } catch (error) {
                  setShareStatus(error.message || 'Could not open the share sheet.')
                }
              }}
              className="touch-target flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
            >
              <Share2 className="h-4 w-4" />
              Share results
            </button>
            <button
              type="button"
              onClick={() => {
                shareToWhatsApp({ text: buildIdentityShareText(safeProfile), url: getCurrentShareUrl() })
                setShareStatus('WhatsApp share opened.')
              }}
              className="touch-target flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
            </div>
          <p className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-400">
            Instagram Story: {getInstagramStoryInstructions()}
          </p>
          {shareStatus ? <p className="mt-4 text-xs text-slate-500">{shareStatus}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <SoulOrbShareCard ref={orbCardRef} profile={safeProfile} />
        <div className="noire-panel rounded-[28px] p-6">
          <p className="page-header-kicker mb-2">Soul Orb share card</p>
          <p className="text-sm text-slate-400">
            A dedicated orb snapshot with energy, valence, danceability, and a poetic identity summary.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await exportElementAsPng(orbCardRef.current, 'melody-map-soul-orb.png')
                  setShareStatus('Soul Orb card downloaded.')
                } catch (error) {
                  setShareStatus(error.message || 'Soul Orb export failed.')
                }
              }}
              className="touch-target rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-100"
            >
              Download orb card
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await shareViaSystem({
                    title: 'My Melody Map Soul Orb',
                    text: buildSoulOrbShareText(safeProfile),
                    url: getCurrentShareUrl(),
                  })
                  setShareStatus('Soul Orb share opened, or copied as a fallback.')
                } catch (error) {
                  setShareStatus(error.message || 'Could not share the Soul Orb.')
                }
              }}
              className="touch-target rounded-full border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm text-rose-100"
            >
              Share orb
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">{getInstagramStoryInstructions()}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/universe"
          className="noire-chip rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'rgba(224,163,92,0.18)', border: '1px solid rgba(224,163,92,0.32)' }}
        >
          Enter the galaxy
        </Link>
        <Link
            to="/soulmates"
            className="noire-chip rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'rgba(244,114,182,0.16)', border: '1px solid rgba(244,114,182,0.3)' }}
        >
          Compare soulmates
        </Link>
        <Link
          to="/identity-drift"
          className="noire-chip rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'rgba(96,165,250,0.16)', border: '1px solid rgba(96,165,250,0.32)' }}
        >
          Identity drift
        </Link>
      </div>
    </div>
  )
}
