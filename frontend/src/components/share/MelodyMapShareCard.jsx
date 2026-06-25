import { forwardRef } from 'react'
import { deriveWarmOrbColors } from '../../features/orb/orbProfile'

const pctOf = (v) => (v == null ? null : Math.round(v * 100))

// One unified, on-aesthetic share card for the whole music identity: the Soul Orb,
// identity type + its unique tagline, personality/MBTI, sonic axes, every signal
// percentage (identity metrics + audio features) as bars, and the orbiting anchors.
// Built on the Melody Map dark-plum glass palette (the orb itself stays
// taste-coloured). Pure layered gradients + solid bars — no backdrop-filter / masks
// / blend modes — so it renders identically in the exported PNG.
export default forwardRef(function MelodyMapShareCard({ profile = {} }, ref) {
  const c = deriveWarmOrbColors(profile)
  const musicIdentity = profile.musicIdentity || {}
  const identityType = musicIdentity.type || {}
  const personality = profile.personality || []
  const audio = profile.audioFeatures || {}

  const name = profile.userProfile?.name || profile.displayName || 'You'
  const archetype = identityType.name || personality?.[0]?.label || profile.sonicPersonalityTitle || 'Listening self'
  // The unique characterisation of this listener.
  const tagline = identityType.tagline || profile.analyticsMetrics?.mood || 'a sound still forming'
  const summary = profile.musicIdentitySummary
    || profile.livingIdentity?.summary
    || profile.livingIdentity?.receipts?.[0]
    || ''
  const mbti = profile.mbti?.type || null
  const trait = personality?.[0]?.label || null
  const orbName = profile.orbName || profile.soulOrbProfile?.name || 'Soul Orb'

  const axes = (profile.sonicAxes || musicIdentity.axes || [])
    .map((a) => a.direction || a)
    .filter(Boolean)
    .slice(0, 4)
  const artists = (profile.topArtists || []).map((a) => a.name || a).filter(Boolean).slice(0, 5)
  const genres = (profile.genres || []).map((g) => g.genre || g).filter(Boolean).slice(0, 5)
  const anchors = artists.length ? artists : genres

  // Percentages of all things — identity top metrics first, then audio features.
  const topMetrics = (musicIdentity.topMetrics || profile.identityMetrics || [])
    .filter((m) => m?.available !== false && m?.pct != null)
    .map((m) => ({ label: m.label, pct: Math.round(m.pct) }))
  const audioMetrics = [
    ['Energy', pctOf(audio.energy)],
    ['Valence', pctOf(audio.valence)],
    ['Danceability', pctOf(audio.danceability)],
    ['Acousticness', pctOf(audio.acousticness)],
  ].filter(([, v]) => v != null).map(([label, p]) => ({ label, pct: p }))
  const metrics = [...topMetrics, ...audioMetrics].slice(0, 6)

  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      ref={ref}
      className="share-card relative w-full max-w-full overflow-hidden rounded-[32px] p-6 sm:p-7"
      style={{ minHeight: 760 }}
    >
      {/* Plum cosmic backdrop (Melody Map aesthetic) + faint star dust. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 18% 12%, ${c.glow}33, transparent 32%), radial-gradient(circle at 84% 20%, rgba(193,19,127,0.22), transparent 30%), radial-gradient(circle at 52% 94%, ${c.accent}1f, transparent 40%), linear-gradient(165deg, #301725 0%, #1d0f18 54%, #120a10 100%)`,
        }}
      />
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_16%_20%,rgba(255,255,255,0.10)_0_1px,transparent_1.6px),radial-gradient(circle_at_74%_34%,rgba(255,255,255,0.08)_0_1px,transparent_1.5px),radial-gradient(circle_at_44%_84%,rgba(255,255,255,0.06)_0_1px,transparent_1.4px)] bg-[length:120px_120px,150px_150px,180px_180px]" />
      {/* soft pink rim */}
      <div className="pointer-events-none absolute inset-0 rounded-[32px]" style={{ boxShadow: 'inset 0 0 0 1px rgba(193,19,127,0.22)' }} />

      <div className="relative z-10 flex h-full flex-col gap-5" style={{ color: '#faf5f8' }}>
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.26em]" style={{ color: '#ebccdc' }}>MELODY MAP</p>
            <p className="mt-1 text-[11px] tracking-[0.1em]" style={{ color: 'rgba(235,204,220,0.55)' }}>{name}&apos;s music identity</p>
          </div>
          <span
            className="rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em]"
            style={{ borderColor: `${c.glow}66`, color: '#faf5f8', background: 'rgba(193,19,127,0.16)' }}
          >
            {mbti || 'IDENTITY'}
          </span>
        </div>

        {/* identity type + unique tagline */}
        <div>
          <h2
            className="font-display text-4xl font-semibold leading-none sm:text-5xl"
            style={{ textShadow: `0 0 28px ${c.glow}55` }}
          >
            {archetype}
          </h2>
          <p className="mt-2 text-lg font-medium" style={{ color: '#ebccdc' }}>{tagline}</p>
          {summary ? (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'rgba(235,204,220,0.72)' }}>{summary}</p>
          ) : null}
        </div>

        {/* orb + signature */}
        <div className="flex items-center gap-5">
          <div className="relative h-32 w-32 shrink-0">
            {/* darker plum glass box behind the orb */}
            <div
              className="absolute inset-0 rounded-[24px]"
              style={{
                background: 'linear-gradient(160deg, rgba(38,18,29,0.85), rgba(24,11,18,0.92))',
                border: '1px solid rgba(193,19,127,0.22)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 30px rgba(0,0,0,0.45)',
              }}
            />
            {/* glass-marble orb (halftone dot-screen, data-driven colour) */}
            <div
              className="absolute inset-[8%] rounded-full border"
              style={{
                borderColor: `${c.glow}77`,
                backgroundImage: [
                  'radial-gradient(circle, rgba(255,250,248,0.55) 0 1.2px, transparent 1.8px)',
                  `radial-gradient(circle at 44% 40%, #fff8f0 0%, ${c.primary} 18%, ${c.accent} 48%, ${c.shadow} 76%)`,
                ].join(', '),
                backgroundSize: '7px 7px, 100% 100%',
                boxShadow: `0 0 38px ${c.glow}55, inset 0 0 28px ${c.shadow}99`,
              }}
            />
            <div
              className="absolute inset-[8%] rounded-full"
              style={{ background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85) 0%, transparent 16%)' }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.18em]" style={{ color: 'rgba(235,204,220,0.6)' }}>SOUL ORB</p>
            <p className="mt-1 text-xl font-semibold">{orbName}</p>
            {trait ? <p className="mt-1 text-sm" style={{ color: 'rgba(235,204,220,0.78)' }}>Core trait · {trait}</p> : null}
            {axes.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {axes.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'rgba(193,19,127,0.28)', background: 'rgba(193,19,127,0.12)', color: '#ebccdc' }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* every signal percentage — bars */}
        <div className="rounded-[20px] border p-4" style={{ borderColor: 'rgba(193,19,127,0.20)', background: 'rgba(38,18,29,0.45)' }}>
          <p className="text-[11px] tracking-[0.18em]" style={{ color: 'rgba(235,204,220,0.6)' }}>YOUR SIGNAL · BY THE NUMBERS</p>
          <div className="mt-3 space-y-2.5">
            {metrics.length ? metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs" style={{ color: '#faf5f8' }}>
                  <span>{m.label}</span>
                  <span style={{ color: 'rgba(235,204,220,0.8)', fontVariantNumeric: 'tabular-nums' }}>{m.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${m.pct}%`, height: '100%', borderRadius: 9999, background: `linear-gradient(90deg, ${c.primary}, ${c.glow})`, boxShadow: `0 0 10px ${c.glow}66` }} />
                </div>
              </div>
            )) : (
              <p className="text-xs" style={{ color: 'rgba(235,204,220,0.55)' }}>Metrics appear as more Spotify signal arrives.</p>
            )}
          </div>
        </div>

        {/* orbiting anchors */}
        {anchors.length ? (
          <div>
            <p className="text-[11px] tracking-[0.18em]" style={{ color: 'rgba(235,204,220,0.6)' }}>ORBITING ANCHORS</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {anchors.map((a) => (
                <span
                  key={a}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#faf5f8' }}
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* footer */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span
            className="rounded-full border px-3 py-1 text-[11px] tracking-[0.14em]"
            style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: 'rgba(235,204,220,0.75)' }}
          >
            Generated {date}
          </span>
          <p className="text-[11px] tracking-[0.18em]" style={{ color: 'rgba(235,204,220,0.7)' }}>melodymap.site</p>
        </div>
      </div>
    </div>
  )
})
