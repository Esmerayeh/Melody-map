/**
 * HeroScene
 * Floating 3D music objects (vinyl records, music notes, album spheres)
 * rendered with react-three-fiber. Sine-based float + slow rotation.
 * Designed to sit as a decorative background in the Dashboard hero.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Float, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ── Vinyl record ───────────────────────────────────────────────────────────────
function VinylRecord({ position, color, speed = 0.4, floatAmp = 0.3 }) {
  const groupRef = useRef()
  const t0 = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime() + t0
    groupRef.current.rotation.z += speed * 0.01
    groupRef.current.position.y = position[1] + Math.sin(t * 0.5) * floatAmp
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[0.5, 0.06, 16, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.8} roughness={0.2} toneMapped={false} />
      </mesh>
      {/* Inner groove rings */}
      {[0.35, 0.22].map((r, i) => (
        <mesh key={i}>
          <torusGeometry args={[r, 0.02, 8, 48]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} metalness={0.6} roughness={0.3} toneMapped={false} />
        </mesh>
      ))}
      {/* Center label */}
      <mesh>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#1a1a2e" emissive={color} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── Album sphere ───────────────────────────────────────────────────────────────
function AlbumSphere({ position, color, size = 0.28 }) {
  const meshRef = useRef()
  const t0 = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime() + t0
    meshRef.current.rotation.y += 0.008
    meshRef.current.position.y = position[1] + Math.sin(t * 0.4) * 0.25
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 32, 32]} />
      <MeshDistortMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.15}
        metalness={0.6}
        distort={0.25}
        speed={1.5}
        toneMapped={false}
      />
    </mesh>
  )
}

// ── Music note (simple text glyph) ────────────────────────────────────────────
function MusicNote({ position, color }) {
  const ref = useRef()
  const t0 = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() + t0
    ref.current.position.y = position[1] + Math.sin(t * 0.55) * 0.3
    ref.current.rotation.z = Math.sin(t * 0.3) * 0.15
  })

  return (
    <Float ref={ref} position={position} speed={1} rotationIntensity={0.2} floatIntensity={0.3}>
      <Text fontSize={0.35} color={color} anchorX="center" anchorY="middle" toneMapped={false}>
        ♪
      </Text>
    </Float>
  )
}

// ── Scene contents ─────────────────────────────────────────────────────────────
function SceneObjects({ energy = 0.5, valence = 0.5 }) {
  // Colors shift with energy/valence
  const c1 = `hsl(${Math.round(240 + valence * 60)}, 80%, 65%)`
  const c2 = `hsl(${Math.round(300 + energy * 40)}, 75%, 60%)`
  const c3 = `hsl(${Math.round(180 + valence * 80)}, 70%, 55%)`

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[4, 4, 4]} intensity={1.5} color={c1} />
      <pointLight position={[-4, -2, 2]} intensity={1} color={c2} />

      {/* Vinyl records */}
      <VinylRecord position={[-2.8, 0.5, -1]}  color={c1} speed={0.5} />
      <VinylRecord position={[2.5,  -0.3, -2]} color={c2} speed={0.3} floatAmp={0.4} />
      <VinylRecord position={[0.2,  1.2, -3]}  color={c3} speed={0.6} floatAmp={0.2} />

      {/* Album spheres */}
      <AlbumSphere position={[-1.5, -0.8, -1.5]} color={c2} size={0.22} />
      <AlbumSphere position={[1.8,  0.9,  -1]}   color={c1} size={0.18} />
      <AlbumSphere position={[-0.5, 1.5,  -2.5]} color={c3} size={0.3} />

      {/* Music notes */}
      <MusicNote position={[-3.2, -0.5, -1]} color={c3} />
      <MusicNote position={[3.0,  0.8,  -2]} color={c1} />
      <MusicNote position={[0.8, -1.2,  -1.5]} color={c2} />

      <EffectComposer>
        <Bloom intensity={1.4} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </>
  )
}

// ── Public component ───────────────────────────────────────────────────────────
export default function HeroScene({ energy = 0.5, valence = 0.5, height = 220 }) {
  return (
    <div style={{ height, pointerEvents: 'none' }} className="w-full absolute inset-0 opacity-60">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 55 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{ background: 'transparent' }}
      >
        <SceneObjects energy={energy} valence={valence} />
      </Canvas>
    </div>
  )
}
