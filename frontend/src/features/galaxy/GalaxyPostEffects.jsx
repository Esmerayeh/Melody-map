import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function GalaxyPostEffects() {
  // Bloom is a highlight pass, not a wash. With the galaxy living behind every
  // content route, only the genuinely brightest cores may bloom — threshold
  // 0.55 lets mid-bright stars stop hazing the panels in front of them.
  // High smoothing (0.9) keeps the falloff soft so the cutoff isn't harsh.
  // History: intensity 1.1→0.55→0.28, threshold 0.04→0.32→0.55,
  //          smoothing 0.9→0.65→0.9, radius 0.7→0.6.
  return (
    <EffectComposer>
      <Bloom intensity={0.28} luminanceThreshold={0.55} luminanceSmoothing={0.9} radius={0.6} mipmapBlur />
    </EffectComposer>
  )
}
