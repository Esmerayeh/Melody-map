/**
 * GalaxyLivingLayer
 * -----------------
 * Adds the "living universe" effects to GalaxyScene without touching
 * the existing node/edge/nebula code.  Mount it inside <SceneContents>
 * as a sibling of <ParallaxStarfield> etc.
 *
 * Features:
 *   TasteHeartbeat  — periodic pulse ring expanding from TasteCore position
 *   CursorGravity   — decorative dust particles that drift toward the cursor
 *   SignalParticles — tiny orbs that travel along active/highlighted edges
 *   SupernovaFlare  — shimmering ring around recently-surged artists
 *   GhostStars      — dim, translucent overlay stars for "old taste" artists
 *
 * All effects respect reducedMotion (frozen when true) and lowPower
 * (reduced counts / no extra postprocessing).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useGalaxyInteractionStore from './useGalaxyInteractionStore'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ─────────────────────────────────────────────────────────────────────────────
// 1. TasteHeartbeat
//    Expanding translucent ring emitted from the TasteCore every ~6 seconds.
// ─────────────────────────────────────────────────────────────────────────────
export function TasteHeartbeat({ core, reducedMotion = false }) {
  const ringRef  = useRef()
  const matRef   = useRef()
  const clock    = useRef({ last: 0, progress: 0, active: false })
  const INTERVAL = 6.4   // seconds between pulses
  const DURATION = 2.8   // seconds for ring to expand and fade

  const color = core?.color || '#B994FF'
  const cx    = core?.position?.x || 0
  const cy    = core?.position?.y || 0
  const cz    = core?.position?.z || 0

  useFrame(({ clock: frameClock }) => {
    if (reducedMotion) return
    const t = frameClock.getElapsedTime()
    const ck = clock.current

    if (!ck.active && t - ck.last >= INTERVAL) {
      ck.active   = true
      ck.progress = 0
      ck.last     = t
    }

    if (!ck.active) return
    ck.progress = clamp((t - ck.last) / DURATION, 0, 1)

    if (ringRef.current) {
      const s = 1 + ck.progress * 14
      ringRef.current.scale.setScalar(s)
      ringRef.current.position.set(cx, cy, cz)
    }
    if (matRef.current) {
      matRef.current.opacity = Math.max(0, 0.26 * (1 - ck.progress))
    }

    if (ck.progress >= 1) ck.active = false
  })

  return (
    <mesh ref={ringRef} position={[cx, cy, cz]}>
      <torusGeometry args={[1, 0.025, 8, 96]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} />
    </mesh>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CursorGravity
//    A small cloud of dust particles that gently orbit the pointer.
//    Uses a raycaster to project mouse → world space on the galaxy plane.
// ─────────────────────────────────────────────────────────────────────────────
const DUST_COUNT = 28

export function CursorGravity({ reducedMotion = false, sparseGraphics = false }) {
  const { camera, gl } = useThree()
  const groupRef        = useRef()
  const targetPos       = useRef(new THREE.Vector3(0, 0, 0))
  const mouse           = useRef(new THREE.Vector2(0, 0))
  const planeNormal     = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const plane           = useMemo(() => new THREE.Plane(planeNormal, 0), [planeNormal])
  const raycaster       = useMemo(() => new THREE.Raycaster(), [])

  const count = sparseGraphics ? Math.floor(DUST_COUNT * 0.5) : DUST_COUNT

  const particles = useMemo(() => (
    Array.from({ length: count }, (_, i) => ({
      angle:  (i / count) * Math.PI * 2,
      radius: 1.5 + Math.random() * 2.5,
      speed:  0.18 + Math.random() * 0.22,
      drift:  (Math.random() - 0.5) * 0.06,
      vy:     (Math.random() - 0.5) * 0.04,
      size:   0.02 + Math.random() * 0.03,
    }))
  ), [count])

  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (evt) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.set(
        ((evt.clientX - rect.left) / rect.width)  *  2 - 1,
        -((evt.clientY - rect.top)  / rect.height) *  2 + 1,
      )
    }
    canvas.addEventListener('pointermove', onMove, { passive: true })
    return () => canvas.removeEventListener('pointermove', onMove)
  }, [gl.domElement])

  useFrame(({ clock: fc }) => {
    if (reducedMotion) return
    const t = fc.getElapsedTime()

    // project mouse to world plane z=0
    raycaster.setFromCamera(mouse.current, camera)
    const worldPos = new THREE.Vector3()
    raycaster.ray.intersectPlane(plane, worldPos)
    if (worldPos) targetPos.current.lerp(worldPos, 0.06)

    const tp = targetPos.current
    if (!groupRef.current) return

    groupRef.current.children.forEach((child, i) => {
      const p = particles[i]
      if (!p) return
      const angle  = p.angle + t * p.speed
      const radius = p.radius + Math.sin(t * 0.4 + i) * 0.35
      child.position.set(
        tp.x + Math.cos(angle) * radius,
        tp.y + Math.sin(t * 0.3 + i) * 0.25 + p.drift,
        tp.z + Math.sin(angle) * radius,
      )
      const pulse = 1 + Math.sin(t * 1.4 + i) * 0.18
      child.scale.setScalar(p.size * pulse)
    })
  })

  if (reducedMotion) return null

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 6, 6]} />
          {/* Warm dust, additive so it reads as light gathering toward the pointer (zero purple). */}
          <meshBasicMaterial color="#ffe9c0" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SignalParticles
//    Tiny orbs that travel along the highlighted edges in the current model.
//    Each particle picks an edge, moves from source to target, then wraps.
// ─────────────────────────────────────────────────────────────────────────────
const SIGNAL_COUNT = 18

export function SignalParticles({ model, reducedMotion = false, sparseGraphics = false }) {
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
  const groupRef      = useRef()

  const count = sparseGraphics ? Math.floor(SIGNAL_COUNT * 0.5) : SIGNAL_COUNT

  // Pick bridge-lane edges as the travel paths
  const activeEdges = useMemo(() => {
    const edges    = model?.edges || []
    const nodeMap  = Object.fromEntries((model?.nodes || []).map((n) => [n.id, n]))
    const hlIds    = new Set([
      focusedObject?.id, focusedObject?.clusterId,
      hoveredObject?.id, hoveredObject?.clusterId,
    ].filter(Boolean))

    const lanes = edges
      .filter((e) => e.type === 'bridge_lane' || e.type === 'audio_similarity')
      .filter((e) => !hlIds.size || hlIds.has(e.source) || hlIds.has(e.target))
      .map((e) => {
        const src = nodeMap[e.source]
        const tgt = nodeMap[e.target]
        if (!src || !tgt) return null
        return {
          id:     e.id,
          srcPos: new THREE.Vector3(src.position.x, src.position.y, src.position.z),
          tgtPos: new THREE.Vector3(tgt.position.x, tgt.position.y, tgt.position.z),
          color:  src.color || '#9DB7FF',
        }
      })
      .filter(Boolean)
      .slice(0, 20)

    return lanes
  }, [model, focusedObject, hoveredObject])

  const particles = useMemo(() => (
    Array.from({ length: count }, (_, i) => ({
      edgeIndex: i % Math.max(activeEdges.length, 1),
      offset:    Math.random(),
      speed:     0.08 + Math.random() * 0.12,
    }))
  ), [count, activeEdges.length])

  useFrame(({ clock: fc }) => {
    if (reducedMotion || !groupRef.current || !activeEdges.length) return
    const t = fc.getElapsedTime()

    groupRef.current.children.forEach((child, i) => {
      const p    = particles[i]
      if (!p) return
      const edge = activeEdges[p.edgeIndex % activeEdges.length]
      if (!edge) return

      const progress = ((t * p.speed + p.offset) % 1)
      child.position.lerpVectors(edge.srcPos, edge.tgtPos, progress)
      const pulse = 1 + Math.sin(t * 2.4 + i) * 0.2
      child.scale.setScalar(0.06 * pulse)
    })
  })

  if (reducedMotion || !activeEdges.length) return null

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => {
        const edge  = activeEdges[p.edgeIndex % activeEdges.length]
        const color = edge?.color || '#9DB7FF'
        return (
          <mesh key={i}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.72} />
          </mesh>
        )
      })}
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SupernovaFlare
//    A flaring ring for "surge" artist nodes — artists that appear in
//    short_term but not in long_term (recently discovered obsessions).
//    model.nodes mark these with role === 'surge-star' or metrics.isSurge.
// ─────────────────────────────────────────────────────────────────────────────
export function SupernovaFlare({ model, reducedMotion = false }) {
  const surgeNodes = useMemo(() => (
    (model?.nodes || [])
      .filter((n) => n.role === 'surge-star' || n.metrics?.isSurge)
      .slice(0, 6)
  ), [model])

  if (!surgeNodes.length || reducedMotion) return null

  return (
    <>
      {surgeNodes.map((node) => (
        <SupernovaNode key={node.id} node={node} />
      ))}
    </>
  )
}

function SupernovaNode({ node }) {
  const ringRef  = useRef()
  const ring2Ref = useRef()
  const pos      = node.position || { x: 0, y: 0, z: 0 }
  const color    = node.color || '#FBBF24'
  const size     = (node.size || 0.5) * 2.8

  useFrame(({ clock: fc }) => {
    const t = fc.getElapsedTime()
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 1.2 + pos.x) * 0.14
      ringRef.current.scale.setScalar(s * size)
    }
    if (ring2Ref.current) {
      const s2 = 1 + Math.sin(t * 0.9 + pos.y + 1.4) * 0.09
      ring2Ref.current.scale.setScalar(s2 * size * 1.5)
    }
  })

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.04, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.32} />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1, 0.018, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} />
      </mesh>
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GhostStars
//    Translucent dim stars for "former orbit" artists — those present in
//    long_term but absent from short_term.  Marked role === 'ghost-star' or
//    metrics.isGhost on the model node.
// ─────────────────────────────────────────────────────────────────────────────
export function GhostStars({ model, reducedMotion = false }) {
  const ghosts = useMemo(() => (
    (model?.nodes || [])
      .filter((n) => n.role === 'ghost-star' || n.metrics?.isGhost)
      .slice(0, 12)
  ), [model])

  const geometry = useMemo(() => {
    if (!ghosts.length) return null
    const positions = new Float32Array(ghosts.length * 3)
    ghosts.forEach((n, i) => {
      positions[i * 3]     = n.position?.x || 0
      positions[i * 3 + 1] = n.position?.y || 0
      positions[i * 3 + 2] = n.position?.z || 0
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [ghosts])

  const matRef = useRef()

  useFrame(({ clock: fc }) => {
    if (matRef.current && !reducedMotion) {
      matRef.current.opacity = 0.12 + Math.sin(fc.getElapsedTime() * 0.28) * 0.05
    }
  })

  if (!geometry) return null

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        size={0.22}
        color="#ccd6ff"
        transparent
        opacity={0.14}
        sizeAttenuation
      />
    </points>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite export — drop this into SceneContents as a single child
// ─────────────────────────────────────────────────────────────────────────────
export default function GalaxyLivingLayer({ model, reducedMotion = false, sparseGraphics = false }) {
  const core = model?.metadata?.core

  return (
    <>
      <TasteHeartbeat   core={core}    reducedMotion={reducedMotion} />
      <CursorGravity    reducedMotion={reducedMotion} sparseGraphics={sparseGraphics} />
      <SignalParticles  model={model}  reducedMotion={reducedMotion} sparseGraphics={sparseGraphics} />
      <SupernovaFlare   model={model}  reducedMotion={reducedMotion} />
      <GhostStars       model={model}  reducedMotion={reducedMotion} />
    </>
  )
}
