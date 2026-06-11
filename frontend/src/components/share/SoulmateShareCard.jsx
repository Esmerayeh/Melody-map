import { forwardRef } from 'react'

function safeList(items = [], limit = 4) {
  return items.slice(0, limit).filter(Boolean)
}

export default forwardRef(function SoulmateShareCard({ match = {}, userAName = 'You', userBName = 'Soulmate' }, ref) {
  const score = Math.round(match.overallCompatibility ?? match.compatibilityScore ?? match.match_score ?? 0)
  const sharedArtists = safeList(match.sharedArtists || match.shared_artists || [])
  const sharedGenres = safeList(match.sharedGenres || match.shared_genres || [])
  const atmosphere = match.sharedAtmosphereIdentity || {}
  const duo = match.duoIdentity || {}
  const orb = match.combinedSoulOrb || {}
  const colors = orb.colors || atmosphere.palette || ['#b59cff', '#f1aadb', '#9fdcff']
  const mood = atmosphere.name || match.sharedAtmosphere?.[0] || match.moodAlignment || 'soft resonance'
  const line = duo.oneLine || match.compatibilityNarrative || match.archetypeSummary || 'Two listening worlds crossing through shared atmosphere and beautiful contrast.'

  return (
    <div ref={ref} className="share-card share-card-square relative overflow-hidden rounded-[32px] border border-white/12 p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_42%,rgba(181,156,255,0.36),transparent_28%),radial-gradient(circle_at_72%_42%,rgba(241,170,203,0.3),transparent_28%),radial-gradient(circle_at_50%_72%,rgba(159,220,255,0.14),transparent_30%),linear-gradient(160deg,#060713,#150b24_54%,#04050d)]" />
      <div className="relative z-10 flex min-h-[600px] flex-col justify-between gap-7">
        <div>
          <p className="text-sm tracking-[0.18em] text-white/62">Melody Map Soulmates</p>
          <h2 className="font-display mt-4 text-4xl font-semibold">{duo.pairName || 'Dual orbit match'}</h2>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-center">
            <div className="mx-auto h-24 w-24 rounded-full border border-white/18 shadow-[0_0_44px_rgba(181,156,255,0.35)]" style={{ background: `radial-gradient(circle at 40% 38%, #fff, ${colors[0]} 22%, #30205d 66%)` }} />
            <p className="mt-3 text-sm font-semibold">{userAName}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-6xl font-semibold leading-none">{score}%</p>
            <p className="mt-1 text-xs text-white/58">{match.relationshipArchetype || match.compatibilityTier || 'shared orbit'}</p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-24 w-24 rounded-full border border-white/18 shadow-[0_0_44px_rgba(241,170,203,0.35)]" style={{ background: `radial-gradient(circle at 40% 38%, #fff, ${colors[1] || colors[0]} 22%, #432044 66%)` }} />
            <p className="mt-3 text-sm font-semibold">{userBName}</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/28 to-transparent" />
        <p className="text-center text-sm italic leading-relaxed text-white/72">{line}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
            <p className="text-xs tracking-[0.16em] text-white/56">Shared artists</p>
            <p className="mt-2 text-sm text-white/84">{sharedArtists.join(', ') || 'Private or still forming'}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
            <p className="text-xs tracking-[0.16em] text-white/56">Shared genres</p>
            <p className="mt-2 text-sm text-white/84">{sharedGenres.join(', ') || 'Subtle overlap'}</p>
          </div>
        </div>
        <div className="rounded-full border border-white/12 bg-white/8 px-4 py-3 text-center text-xs text-white/62">
          Shared atmosphere: {typeof mood === 'number' ? `${Math.round(mood)}%` : mood}
        </div>
        <div className="flex justify-between text-xs tracking-[0.16em] text-white/58">
          <span>Share-safe summary only</span>
          <span>melodymap.site</span>
        </div>
      </div>
    </div>
  )
})
