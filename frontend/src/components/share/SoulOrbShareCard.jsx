import { forwardRef } from 'react'
import { deriveWarmOrbColors } from '../../features/orb/orbProfile'

export default forwardRef(function SoulOrbShareCard({ profile = {} }, ref) {
  const audio = profile.audioFeatures || {}
  const orb = profile.soulOrbProfile || {}
  // Warm, valence-driven palette — same source as the live orb. Never purple.
  const c = deriveWarmOrbColors(profile)
  const identityName = profile.musicIdentity?.type?.name || profile.sonicPersonalityTitle || 'music identity forming'
  const name = profile.orbName || orb.name || 'Soul Orb forming'
  const archetype = profile.personality?.[0]?.label || profile.analyticsMetrics?.mood || 'Listening self'
  const energy = audio.energy == null ? null : Math.round(audio.energy * 100)
  const valence = audio.valence == null ? null : Math.round(audio.valence * 100)
  const dance = audio.danceability == null ? null : Math.round(audio.danceability * 100)
  const description = orb.evidence?.[0] || profile.livingIdentity?.summary || 'Sync more Spotify listening history to evolve the orb without guessing.'

  return (
    <div ref={ref} className="share-card relative overflow-hidden rounded-[32px] border border-white/12 p-6 text-white">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 36%, ${c.glow}55, transparent 30%), radial-gradient(circle at 34% 78%, ${c.accent}24, transparent 32%), linear-gradient(180deg, #0b0806, #160d09 54%, #060403)`,
        }}
      />
      <div className="relative z-10 flex min-h-[560px] flex-col justify-between gap-7">
        <div>
          <p className="text-sm tracking-[0.18em] text-white/62">Melody Map Soul Orb</p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-tight">{name}</h2>
          <p className="mt-2 text-sm text-white/66">{archetype} - {identityName}</p>
        </div>
        <div className="relative mx-auto h-72 w-72">
          {/* Warm nebula orb — warm-white core → warm hue → warm accent → warm
              shadow. No rings: a nebula has none. */}
          <div
            className="absolute inset-0 rounded-full border border-white/20"
            style={{
              background: `radial-gradient(circle at 42% 38%, #fff8f0 0%, ${c.primary} 22%, ${c.accent} 50%, ${c.shadow} 74%)`,
              boxShadow: `0 0 70px ${c.glow}66, 0 0 150px ${c.glow}22`,
            }}
          />
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
