import { forwardRef } from 'react'

export default forwardRef(function SoulOrbShareCard({ profile = {} }, ref) {
  const audio = profile.audioFeatures || {}
  const orb = profile.soulOrbProfile || {}
  const identityName = profile.musicIdentity?.type?.name || profile.sonicPersonalityTitle || 'music identity forming'
  const name = profile.orbName || orb.name || 'Soul Orb forming'
  const archetype = profile.personality?.[0]?.label || profile.analyticsMetrics?.mood || 'Listening self'
  const energy = audio.energy == null ? null : Math.round(audio.energy * 100)
  const valence = audio.valence == null ? null : Math.round(audio.valence * 100)
  const dance = audio.danceability == null ? null : Math.round(audio.danceability * 100)
  const description = orb.evidence?.[0] || profile.livingIdentity?.summary || 'Sync more Spotify listening history to evolve the orb without guessing.'

  return (
    <div ref={ref} className="share-card relative overflow-hidden rounded-[32px] border border-white/12 p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(181,156,255,0.45),transparent_28%),radial-gradient(circle_at_34%_76%,rgba(159,220,255,0.18),transparent_30%),linear-gradient(180deg,#060713,#120a24_54%,#04050d)]" />
      <div className="relative z-10 flex min-h-[560px] flex-col justify-between gap-7">
        <div>
          <p className="text-sm tracking-[0.18em] text-white/62">Melody Map Soul Orb</p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-tight">{name}</h2>
          <p className="mt-2 text-sm text-white/66">{archetype} - {identityName}</p>
        </div>
        <div className="relative mx-auto h-72 w-72">
          <div className="absolute inset-0 rounded-full border border-white/20 bg-[radial-gradient(circle_at_42%_38%,#fff8ff_0%,#f7bee5_10%,#a68cff_32%,rgba(64,57,160,0.58)_58%,rgba(9,10,27,0.06)_72%)] shadow-[0_0_70px_rgba(181,156,255,0.48),0_0_150px_rgba(159,220,255,0.15)]" />
          <div className="absolute left-[-12%] right-[-12%] top-1/2 h-14 -translate-y-1/2 rounded-[999px] border border-lavender-200/20 border-white/24 rotate-[-14deg]" />
          <div className="absolute left-[-6%] right-[-6%] top-1/2 h-10 -translate-y-1/2 rounded-[999px] border border-white/20 rotate-[18deg]" />
        </div>
        <p className="text-center text-sm italic leading-relaxed text-white/72">
          {description}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Energy', energy],
            ['Valence', valence],
            ['Danceability', dance],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[20px] border border-white/10 bg-white/8 p-3 text-center backdrop-blur">
              <p className="text-2xl font-semibold">{value == null ? '--' : `${value}%`}</p>
              <p className="mt-1 text-[11px] text-white/55">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs tracking-[0.16em] text-white/58">
          <span>Generated in orbit</span>
          <span>melodymap.site</span>
        </div>
      </div>
    </div>
  )
})
