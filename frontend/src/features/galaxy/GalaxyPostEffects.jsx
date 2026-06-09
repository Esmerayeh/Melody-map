import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function GalaxyPostEffects() {
  // Gentle, focused bloom: a higher luminance threshold means only the bright
  // warm core and the brightest foreground stars bloom — not the whole field.
  // mipmapBlur keeps it perf-safe.
  return (
    <EffectComposer>
      <Bloom intensity={0.95} luminanceThreshold={0.22} luminanceSmoothing={0.9} mipmapBlur />
    </EffectComposer>
  )
}
