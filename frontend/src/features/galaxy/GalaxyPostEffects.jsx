import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function GalaxyPostEffects() {
  // Bloom is a highlight pass, not a wash. With the galaxy living behind every
  // content route, only the genuinely brightest cores may bloom — threshold
  // lets mid-bright stars stop hazing the panels in front of them.
  // High smoothing (0.9) keeps the falloff soft so the cutoff isn't harsh.
  //
  // White-out fix: where dozens of additive stars stack near the galaxy core
  // their summed luminance blooms at full strength and the overlapping glows
  // sum to pure white. Halving intensity (0.28→0.14) is the lever that stops
  // stacked blooms reaching white, while a slightly higher threshold (0.55→
  // 0.62) and tighter radius (0.6→0.5) keep the bloom a crisp glint on the
  // brightest cores instead of a spreading haze.
  // History: intensity 1.1→0.55→0.28→0.14, threshold 0.04→0.32→0.55→0.62,
  //          smoothing 0.9→0.65→0.9, radius 0.7→0.6→0.5.
  return (
    <EffectComposer>
      <Bloom intensity={0.14} luminanceThreshold={0.62} luminanceSmoothing={0.9} radius={0.5} mipmapBlur />
    </EffectComposer>
  )
}
