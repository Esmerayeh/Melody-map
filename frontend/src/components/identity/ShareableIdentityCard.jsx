import { forwardRef } from 'react'
import { deriveWarmOrbColors } from '../../features/orb/orbProfile'

function moodFromProfile(profile) {
  return profile?.analyticsMetrics?.mood || profile?.sonicPersonalityTitle || 'moonlit drift'
}

export default forwardRef(function ShareableIdentityCard({ profile }, ref) {
  const personality = profile?.personality || []
  // Warm, valence-driven palette — same source as the live orb. Never purple.
  const c = deriveWarmOrbColors(profile || {})
  const genres = (profile?.genres || []).slice(0, 4).map((item) => item.genre || item).filter(Boolean)
  const musicIdentity = profile?.musicIdentity || {}
  const identityType = musicIdentity.type || {}
  const axes = profile?.sonicAxes || musicIdentity.axes || []
  const metrics = (musicIdentity.topMetrics || profile?.identityMetrics || []).filter((item) => item?.available !== false).slice(0, 3)
  const archetype = identityType.name || personality?.[0]?.label || profile?.sonicPersonalityTitle || 'Listening self'
  const mood = moodFromProfile(profile)
  const audio = profile?.audioFeatures || {}
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const name = profile?.userProfile?.name || profile?.displayName || 'You'
  const receiptLine = profile?.livingIdentity?.receipts?.[0] || profile?.spotifyEvidence?.receipts?.[0]
  const line = profile?.musicIdentitySummary || receiptLine || 'Melody Map needs more Spotify history before it can make a music identity claim.'

  return (
    <div
      ref={ref}
      className="share-card share-card-square relative w-full max-w-full overflow-hidden rounded-[32px] border border-white/12 p-5 text-white sm:p-7"
      style={{ minHeight: 520 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 18% 16%, ${c.glow}40, transparent 30%), radial-gradient(circle at 82% 28%, ${c.accent}26, transparent 28%), radial-gradient(circle at 48% 74%, ${c.aura}18, transparent 32%), linear-gradient(160deg, #0b0806 0%, #160d09 48%, #060403 100%)`,
        }}
      />
      <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.11)_0_1px,transparent_1.6px),radial-gradient(circle_at_76%_36%,rgba(255,255,255,0.09)_0_1px,transparent_1.5px),radial-gradient(circle_at_42%_86%,rgba(255,255,255,0.07)_0_1px,transparent_1.4px)] bg-[length:120px_120px,150px_150px,180px_180px]" />
      <div className="relative z-10 flex h-full min-h-[460px] flex-col justify-between gap-7">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-white/70">Melody Map</p>
              <p className="mt-1 text-xs text-white/45">Music identity portal</p>
            </div>
            <div className="h-12 w-12 rounded-full border border-white/20 bg-white/10" style={{ boxShadow: `0 0 28px ${c.glow}55` }} />
          </div>
          <p className="mt-9 text-sm text-white/64">{name}'s music identity</p>
          <h2 className="font-display mt-2 text-5xl font-semibold leading-none text-white sm:text-6xl" style={{ textShadow: `0 0 28px ${c.glow}55` }}>
            {archetype}
          </h2>
          <p className="mt-3 text-2xl font-semibold text-white">{identityType.tagline || mood}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/74">{line}</p>
        </div>

        <div
          className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-white/20"
          style={{
            background: `radial-gradient(circle at 45% 42%, #fff8f0 0%, ${c.primary} 16%, ${c.accent} 44%, ${c.shadow} 72%)`,
            boxShadow: `0 0 48px ${c.glow}55, 0 0 110px ${c.glow}1f`,
          }}
        >
          <div className="h-32 w-32 rounded-full border border-white/16 bg-[radial-gradient(circle_at_40%_38%,rgba(255,255,255,0.78),rgba(255,255,255,0.04)_28%,transparent_58%)]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/12 bg-black/20 p-4 backdrop-blur">
            <p className="text-[11px] tracking-[0.18em] text-white/60">Sonic axes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(axes.length ? axes.slice(0, 4).map((axis) => axis.direction) : ['still forming']).map((axis) => (
                <span key={axis} className="rounded-full border border-white/16 bg-white/8 px-3 py-1 text-xs">
                  {axis}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/12 bg-black/20 p-4 backdrop-blur">
            <p className="text-[11px] tracking-[0.18em] text-white/60">Top metrics</p>
            <div className="mt-3 space-y-2 text-sm text-white/85">
              {metrics.length ? metrics.map((metric) => (
                <p key={metric.id || metric.label}>{metric.label}: {metric.pct ?? '--'}%</p>
              )) : (
                <>
                  <p>Energy: {audio.energy == null ? '--' : `${Math.round(audio.energy * 100)}%`}</p>
                  <p>Valence: {audio.valence == null ? '--' : `${Math.round(audio.valence * 100)}%`}</p>
                  <p>Danceability: {audio.danceability == null ? '--' : `${Math.round(audio.danceability * 100)}%`}</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/12 bg-black/20 p-4 backdrop-blur">
          <p className="text-[11px] tracking-[0.18em] text-white/60">Evidence anchors</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(genres.length ? genres : ['Spotify signal forming']).slice(0, 4).map((genre) => (
              <span key={genre} className="rounded-full border border-white/16 bg-white/8 px-3 py-1 text-xs">
                {genre}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs tracking-[0.16em] text-white/75">
            Generated {date}
          </div>
          <p className="text-xs tracking-[0.18em] text-white/70">melodymap.site</p>
        </div>
      </div>
    </div>
  )
})
