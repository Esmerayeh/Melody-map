/**
 * MusicSoulOrb — living identity orb
 *
 * Props:
 *   personality   array of archetype objects from computePersonality()
 *   mbti          object from computeMBTI()  { type, name, ... }
 *   audioFeatures object  { energy, danceability, acousticness, valence, ... }
 *   size          number (px)
 *   showLabels    boolean
 *
 * Does NOT import or call computePersonality / computeMBTI internally.
 * All computation happens in useMusicProfile → passed down as props.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { motion } from 'framer-motion'

// ── MBTI motion presets ────────────────────────────────────────────────────────
const MBTI_PRESETS = {
  // Dreamers — slow, soft, hazy
  INFP: { pulseMultiplier: 0.55, distortMultiplier: 0.7,  bloomMultiplier: 0.8,  rotateMultiplier: 0.6  },
  INFJ: { pulseMultiplier: 0.5,  distortMultiplier: 0.65, bloomMultiplier: 0.85, rotateMultiplier: 0.55 },
  ISFP: { pulseMultiplier: 0.6,  distortMultiplier: 0.75, bloomMultiplier: 0.8,  rotateMultiplier: 0.65 },
  // Warm & smooth
  ISFJ: { pulseMultiplier: 0.7,  distortMultiplier: 0.6,  bloomMultiplier: 1.1,  rotateMultiplier: 0.7  },
  ESFJ: { pulseMultiplier: 0.75, distortMultiplier: 0.55, bloomMultiplier: 1.15, rotateMultiplier: 0.75 },
  // Bright & fast
  ENFP: { pulseMultiplier: 1.4,  distortMultiplier: 1.1,  bloomMultiplier: 1.3,  rotateMultiplier: 1.3  },
  ENTP: { pulseMultiplier: 1.3,  distortMultiplier: 1.35, bloomMultiplier: 1.2,  rotateMultiplier: 1.2  },
  ESFP: { pulseMultiplier: 1.45, distortMultiplier: 1.0,  bloomMultiplier: 1.35, rotateMultiplier: 1.35 },
  // Steady & tight
  INTJ: { pulseMultiplier: 0.85, distortMultiplier: 0.5,  bloomMultiplier: 0.9,  rotateMultiplier: 0.8  },
  ISTJ: { pulseMultiplier: 0.8,  distortMultiplier: 0.45, bloomMultiplier: 0.85, rotateMultiplier: 0.75 },
  // Irregular wobble
  INTP: { pulseMultiplier: 0.9,  distortMultiplier: 1.2,  bloomMultiplier: 0.95, rotateMultiplier: 0.9  },
}
const DEFAULT_PRESET = { pulseMultiplier: 1.0, distortMultiplier: 1.0, bloomMultiplier: 1.0, rotateMultiplier: 1.0 }

// ── Artistic label generator ───────────────────────────────────────────────────
const LABEL_MAP = {
  dreamy:     ['Soft chaos',      'Dream-lit pulse',  'Velvet static',    'Midnight bloom'],
  nostalgic:  ['Golden haze',     'Warm static',      'Faded frequency',  'Amber drift'],
  chaotic:    ['Electric fracture','Raw signal',       'Neon collapse',    'Voltage bloom'],
  romantic:   ['Velvet static',   'Rose frequency',   'Tender pulse',     'Silk resonance'],
  melancholic:['Midnight bloom',  'Blue frequency',   'Quiet collapse',   'Indigo drift'],
  cosmic:     ['Stellar drift',   'Void resonance',   'Orbit static',     'Deep signal'],
}
const MBTI_LABEL_SUFFIX = {
  INFP: 'in minor key', INFJ: 'at 3am',    ISFP: 'in soft focus',
  ENFP: 'at full volume',ENTP: 'off-axis', ESFP: 'on the floor',
  INTJ: 'precisely tuned',ISTJ: 'archived',INTP: 'slightly distorted',
  ISFJ: 'warmly lit',   ESFJ: 'shared',
}

function generateLabel(primary, mbtiType) {
  const pool = LABEL_MAP[primary?.id] || ['Tuning your frequency...']
  const base = pool[Math.floor(Math.random() * pool.length)]
  const suffix = mbtiType ? MBTI_LABEL_SUFFIX[mbtiType] : null
  return suffix ? `${base} ${suffix}` : base
}

// ── Inner 3D mesh ──────────────────────────────────────────────────────────────
function OrbMesh({ primaryColor, secondaryColor, energy, danceability, acousticness, preset }) {
  const meshRef  = useRef()
  const ringRef1 = useRef()
  const ringRef2 = useRef()

  // Derive behavior values
  const pulseSpeed  = (0.4 + danceability * 1.2) * preset.pulseMultiplier
  const distort     = (0.15 + acousticness * 0.25 + (1 - acousticness) * 0.2) * preset.distortMultiplier
  const distortSpeed= pulseSpeed * 1.4

  const pColor = useMemo(() => new THREE.Color(primaryColor),   [primaryColor])
  const sColor = useMemo(() => new THREE.Color(secondaryColor), [secondaryColor])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    if (meshRef.current) {
      // Rotation — MBTI-influenced speed
      meshRef.current.rotation.y = t * 0.18 * preset.rotateMultiplier
      meshRef.current.rotation.x = Math.sin(t * 0.12 * preset.rotateMultiplier) * 0.15

      // Breathing scale — energy drives amplitude, danceability drives speed
      const breathe = 1 + Math.sin(t * pulseSpeed) * (0.04 + energy * 0.06)
      meshRef.current.scale.setScalar(breathe)

      // Float
      meshRef.current.position.y = Math.sin(t * 0.6 * preset.pulseMultiplier) * 0.08
    }

    // Pulse rings
    if (ringRef1.current) {
      const s1 = 1.15 + Math.sin(t * pulseSpeed * 0.9) * 0.08
      ringRef1.current.scale.setScalar(s1)
      ringRef1.current.material.opacity = 0.12 + Math.sin(t * pulseSpeed) * 0.06
    }
    if (ringRef2.current) {
      const s2 = 1.3 + Math.sin(t * pulseSpeed * 0.7 + 1) * 0.1
      ringRef2.current.scale.setScalar(s2)
      ringRef2.current.material.opacity = 0.07 + Math.sin(t * pulseSpeed * 0.8 + 2) * 0.04
    }
  })

  return (
    <group>
      {/* Pulse ring 1 */}
      <mesh ref={ringRef1}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={pColor} transparent wireframe={false} opacity={0.12} side={THREE.BackSide} />
      </mesh>

      {/* Pulse ring 2 */}
      <mesh ref={ringRef2}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color={sColor} transparent wireframe={false} opacity={0.07} side={THREE.BackSide} />
      </mesh>

      {/* Core orb */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={primaryColor}
          emissive={primaryColor}
          emissiveIntensity={0.5 + energy * 0.5}
          roughness={0.08 + acousticness * 0.15}
          metalness={0.3 + (1 - acousticness) * 0.3}
          distort={distort}
          speed={distortSpeed}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// ── Canvas ─────────────────────────────────────────────────────────────────────
function OrbCanvas({ primaryColor, secondaryColor, energy, danceability, acousticness, valence, preset }) {
  const bloomIntensity = (1.2 + energy * 1.0 + valence * 0.4) * preset.bloomMultiplier

  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.25 + valence * 0.2} />
      <pointLight position={[3, 3, 3]}   intensity={1.5 + energy}  color={primaryColor} />
      <pointLight position={[-3, -2, -2]} intensity={0.8 + valence} color={secondaryColor} />

      <OrbMesh
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        energy={energy}
        danceability={danceability}
        acousticness={acousticness}
        preset={preset}
      />

      <EffectComposer>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.85 + acousticness * 0.1}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}

// ── Fallback orb (no personality data yet) ────────────────────────────────────
function FallbackOrb({ size }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
        <Canvas
          camera={{ position: [0, 0, 3], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.3} />
          <pointLight position={[3, 3, 3]} intensity={1.2} color="#8b5cf6" />
          <mesh>
            <sphereGeometry args={[1, 48, 48]} />
            <MeshDistortMaterial
              color="#8b5cf6"
              emissive="#8b5cf6"
              emissiveIntensity={0.3}
              roughness={0.2}
              metalness={0.3}
              distort={0.2}
              speed={0.8}
              toneMapped={false}
            />
          </mesh>
          <EffectComposer>
            <Bloom intensity={1.0} luminanceThreshold={0.1} luminanceSmoothing={0.9} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>
      <p className="text-xs text-gray-500 italic tracking-wide">Tuning your frequency...</p>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────────
export default function MusicSoulOrb({
  personality,
  mbti,
  audioFeatures,
  size = 180,
  showLabels = true,
}) {
  // ── Safe data extraction ───────────────────────────────────────────────────
  const safeTraits = Array.isArray(personality) ? personality : []
  const primary    = safeTraits[0] || { color: '#8b5cf6', label: 'Unknown', id: 'dreamy', pct: 100 }
  const secondary  = safeTraits[1] || primary

  const af           = audioFeatures || {}
  const energy       = Math.min(1, Math.max(0, af.energy       ?? 0.5))
  const danceability = Math.min(1, Math.max(0, af.danceability ?? 0.5))
  const acousticness = Math.min(1, Math.max(0, af.acousticness ?? 0.5))
  const valence      = Math.min(1, Math.max(0, af.valence      ?? 0.5))

  const mbtiType = mbti?.type || null
  const preset   = MBTI_PRESETS[mbtiType] || DEFAULT_PRESET

  // Artistic label — stable per render (no random on every frame)
  const artisticLabel = useMemo(
    () => generateLabel(primary, mbtiType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary?.id, mbtiType]
  )

  // Render fallback if no real personality data
  if (safeTraits.length === 0) {
    return <FallbackOrb size={size} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Orb */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer ambient glow halo */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${primary.color}40 0%, ${secondary.color}15 50%, transparent 75%)`,
            filter: `blur(${12 + acousticness * 10}px)`,
            opacity: 0.5 + energy * 0.3,
            transform: 'scale(1.15)',
          }}
        />
        <OrbCanvas
          primaryColor={primary.color}
          secondaryColor={secondary.color}
          energy={energy}
          danceability={danceability}
          acousticness={acousticness}
          valence={valence}
          preset={preset}
        />
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex flex-col items-center gap-2">
          {/* Artistic label */}
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xs italic tracking-wide"
            style={{ color: primary.color, opacity: 0.85 }}
          >
            {artisticLabel}
          </motion.p>

          {/* Trait pills */}
          <div className="flex flex-col items-center gap-1">
            {safeTraits.slice(0, 3).map((t, i) => (
              <motion.div
                key={t.id || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.07 }}
                className="flex items-center gap-2 text-xs"
              >
                <span>{t.emoji}</span>
                <span className="font-semibold" style={{ color: t.color }}>{t.pct}%</span>
                <span className="text-gray-400">{t.label}</span>
              </motion.div>
            ))}
          </div>

          {/* MBTI badge */}
          {mbtiType && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold"
              style={{
                background: `${primary.color}18`,
                color: primary.color,
                border: `1px solid ${primary.color}35`,
              }}
            >
              {mbtiType}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  )
}
