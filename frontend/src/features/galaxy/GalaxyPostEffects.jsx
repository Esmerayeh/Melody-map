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
  // History: intensity 1.1→0.55→0.28→0.14→0.10, threshold 0.04→0.32→0.55→0.62→0.74,
  //          smoothing 0.9→0.65→0.9, radius 0.7→0.6→0.5→0.42.
  // Legibility pass: bloom was still hazing the 3D structure into fog. Dropping
  // intensity ~30% (0.14→0.10) and raising the threshold (0.62→0.74) restricts
  // bloom to only the genuinely brightest cores, so stars, orbit lines, and
  // spiral-arm structure stay crisp and the scene reads as a navigable system,
  // not a gradient. Tighter radius (0.5→0.42) keeps the glint local.
  return (
    <EffectComposer>
      <Bloom intensity={0.10} luminanceThreshold={0.74} luminanceSmoothing={0.9} radius={0.42} mipmapBlur />
    </EffectComposer>
  )
}
