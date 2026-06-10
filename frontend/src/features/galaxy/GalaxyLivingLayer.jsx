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
//    Drifting light-motes that ease toward the pointer, brighten mid-drift, then
//    fade as they arrive and respawn — a living warm haze, not a rigid swarm.
//    Rendered as a SINGLE THREE.Points (one draw call) with a soft additive
//    sprite; per-mote size/colour/speed variance + the whole drift cycle live in
//    the vertex shader, so the only per-frame work is advancing uTime and lerping
//    the cursor uniform — nothing is re-uploaded. Uses a raycaster to project
//    mouse → world space on the galaxy plane.
// ─────────────────────────────────────────────────────────────────────────────
const DUST_COUNT = 64

// Soft radial sprite for the motes (created once, app-lifetime — not per render).
let _DUST_TEX = null
function getDustTex() {
  if (_DUST_TEX) return _DUST_TEX
  if (typeof document === 'undefined') return null
  const size = 64
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
  _DUST_TEX = new THREE.CanvasTexture(c)
  _DUST_TEX.colorSpace = THREE.SRGBColorSpace
  return _DUST_TEX
}

// Layered warm palette (zero purple): cream + faint amber + a touch of rose.
const DUST_PALETTE = [
  new THREE.Color('#ffeccb'), // warm cream
  new THREE.Color('#ffba6e'), // faint amber
  new THREE.Color('#ff9eb0'), // touch of rose
]

export function CursorGravity({ reducedMotion = false, sparseGraphics = false }) {
  const { camera, gl } = useThree()
  const mouse       = useRef(new THREE.Vector2(0, 0))
  const planeNormal = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const plane       = useMemo(() => new THREE.Plane(planeNormal, 0), [planeNormal])
  const raycaster   = useMemo(() => new THREE.Raycaster(), [])
  const cursorWorld = useRef(new THREE.Vector3(0, 0, 0))
  const scratch     = useMemo(() => new THREE.Vector3(), [])

  const count = sparseGraphics ? Math.floor(DUST_COUNT * 0.5) : DUST_COUNT

  const points = useMemo(() => {
    const positions = new Float32Array(count * 3) // unused by shader, but required
    const seeds     = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    const colors    = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      seeds[i * 3]     = Math.random()
      seeds[i * 3 + 1] = Math.random()
      seeds[i * 3 + 2] = Math.random()
      sizes[i]         = 5 + Math.random() * 13                  // varied mote size
      const roll = Math.random()
      const base = roll < 0.58 ? DUST_PALETTE[0] : roll < 0.82 ? DUST_PALETTE[1] : DUST_PALETTE[2]
      const col  = base.clone().lerp(DUST_PALETTE[0], Math.random() * 0.4)  // bias warm
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 3))
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uCursor:     { value: new THREE.Vector3() },
        uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
        uMap:        { value: getDustTex() },
        uOpacity:    { value: 0.6 },
      },
      vertexShader: `
        attribute vec3 aSeed; attribute float aSize; attribute vec3 aColor;
        uniform float uTime; uniform vec3 uCursor; uniform float uPixelRatio;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float speed  = 0.10 + aSeed.x * 0.22;            // per-mote variance
          float p      = fract(uTime * speed + aSeed.y);   // lifecycle 0..1
          float spawnR = 2.0 + aSeed.z * 3.4;
          float r      = spawnR * (1.0 - p);               // ease inward toward cursor
          float ang    = aSeed.y * 6.2831 + p * (1.4 + aSeed.x * 2.2); // gentle swirl
          vec3 offset  = vec3(cos(ang) * r, (aSeed.z - 0.5) * 1.5 * (1.0 - p), sin(ang) * r);
          vec4 mv = modelViewMatrix * vec4(uCursor + offset, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          gl_PointSize = aSize * uPixelRatio * (90.0 / max(dist, 1.0));
          vColor = aColor;
          vAlpha = sin(p * 3.14159);                       // fade in, brighten, fade on arrival
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uOpacity;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor * (0.6 + vAlpha * 0.8), tex.a * vAlpha * uOpacity);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false // real positions track the cursor, not the origin
    return pts
  }, [count])

  useEffect(() => () => { points.geometry.dispose(); points.material.dispose() }, [points])

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

  useFrame((_, delta) => {
    if (reducedMotion) return
    const mat = points.material
    mat.uniforms.uTime.value += Math.min(delta, 0.05)
    raycaster.setFromCamera(mouse.current, camera)
    if (raycaster.ray.intersectPlane(plane, scratch)) {
      cursorWorld.current.lerp(scratch, 0.08)
    }
    mat.uniforms.uCursor.value.copy(cursorWorld.current)
  })

  if (reducedMotion) return null

  return <primitive object={points} />
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
