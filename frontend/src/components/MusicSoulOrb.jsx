import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { AnimatePresence, motion } from 'framer-motion'
import useSoulOrbController from '../features/orb/useSoulOrbController'
import useLiveTasteSignal from '../hooks/useLiveTasteSignal'
import useAdaptiveExperience from '../hooks/useAdaptiveExperience'
import '../features/orb/SoulOrbShaderMaterial'
import { MOTION_FLOAT, MOTION_TOKENS } from '../features/motion/motionTokens'
import SoulTooltip from './premium/SoulTooltip'

function OrbConnectionThreads({ color, opacity, count = 1 }) {
  const paths = useMemo(() => (
    Array.from({ length: Math.max(1, count) }, (_, index) => {
      const offset = (index - (count - 1) / 2) * 14
      return `M ${14 + index * 6} ${108 + index * 16} C ${52 + offset} ${88 - index * 10}, ${118 - offset} ${36 + index * 12}, 164 ${18 + index * 14}`
    })
  ), [count])

  if (opacity <= 0) return null

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 180 180" fill="none">
      {paths.map((path, index) => (
        <motion.path
          key={path}
          d={path}
          stroke={color}
          strokeWidth={index === 0 ? 1.4 : 1}
          initial={{ pathLength: 0.82, strokeOpacity: 0 }}
          animate={{ pathLength: 1, strokeOpacity: opacity * (index === 0 ? 1 : 0.72) }}
          strokeLinecap="round"
          strokeDasharray={index % 2 === 0 ? '0 0' : '3 6'}
          filter="url(#thread-glow)"
          transition={MOTION_TOKENS.tooltip}
        />
      ))}
      <defs>
        <filter id="thread-glow">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

function OrbAura({ palette, behavior, hovered }) {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full"
        animate={{
          scale: hovered ? behavior.auraScale + 0.06 : behavior.auraScale,
          opacity: behavior.haloOpacity * 0.78,
        }}
        transition={MOTION_TOKENS.focus}
        style={{
          background: `radial-gradient(circle, ${palette.core}26 0%, ${palette.glow}14 36%, ${palette.shadow}18 58%, transparent 80%)`,
          filter: `blur(${26 + behavior.glowIntensity * 16}px)`,
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-[7%] rounded-full"
        animate={{
          scale: [1, 1.04, 1],
          opacity: [0.12, 0.2, 0.14],
        }}
        transition={{
          ...MOTION_TOKENS.breathe,
          duration: 8.2 / Math.max(behavior.pulseSpeed, 0.2),
          repeat: Infinity,
        }}
        style={{
          background: `radial-gradient(circle, ${palette.ring}16 0%, ${palette.aura}10 44%, transparent 70%)`,
          filter: 'blur(32px)',
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-[20%] rounded-full"
        animate={{ opacity: [0.05, 0.11, 0.06] }}
        transition={MOTION_TOKENS.breathe}
        style={{
          background: `radial-gradient(circle, ${palette.core}12 0%, transparent 72%)`,
          filter: 'blur(16px)',
        }}
      />
    </>
  )
}

function OrbRing({ radius, color, opacity, behavior, axis = [0, 0, 0], rotationOffset = 0, broken = false, stretch = [1, 1, 1] }) {
  const ringRef = useRef()

  useFrame(({ clock }) => {
    if (!ringRef.current) return
    const t = clock.getElapsedTime()
    ringRef.current.rotation.z = rotationOffset + t * behavior.rotationSpeed * 0.16
    ringRef.current.rotation.x = axis[0] + Math.sin(t * 0.32 + rotationOffset) * behavior.ringWarp * 0.34
    ringRef.current.rotation.y = axis[1] + Math.cos(t * 0.28 + rotationOffset) * behavior.ringWarp * 0.22
    const breathe = 1 + Math.sin(t * behavior.pulseSpeed + rotationOffset) * behavior.pulseAmplitude * 0.42
    ringRef.current.scale.set(stretch[0] * breathe, stretch[1] * breathe, stretch[2] * breathe)
  })

  return (
    <group ref={ringRef} rotation={axis}>
      <mesh rotation={[Math.PI / 2.25, 0, 0]}>
        <torusGeometry args={[radius, 0.014, 14, broken ? 92 : 164, broken ? Math.PI * 1.62 : Math.PI * 2]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  )
}

function OrbParticleHalo({ count, color, accent, behavior, lowPower = false }) {
  const groupRef = useRef()
  const particleCount = lowPower ? Math.max(6, Math.round(count * 0.6)) : count
  const particles = useMemo(
    () => Array.from({ length: particleCount }, (_, index) => ({
      id: `particle-${index}`,
      angle: (index / Math.max(particleCount, 1)) * Math.PI * 2,
      radius: 1.42 + (index % 5) * 0.18,
      drift: 0.12 + (index % 7) * 0.02,
      vertical: ((index % 6) - 2.5) * 0.06,
      size: 0.016 + (index % 3) * 0.008,
      color: index % 3 === 0 ? accent : color,
      escape: index % 8 === 0,
    })),
    [accent, color, count, particleCount],
  )

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((child, index) => {
      const particle = particles[index]
      if (!particle) return
      const radius = particle.radius + Math.sin(t * 0.22 + index) * particle.drift + (particle.escape ? Math.sin(t * 0.15 + index) * 0.18 : 0)
      const angle = t * (behavior.rotationSpeed * (particle.escape ? 0.2 : 0.14)) + particle.angle
      child.position.x = Math.cos(angle) * radius
      child.position.z = Math.sin(angle) * radius
      child.position.y = particle.vertical + Math.sin(t * 0.28 + index) * 0.05
      const pulse = 1 + Math.sin(t * behavior.pulseSpeed * 0.86 + index) * 0.14
      child.scale.setScalar(particle.size * pulse)
    })
  })

  if (!particleCount) return null

  return (
    <group ref={groupRef}>
      {particles.map((particle) => (
        <mesh key={particle.id}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color={particle.color} transparent opacity={behavior.particleOpacity * (particle.escape ? 0.75 : 1)} />
        </mesh>
      ))}
    </group>
  )
}

function OrbCore({ presentation, hovered }) {
  const outerShellRef = useRef()
  const coreRef = useRef()
  const nucleusRef = useRef()
  const shellMaterialRef = useRef()
  const plasmaMaterialRef = useRef()
  const coreMaterialRef = useRef()
  const { palette, behavior } = presentation

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const breathe = 1 + Math.sin(t * behavior.pulseSpeed) * behavior.breatheAmplitude

    if (outerShellRef.current) {
      outerShellRef.current.rotation.y = t * behavior.rotationSpeed * 0.32
      outerShellRef.current.rotation.x = Math.sin(t * 0.18) * 0.06
      outerShellRef.current.scale.setScalar(breathe + (hovered ? 0.03 : 0))
    }

    if (coreRef.current) {
      coreRef.current.rotation.y = -t * behavior.rotationSpeed * 0.72
      coreRef.current.rotation.z = Math.sin(t * 0.28 + 1.4) * behavior.rotationWobble * 0.86
      coreRef.current.scale.setScalar(0.84 + Math.sin(t * behavior.pulseSpeed * 1.08 + 1.2) * behavior.pulseAmplitude * 0.72)
    }

    if (nucleusRef.current) {
      const pulse = 0.72 + Math.sin(t * behavior.pulseSpeed * 1.2 + 0.5) * behavior.pulseAmplitude * 1.6
      nucleusRef.current.scale.setScalar(pulse)
    }

    const pulse = 0.5 + Math.sin(t * behavior.pulseSpeed * 1.1) * behavior.pulseAmplitude * 0.65
    const stateMix = presentation.shader.stateMix + Math.sin(t * 0.22) * 0.04

    if (shellMaterialRef.current) {
      shellMaterialRef.current.uTime = t
      shellMaterialRef.current.uPulse = pulse
      shellMaterialRef.current.uShellColor = new THREE.Color(palette.glow)
      shellMaterialRef.current.uEdgeColor = new THREE.Color(palette.ring).lerp(new THREE.Color('#fff7ff'), presentation.shader.fresnelIntensity * 0.24)
      shellMaterialRef.current.uShadowColor = new THREE.Color(palette.shadow)
      shellMaterialRef.current.uOpacity = presentation.shader.shellOpacity
      shellMaterialRef.current.uFocusIntensity = presentation.shader.focusIntensity
      shellMaterialRef.current.uDegradedFactor = presentation.shader.degradedFactor
    }

    if (plasmaMaterialRef.current) {
      plasmaMaterialRef.current.uTime = t
      plasmaMaterialRef.current.uPulse = presentation.shader.pulse + pulse * 0.18
      plasmaMaterialRef.current.uStateMix = stateMix
      plasmaMaterialRef.current.uCoreColor = new THREE.Color(palette.core)
      plasmaMaterialRef.current.uAuraColor = new THREE.Color(palette.glow)
      plasmaMaterialRef.current.uEdgeColor = new THREE.Color(palette.ring)
      plasmaMaterialRef.current.uShadowColor = new THREE.Color(palette.shadow)
      plasmaMaterialRef.current.uNoiseScale = presentation.shader.noiseScale
      plasmaMaterialRef.current.uNoiseSpeed = presentation.shader.noiseSpeed
      plasmaMaterialRef.current.uFocusIntensity = presentation.shader.focusIntensity
      plasmaMaterialRef.current.uDegradedFactor = presentation.shader.degradedFactor
      plasmaMaterialRef.current.uDuality = presentation.shader.duality
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.uTime = t * 0.9
      coreMaterialRef.current.uPulse = presentation.shader.pulse + pulse * 0.26
      coreMaterialRef.current.uStateMix = stateMix + 0.1
      coreMaterialRef.current.uCoreColor = new THREE.Color('#fff4ff').lerp(new THREE.Color(palette.core), 0.72)
      coreMaterialRef.current.uAuraColor = new THREE.Color(palette.core)
      coreMaterialRef.current.uEdgeColor = new THREE.Color(palette.ring)
      coreMaterialRef.current.uShadowColor = new THREE.Color(palette.shadow).lerp(new THREE.Color(palette.glow), 0.18)
      coreMaterialRef.current.uNoiseScale = presentation.shader.noiseScale * 1.14
      coreMaterialRef.current.uNoiseSpeed = presentation.shader.noiseSpeed * 1.08
      coreMaterialRef.current.uFocusIntensity = presentation.shader.focusIntensity + 0.12
      coreMaterialRef.current.uDegradedFactor = presentation.shader.degradedFactor
      coreMaterialRef.current.uDuality = presentation.shader.duality * 0.8
    }
  })

  return (
    <group>
      <mesh ref={outerShellRef}>
        <sphereGeometry args={[1.08, 72, 72]} />
        <soulOrbShellMaterial ref={shellMaterialRef} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.86, 8]} />
        <soulOrbPlasmaMaterial ref={plasmaMaterialRef} transparent depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.74, 48, 48]} />
        <soulOrbPlasmaMaterial ref={coreMaterialRef} transparent depthWrite={false} />
      </mesh>

      <mesh ref={nucleusRef}>
        <sphereGeometry args={[0.22, 28, 28]} />
        <meshBasicMaterial color="#fff4ff" transparent opacity={0.36 + presentation.shader.focusIntensity * 0.14} />
      </mesh>

      <mesh scale={[0.48, 0.48, 0.48]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color={palette.ring} transparent opacity={0.22 + presentation.shader.focusIntensity * 0.1} />
      </mesh>
    </group>
  )
}

function OrbPresenceRig({ presentation, hovered, lowPower = false }) {
  const groupRef = useRef()
  const focusBias = presentation.shader.focusIntensity
  const hoverBias = hovered ? 1 : 0

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const amplitude = MOTION_FLOAT.orb.amplitude + focusBias * 0.03
    const tilt = MOTION_FLOAT.orb.tilt + hoverBias * 0.01 + focusBias * 0.02

    groupRef.current.position.y = Math.sin(t * 0.22) * amplitude + hoverBias * 0.015
    groupRef.current.position.x = Math.cos(t * 0.16 + 0.8) * amplitude * 0.42
    groupRef.current.position.z = Math.sin(t * 0.12 + 0.3) * MOTION_FLOAT.orb.depth
    groupRef.current.rotation.x = Math.sin(t * 0.14 + 0.4) * tilt
    groupRef.current.rotation.y = Math.cos(t * 0.11 + 0.9) * tilt * 1.18
    groupRef.current.rotation.z = Math.sin(t * 0.09 + 1.1) * tilt * 0.5
  })

  return (
    <group ref={groupRef}>
      <OrbCore presentation={presentation} hovered={hovered} />
      <OrbRing radius={1.42} color={presentation.palette.ring} opacity={0.22} behavior={presentation.behavior} axis={[1.05, 0.18, 0.12]} stretch={[1.24, 0.82, 1.08]} />
      <OrbRing radius={1.62} color={presentation.palette.glow} opacity={0.18} behavior={presentation.behavior} axis={[1.2, 0.56, 0.46]} stretch={[1.38, 0.78, 1.18]} broken rotationOffset={0.9} />
      <OrbRing radius={1.86} color={presentation.palette.shell} opacity={0.12} behavior={presentation.behavior} axis={[0.94, -0.38, -0.18]} stretch={[1.58, 0.68, 1.32]} />
      <OrbParticleHalo
        count={Math.max(6, presentation.behavior.satelliteCount * 4)}
        color={presentation.palette.glow}
        accent={presentation.palette.ring}
        behavior={presentation.behavior}
        lowPower={lowPower}
      />
    </group>
  )
}

function OrbCanvas({ presentation, hovered, lowPower = false }) {
  const { palette, behavior, threads } = presentation
  const bloomIntensity = 0.72 + behavior.glowIntensity * 0.76 + (hovered ? 0.08 : 0)
  const maxDpr = typeof window === 'undefined' ? 1.5 : Math.min(1.5, window.devicePixelRatio || 1.5)
  const dpr = lowPower ? [1, 1] : [1, maxDpr]

  return (
    <>
      <OrbConnectionThreads color={palette.thread} opacity={threads.opacity} count={threads.count} />
      <Canvas
        camera={{ position: [0, 0, 3.45], fov: 42 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        dpr={dpr}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.22 + presentation.formation.complexity * 0.14} />
        <pointLight position={[3.1, 2.8, 3]} intensity={1.14 + behavior.glowIntensity} color={palette.core} />
        <pointLight position={[-2.8, -2.2, -2]} intensity={0.72 + behavior.glowIntensity * 0.55} color={palette.glow} />
        <pointLight position={[0, 2.5, -3]} intensity={0.34 + presentation.formation.score * 0.28} color={palette.ring} />

        <OrbPresenceRig presentation={presentation} hovered={hovered} lowPower={lowPower} />

        {!lowPower && (
          <EffectComposer>
            <Bloom
              intensity={bloomIntensity}
              luminanceThreshold={0.18}
              luminanceSmoothing={0.94}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </>
  )
}

function OrbDetailPanel({ presentation }) {
  const { traits, formation, descriptors, evidence, missingInputs, resonance, caption } = presentation
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={MOTION_TOKENS.panel}
      className="noire-info-card mt-3 w-full max-w-xs p-3 text-xs text-gray-300"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="uppercase tracking-[0.2em] text-gray-500">Listening Entity</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
          {presentation.variant.replace(/_/g, ' ')}
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
        <p><span className="text-gray-500">Signal:</span> {caption.micro}</p>
        <p><span className="text-gray-500">Motion:</span> {descriptors.motion}</p>
        <p><span className="text-gray-500">Texture:</span> {descriptors.texture}</p>
        <p><span className="text-gray-500">Formation:</span> {Math.round(formation.score * 100)}%</p>
        {resonance?.label && <p><span className="text-gray-500">Current resonance:</span> {resonance.label}</p>}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-gray-400">
        <p>{caption.detail}</p>
        {evidence.slice(0, 2).map((line) => <p key={line}>{line}</p>)}
        {!!missingInputs.length && (
          <p>Limited by missing inputs: {missingInputs.join(', ')}</p>
        )}
      </div>
    </motion.div>
  )
}

export default function MusicSoulOrb(props) {
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const {
    resonance = null,
    liveSignal: liveSignalProp = null,
    size = 180,
    showLabels = true,
    lowPower = false,
  } = props
  const adaptive = useAdaptiveExperience()
  const effectiveLowPower = lowPower || adaptive.lowPowerMode
  const allowHoverFx = !adaptive.isCoarsePointer && !adaptive.prefersReducedMotion

  const { signal: polledSignal } = useLiveTasteSignal({ enabled: !liveSignalProp && !effectiveLowPower && showLabels, pollMs: 15000 })
  const presentation = useSoulOrbController({ ...props, resonance, liveSignal: liveSignalProp || polledSignal })

  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.84 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={MOTION_TOKENS.focusSettle}
        className="flex flex-col items-center gap-3"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <motion.div
          animate={adaptive.prefersReducedMotion ? { y: 0, rotateX: 0, rotateY: 0 } : {
            y: [0, -MOTION_FLOAT.hero.amplitude * 0.18, 0],
            rotateX: [0.2, 1.2, 0.2],
            rotateY: [-0.4, 1.6, -0.4],
          }}
          transition={MOTION_TOKENS.heroFloat}
        >
          <motion.button
            type="button"
            whileHover={allowHoverFx ? { scale: 1.018, y: -MOTION_FLOAT.ui.amplitude, rotateX: 1.8, rotateY: -1.2 } : undefined}
            whileTap={{ scale: 0.985 }}
            transition={MOTION_TOKENS.hoverNotice}
            onClick={() => setExpanded((value) => !value)}
            className="dimensional-surface touch-target relative overflow-visible rounded-full transition-[filter] duration-300"
            aria-expanded={expanded}
            style={{ width: size, height: size }}
          >
            <OrbAura palette={presentation.palette} behavior={presentation.behavior} hovered={hovered} />
          <div
            className="pointer-events-none absolute inset-[6%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${presentation.palette.glow}18 0%, transparent 70%)`,
              filter: 'blur(30px)',
              opacity: 0.18 + presentation.formation.score * 0.08,
            }}
          />
          <div
            className="pointer-events-none absolute inset-[11%] rounded-full"
            style={{
              border: `1px solid ${presentation.palette.shell}22`,
              boxShadow: `0 0 28px ${presentation.palette.glow}08 inset`,
              opacity: 0.62,
            }}
          />
            <OrbCanvas presentation={presentation} hovered={hovered} lowPower={effectiveLowPower} />
        </motion.button>
      </motion.div>

      {showLabels && (
        <div className="flex max-w-xs flex-col items-center gap-2 text-center">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...MOTION_TOKENS.panel, delay: 0.2 }}
            className="text-xs lowercase italic tracking-[0.06em]"
            style={{ color: presentation.palette.glow, opacity: 0.94 }}
          >
            {presentation.caption.micro}
          </motion.p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: presentation.palette.core,
                borderColor: `${presentation.palette.core}40`,
                background: `${presentation.palette.core}14`,
              }}
            >
              {presentation.labels.subtitle}
            </span>
            {props.mbti?.type && (
              <span
                className="rounded-full border px-2.5 py-0.5 text-[10px] font-mono"
                style={{
                  color: presentation.palette.ring,
                  borderColor: `${presentation.palette.ring}40`,
                  background: `${presentation.palette.ring}12`,
                }}
              >
                {props.mbti.type}
              </span>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && showLabels && (
          <SoulTooltip
            title="Listening entity"
            detail={presentation.caption.detail}
            accent="lavender"
          >
            <OrbDetailPanel presentation={presentation} />
          </SoulTooltip>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
