import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function GalaxyPostEffects() {
  // Reference UnrealBloom values (strength 1.1, radius 0.7, threshold 0.04),
  // mapped to @react-three/postprocessing. Low threshold → dreamy additive glow
  // on stars, nebulae and the warm core. mipmapBlur keeps it perf-safe.
  return (
    <EffectComposer>
      <Bloom intensity={1.1} luminanceThreshold={0.04} luminanceSmoothing={0.9} radius={0.7} mipmapBlur />
    </EffectComposer>
  )
}
