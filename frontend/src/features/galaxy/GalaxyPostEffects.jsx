import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function GalaxyPostEffects() {
  // Bloom is a highlight pass, not a wash: threshold 0.32 means only genuinely
  // bright pixels (core heart, hot stars, hover glow) bloom — at the old 0.04
  // nearly every pixel qualified and the additive core stack nuked the center
  // to a white blob that erased stars and labels in front of it.
  // Was: intensity 1.1, threshold 0.04, smoothing 0.9, radius 0.7.
  return (
    <EffectComposer>
      <Bloom intensity={0.55} luminanceThreshold={0.32} luminanceSmoothing={0.65} radius={0.6} mipmapBlur />
    </EffectComposer>
  )
}
