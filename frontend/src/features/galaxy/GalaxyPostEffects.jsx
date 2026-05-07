import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function GalaxyPostEffects() {
  return (
    <EffectComposer>
      <Bloom intensity={1.1} luminanceThreshold={0.16} luminanceSmoothing={0.92} mipmapBlur />
    </EffectComposer>
  )
}
