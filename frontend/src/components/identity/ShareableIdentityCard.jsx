import { forwardRef } from 'react'

function moodFromProfile(profile) {
  return profile?.analyticsMetrics?.mood || profile?.sonicPersonalityTitle || 'moonlit drift'
}

export default forwardRef(function ShareableIdentityCard({ profile }, ref) {
  const personality = profile?.personality || []
  const genres = (profile?.genres || []).slice(0, 4).map((item) => item.genre || item).filter(Boolean)
  const mbti = profile?.mbti?.type || profile?.mbti?.name || 'Soft-signal'
  const archetype = personality?.[0]?.label || profile?.sonicPersonalityTitle || 'Listening self'
  const mood = moodFromProfile(profile)
  const audio = profile?.audioFeatures || {}
  const gradient = `linear-gradient(135deg, rgba(124,111,255,0.85), rgba(${Math.round((audio.valence ?? 0.45) * 255)}, 120, 220, 0.78), rgba(${Math.round((audio.energy ?? 0.55) * 255)}, 190, 255, 0.72))`

  return (
    <div
      ref={ref}
      className="relative w-full max-w-full overflow-hidden rounded-[32px] border border-white/12 p-5 text-white sm:p-6"
      style={{ background: gradient, minHeight: 420 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(9,12,31,0.35),transparent_34%)]" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/75">Melody Map Identity</p>
          <h2 className="mt-3 text-3xl font-black leading-tight">{archetype}</h2>
          <p className="mt-2 text-sm text-white/80">{mbti} • {mood}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] bg-black/18 p-4 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Top genres</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {genres.map((genre) => (
                <span key={genre} className="rounded-full border border-white/16 bg-white/8 px-3 py-1 text-xs">
                  {genre}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-black/18 p-4 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Mood vector</p>
            <div className="mt-3 space-y-2 text-sm text-white/85">
              <p>Energy: {Math.round((audio.energy ?? 0) * 100)}%</p>
              <p>Valence: {Math.round((audio.valence ?? 0) * 100)}%</p>
              <p>Danceability: {Math.round((audio.danceability ?? 0) * 100)}%</p>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.26em] text-white/75">
            Soul Orb snapshot
          </div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/70">Melody Map</p>
        </div>
      </div>
    </div>
  )
})
