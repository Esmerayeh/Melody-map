/**
 * MusicSoulOrb — internal emotional core of a user's music identity.
 *
 * The visuals stay dreamy and cosmic, but every layer is now grounded in:
 * - aggregate Spotify audio features
 * - personality trait hierarchy
 * - MBTI-like identity axes
 * - listening style / rarity / diversity
 * - confidence and degraded-mode metadata
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { deriveOrbProfile } from '../features/orb/orbProfile'

function OrbHaloRing({ radius, color, opacity, behavior, warped = false, rotationOffset = 0 }) {
  const ringRef = useRef()

  useFrame(({ clock }) => {
    if (!ringRef.current) return
    const t = clock.getElapsedTime()
    ringRef.current.rotation.z = rotationOffset + t * behavior.rotationSpeed * 0.18
    ringRef.current.rotation.x = warped ? Math.sin(t * 0.45) * behavior.ringWarp : 0
    ringRef.current.rotation.y = warped ? Math.cos(t * 0.38) * behavior.ringWarp * 0.8 : 0
    const scale = 1 + Math.sin(t * behavior.pulseSpeed + rotationOffset) * behavior.pulseAmplitude * 0.8
    ringRef.current.scale.set(scale, scale, scale)
  })

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2.3, 0, rotationOffset]}>
      <torusGeometry args={[radius, 0.014, 20, 160]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  )
}

function OrbSatelliteField({ count, color, accent, behavior }) {
  const groupRef = useRef()
  const satellites = useMemo(() => (
    Array.from({ length: count }, (_, index) => {
      const angle = (index / Math.max(count, 1)) * Math.PI * 2
      const radius = 1.55 + (index % 3) * 0.16
      const y = ((index % 4) - 1.5) * 0.08
      return {
        id: `satellite-${index}`,
        angle,
        radius,
        y,
        scale: 0.035 + (index % 3) * 0.01,
        color: index % 2 === 0 ? color : accent,
      }
    })
  ), [accent, color, count])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((child, index) => {
      const item = satellites[index]
      if (!item) return
      const speed = behavior.rotationSpeed * (0.28 + (index % 4) * 0.04)
      child.position.x = Math.cos(t * speed + item.angle) * item.radius
      child.position.z = Math.sin(t * speed + item.angle) * item.radius
      child.position.y = item.y + Math.sin(t * behavior.floatSpeed + index) * 0.05
      child.scale.setScalar(item.scale * (1 + Math.sin(t * behavior.pulseSpeed + index) * 0.2))
    })
  })

  if (!count) return null

  return (
    <group ref={groupRef}>
      {satellites.map((satellite) => (
        <mesh key={satellite.id}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color={satellite.color} transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  )
}

function OrbShell({ radius, color, opacity, behavior, index }) {
  const shellRef = useRef()

  useFrame(({ clock }) => {
    if (!shellRef.current) return
    const t = clock.getElapsedTime()
    shellRef.current.rotation.y = t * behavior.rotationSpeed * (0.18 + index * 0.05)
    shellRef.current.rotation.x = Math.sin(t * behavior.floatSpeed * 0.8 + index) * behavior.rotationWobble * 0.4
  })

  return (
    <mesh ref={shellRef}>
      <sphereGeometry args={[radius, 42, 42]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.BackSide} />
    </mesh>
  )
}

function OrbCore({ orbProfile, hovered }) {
  const meshRef = useRef()
  const innerRef = useRef()
  const { colors, behavior, formation } = orbProfile

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    if (meshRef.current) {
      meshRef.current.rotation.y = t * behavior.rotationSpeed
      meshRef.current.rotation.x = Math.sin(t * 0.22) * behavior.rotationWobble
      const breathe = 1 + Math.sin(t * behavior.pulseSpeed) * behavior.breatheAmplitude
      const hoverLift = hovered ? 0.04 : 0
      meshRef.current.scale.setScalar(breathe + hoverLift)
      meshRef.current.position.y = Math.sin(t * behavior.floatSpeed) * 0.08
    }

    if (innerRef.current) {
      innerRef.current.rotation.y = -t * behavior.rotationSpeed * 0.7
      innerRef.current.rotation.z = Math.sin(t * 0.3) * behavior.rotationWobble
      const innerScale = 0.82 + Math.sin(t * behavior.pulseSpeed * 1.2 + 1) * behavior.pulseAmplitude * 0.7
      innerRef.current.scale.setScalar(innerScale)
    }
  })

  return (
    <group>
      {Array.from({ length: behavior.shellCount }).map((_, index) => (
        <OrbShell
          key={`shell-${index}`}
          radius={1.07 + index * 0.14}
          color={index % 2 === 0 ? colors.secondary : colors.aura}
          opacity={(0.13 - index * 0.02) * formation.complexity}
          behavior={behavior}
          index={index}
        />
      ))}

      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.9, 6]} />
        <MeshDistortMaterial
          color={colors.secondary}
          emissive={colors.accent}
          emissiveIntensity={0.16 + behavior.glowIntensity * 0.16}
          roughness={0.1}
          metalness={0.45}
          distort={behavior.distort * 0.75}
          speed={behavior.distortSpeed * 0.8}
          transparent
          opacity={0.42 + formation.score * 0.16}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 72, 72]} />
        <MeshDistortMaterial
          color={colors.primary}
          emissive={colors.primary}
          emissiveIntensity={0.35 + behavior.glowIntensity * 0.35 + (hovered ? 0.18 : 0)}
          roughness={0.08 + (1 - formation.complexity) * 0.22}
          metalness={0.32 + behavior.distort * 0.3}
          distort={behavior.distort}
          speed={behavior.distortSpeed}
          toneMapped={false}
        />
      </mesh>

      <OrbHaloRing radius={1.28} color={colors.aura} opacity={0.18 * formation.complexity} behavior={behavior} rotationOffset={0.2} />
      <OrbHaloRing radius={1.52} color={colors.accent} opacity={0.12 * formation.complexity} behavior={behavior} warped rotationOffset={1.15} />
      <OrbSatelliteField count={behavior.satelliteCount} color={colors.secondary} accent={colors.accent} behavior={behavior} />
    </group>
  )
}

function OrbCanvas({ orbProfile, hovered }) {
  const { colors, behavior, formation } = orbProfile
  const bloomIntensity = (1 + behavior.glowIntensity * 1.4 + (hovered ? 0.25 : 0)) * formation.complexity

  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 45 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.25 + formation.complexity * 0.18} />
      <pointLight position={[3, 3, 3]} intensity={1.2 + behavior.glowIntensity} color={colors.primary} />
      <pointLight position={[-3, -2, -2]} intensity={0.8 + behavior.glowIntensity * 0.55} color={colors.secondary} />
      <pointLight position={[0, 2.5, -3]} intensity={0.45 + formation.score * 0.3} color={colors.accent} />

      <OrbCore orbProfile={orbProfile} hovered={hovered} />

      <EffectComposer>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.88}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}

function OrbDetailPanel({ orbProfile }) {
  const { traits, labels, formation, descriptors, evidence, missingInputs } = orbProfile
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="mt-3 w-full max-w-xs rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-gray-300 backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="uppercase tracking-[0.2em] text-gray-500">Soul Formation</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
          {labels.subtitle}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[traits.primary, traits.secondary, traits.tertiary].filter(Boolean).map((trait) => (
          <span
            key={trait.id}
            className="rounded-full border border-white/10 px-2.5 py-1"
            style={{ color: trait.color, background: `${trait.color}15` }}
          >
            {trait.label}
          </span>
        ))}
      </div>

      <div className="space-y-1.5">
        <p><span className="text-gray-500">Motion:</span> {descriptors.motion}</p>
        <p><span className="text-gray-500">Texture:</span> {descriptors.texture}</p>
        <p><span className="text-gray-500">Listening style:</span> {descriptors.listening}</p>
        <p><span className="text-gray-500">Formation:</span> {Math.round(formation.score * 100)}%</p>
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-gray-400">
        {evidence.slice(0, 3).map((line) => <p key={line}>{line}</p>)}
        {!!missingInputs.length && (
          <p>Limited by missing inputs: {missingInputs.join(', ')}</p>
        )}
      </div>
    </motion.div>
  )
}

export default function MusicSoulOrb({
  personality,
  personalityMeta,
  mbti,
  mbtiMeta,
  audioFeatures,
  analyticsMetrics,
  confidence,
  dataQuality,
  genres,
  topArtists,
  size = 180,
  showLabels = true,
}) {
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const orbProfile = useMemo(() => deriveOrbProfile({
    personality,
    personalityMeta,
    mbti,
    mbtiMeta,
    audioFeatures,
    analyticsMetrics,
    confidence,
    dataQuality,
    genres,
    topArtists,
  }), [
    personality,
    personalityMeta,
    mbti,
    mbtiMeta,
    audioFeatures,
    analyticsMetrics,
    confidence,
    dataQuality,
    genres,
    topArtists,
  ])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.84 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="flex flex-col items-center gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded((value) => !value)}
        className="relative"
        style={{ width: size, height: size }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${orbProfile.colors.primary}45 0%, ${orbProfile.colors.secondary}18 45%, transparent 78%)`,
            filter: `blur(${14 + orbProfile.behavior.glowIntensity * 14}px)`,
            opacity: 0.48 + orbProfile.formation.complexity * 0.28 + (hovered ? 0.08 : 0),
            transform: hovered ? 'scale(1.2)' : 'scale(1.12)',
            transition: 'transform 220ms ease, opacity 220ms ease',
          }}
        />
        <div
          className="pointer-events-none absolute inset-[10%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${orbProfile.colors.accent}18 0%, transparent 70%)`,
            filter: 'blur(18px)',
            opacity: 0.28 + orbProfile.formation.score * 0.2,
          }}
        />
        <OrbCanvas orbProfile={orbProfile} hovered={hovered} />
      </motion.button>

      {showLabels && (
        <div className="flex max-w-xs flex-col items-center gap-2 text-center">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-xs italic tracking-wide"
            style={{ color: orbProfile.colors.secondary, opacity: 0.92 }}
          >
            {orbProfile.labels.title}
          </motion.p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: orbProfile.colors.primary,
                borderColor: `${orbProfile.colors.primary}40`,
                background: `${orbProfile.colors.primary}14`,
              }}
            >
              {orbProfile.labels.subtitle}
            </span>
            {mbti?.type && (
              <span
                className="rounded-full border px-2.5 py-0.5 text-[10px] font-mono"
                style={{
                  color: orbProfile.colors.accent,
                  borderColor: `${orbProfile.colors.accent}40`,
                  background: `${orbProfile.colors.accent}14`,
                }}
              >
                {mbti.type}
              </span>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && showLabels && <OrbDetailPanel orbProfile={orbProfile} />}
      </AnimatePresence>
    </motion.div>
  )
}
