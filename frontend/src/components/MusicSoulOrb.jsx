/**
 * MusicSoulOrb
 * A glowing gradient sphere that visualises the user's personality traits.
 * Colors are blended from the top-3 archetype colors weighted by their pct.
 * Uses react-three-fiber for the 3D sphere with additive glow.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { motion } from 'framer-motion'

// ── Hex → THREE.Color ─────────────────────────────────────────────────────────
function hexToThree(hex) {
  const c = new THREE.Color(hex)
  return c
}

// ── Blend multiple hex colors by weights ──────────────────────────────────────
function blendColors(traits) {
  if (!traits.length) return '#a78bfa'
  const total = traits.reduce((s, t) => s + (t.pct || 0), 0) || 100
  const r = traits.reduce((s, t) => s + parseInt((t.color || '#a78bfa').slice(1, 3), 16) * t.pct, 0) / total
  const g = traits.reduce((s, t) => s + parseInt((t.color || '#a78bfa').slice(3, 5), 16) * t.pct, 0) / total
  const b = traits.reduce((s, t) => s + parseInt((t.color || '#a78bfa').slice(5, 7), 16) * t.pct, 0) / total
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

// ── Inner 3D orb ───────────────────────────────────────────────────────────────
function OrbMesh({ traits }) {
  const meshRef = useRef()
  const primaryColor   = traits[0]?.color || '#a78bfa'
  const secondaryColor = traits[1]?.color || '#60a5fa'
  const blended        = useMemo(() => blendColors(traits), [traits])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    meshRef.current.rotation.y = t * 0.18
    meshRef.current.rotation.x = Math.sin(t * 0.12) * 0.15
    // Sine-based float
    meshRef.current.position.y = Math.sin(t * 0.6) * 0.08
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshDistortMaterial
        color={blended}
        emissive={primaryColor}
        emissiveIntensity={0.6}
        roughness={0.1}
        metalness={0.4}
        distort={0.35}
        speed={1.8}
        toneMapped={false}
      />
    </mesh>
  )
}

// ── Canvas wrapper ─────────────────────────────────────────────────────────────
function OrbCanvas({ traits }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={2} color={traits[0]?.color || '#a78bfa'} />
      <pointLight position={[-3, -2, -2]} intensity={1} color={traits[1]?.color || '#60a5fa'} />

      <OrbMesh traits={traits} />

      <EffectComposer>
        <Bloom intensity={1.8} luminanceThreshold={0.1} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}

// ── Public component ───────────────────────────────────────────────────────────
const FALLBACK_TRAITS = [
  { id: 'dreamy', label: 'Dreamy', emoji: '🌙', color: '#a78bfa', pct: 60 },
  { id: 'cosmic', label: 'Cosmic', emoji: '🪐', color: '#60a5fa', pct: 40 },
]

export default function MusicSoulOrb({ personality, size = 180, showLabels = true }) {
  const traits   = (Array.isArray(personality) && personality.length > 0) ? personality : FALLBACK_TRAITS
  const topTrait = traits[0]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Orb */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Ambient glow ring */}
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${topTrait.color} 0%, transparent 70%)` }}
        />
        <OrbCanvas traits={traits} />
      </div>

      {/* Trait labels */}
      {showLabels && (
        <div className="flex flex-col items-center gap-1">
          {traits.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="flex items-center gap-2 text-xs"
            >
              <span>{t.emoji}</span>
              <span className="font-semibold" style={{ color: t.color }}>{t.pct}%</span>
              <span className="text-gray-400">{t.label}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
