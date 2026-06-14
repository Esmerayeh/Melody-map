import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Billboard, Html, MeshDistortMaterial, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import useGalaxyInteractionStore from './useGalaxyInteractionStore'
import { getNebulaColors } from './galaxyExplainer'
import { stableHash } from './galaxyScoring'
import { slugifyInteraction } from './interactionModel.js'
import { MOTION_FLOAT, MOTION_TOKENS } from '../motion/motionTokens'
import GalaxySceneBoundary from './GalaxySceneBoundary'
import GalaxyAudioController from './GalaxyAudioController'
import { applyTierLayout } from './galaxyTierLayout'

const NODE_TYPES_WITH_LABELS = new Set(['genre', 'artist', 'track'])
const EMPTY_LABEL_LAYOUT = new Map() // stable ref for the no-labels (off-route) state
// Disables raycasting on a mesh (decorative layers) so only the hit sphere is
// clickable — makes click-to-focus reliable regardless of overlapping glow.
const NO_RAYCAST = () => null
const GalaxyPostEffects   = lazy(() => import('./GalaxyPostEffects'))
const GalaxyLivingLayer   = lazy(() => import('./GalaxyLivingLayer'))
const TraversalController = lazy(() => import('./TraversalController'))

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// ── Hover feel tuning ───────────────────────────────────────────────────────
// Hover-IN is a light underdamped spring (snappy ~100-120ms rise, subtle ~18%
// overshoot → scale peaks ~1.36x then settles to 1.30x). Hover-OUT is a gentle
// monotonic exponential settle (~280ms, no undershoot). Asymmetric on purpose:
// reactive in, soft out reads organic; symmetric reads robotic. The glow lags
// the scale by ~40ms so light blooms a hair after the star grows.
const HOVER_SPRING_K   = 520   // spring stiffness (rad²/s²) → overshoot + rise time
const HOVER_SPRING_C   = 22    // spring damping → ζ≈0.48, ~18% overshoot
const HOVER_OUT_LAMBDA = 11    // exponential decay on hover-out → ~280ms to ~95%
const GLOW_LAG_LAMBDA  = 80    // glow follows scale activation with ~40ms lag

// ── Click-to-focus camera tuning ────────────────────────────────────────────
// A gentle dolly/look-at EASE toward the selected star (not a free orbit). Once
// the ease completes, OrbitControls takes over again (orbiting the new target).
const FOCUS_OFFSET     = new THREE.Vector3(10, 5.5, 12.5) // camera offset from the focused point
const RESTING_POS      = new THREE.Vector3(0, 0, 26)      // home framing (matches default camera)
const RESTING_TARGET   = new THREE.Vector3(0, 0, 0)
const FOCUS_DURATION   = 0.8                              // seconds for the focus ease
const easeOutCubic     = (x) => 1 - Math.pow(1 - x, 3)

// ─────────────────────────────────────────────────────────────────────────────
// Reference "Infinite Listening Atlas" galaxy technique, ported to R3F.
// Procedural textures + star palette + nebula colour-blend, scaled to this
// scene's world (camera at z≈26, content within ±18). Module-level singletons
// for the textures/palette (created once, app-lifetime — not per render/frame).
// ─────────────────────────────────────────────────────────────────────────────
function makeSoftDisc(size = 128, falloff = 2.2) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - size / 2) / (size / 2), dy = (y - size / 2) / (size / 2)
    let a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)); a = Math.pow(a, falloff)
    const i = (y * size + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.floor(a * 255)
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function makeNebulaPuff(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size)
  const h = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s) }
  const noise2 = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
    const a = h(ix, iy), b = h(ix + 1, iy), cc = h(ix, iy + 1), d = h(ix + 1, iy + 1)
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + cc * (1 - u) * v + d * u * v
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size - 0.5, v = y / size - 0.5, r = Math.sqrt(u * u + v * v) * 2
    let n = 0, amp = 0.5, freq = 3
    for (let k = 0; k < 5; k++) { n += amp * noise2(u * freq + 13, v * freq + 7); amp *= 0.55; freq *= 2.1 }
    let a = Math.pow(Math.max(0, 1 - r), 1.8) * (0.4 + n * 1.1); a = Math.min(1, Math.max(0, a))
    const i = (y * size + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.floor(a * 255)
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
let _TEX_DISC = null, _TEX_PUFF = null
const getDiscTex = () => (_TEX_DISC ||= makeSoftDisc())
const getPuffTex = () => (_TEX_PUFF ||= makeNebulaPuff())

const STAR_PALETTE = [0xc7d6ff, 0xffffff, 0xffe9c0, 0xffc090, 0xff9a78].map((hx) => new THREE.Color(hx))
function defaultStarColor() {
  const roll = Math.random()
  if (roll < 0.18) return STAR_PALETTE[0]
  if (roll < 0.55) return STAR_PALETTE[1]
  if (roll < 0.78) return STAR_PALETTE[2]
  if (roll < 0.93) return STAR_PALETTE[3]
  return STAR_PALETTE[4]
}
// Biome nebulae — reference hues, positions/radii scaled (~0.6) to this world. No purple.
const NEBULAE = [
  { center: [-43, 2, -5],  rx: 39, ry: 14, rz: 29, color: 0x6fd6ff, count: 26 },
  { center: [31, -2, 11],  rx: 37, ry: 13, rz: 27, color: 0xff5f88, count: 26 },
  { center: [-18, -3, 49], rx: 33, ry: 12, rz: 26, color: 0x4affb8, count: 22 },
  { center: [23, 5, -59],  rx: 35, ry: 13, rz: 28, color: 0xb8d4ff, count: 22 },
  { center: [66, 1, -24],  rx: 23, ry: 9,  rz: 18, color: 0xffa64a, count: 16 },
  { center: [55, -1, 37],  rx: 22, ry: 9,  rz: 19, color: 0xff7aa0, count: 16 },
  { center: [-65, -1, 30], rx: 25, ry: 9,  rz: 18, color: 0xffd58a, count: 16 },
  { center: [-35, 2, -67], rx: 28, ry: 9,  rz: 20, color: 0x68ffd0, count: 16 },
]
const NEBULA_COLORS = NEBULAE.map((n) => new THREE.Color(n.color))
const _tmpColor = new THREE.Color()
function colorForPos(x, y, z) {
  let best = -1, bestW = 0
  for (let i = 0; i < NEBULAE.length; i++) {
    const n = NEBULAE[i]
    const dx = (x - n.center[0]) / n.rx, dy = (y - n.center[1]) / n.ry, dz = (z - n.center[2]) / n.rz
    const w = Math.max(0, 1 - (dx * dx + dy * dy + dz * dz))
    if (w > bestW) { bestW = w; best = i }
  }
  const base = defaultStarColor()
  if (best < 0) return _tmpColor.copy(base)
  return _tmpColor.copy(base).lerp(NEBULA_COLORS[best], Math.min(0.7, bestW * 0.9))
}

const GALAXY_RADIUS = 95, DISK_THICKNESS = 9, ARMS = 4, ARM_PITCH = 0.045

function buildGalaxyDiskGeometry(count) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
  const sz = new Float32Array(count), ph = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let r, theta, y; const roll = Math.random()
    if (roll < 0.70) {
      const arm = Math.floor(Math.random() * ARMS)
      r = Math.pow(Math.random(), 0.62) * GALAXY_RADIUS
      theta = (arm / ARMS) * Math.PI * 2 + r * ARM_PITCH + (Math.random() - 0.5) * 0.55
      const tk = DISK_THICKNESS * Math.max(0.25, 1 - r / GALAXY_RADIUS * 0.6)
      y = (Math.random() - 0.5) * tk * 2
    } else if (roll < 0.93) {
      r = Math.pow(Math.random(), 1.3) * GALAXY_RADIUS * 1.15
      theta = Math.random() * Math.PI * 2; y = (Math.random() - 0.5) * GALAXY_RADIUS * 0.5
    } else {
      r = Math.pow(Math.random(), 0.7) * 13; theta = Math.random() * Math.PI * 2; y = (Math.random() - 0.5) * 5
    }
    const x = Math.cos(theta) * r + (Math.random() - 0.5) * 2.5
    const z = Math.sin(theta) * r + (Math.random() - 0.5) * 2.5
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
    const c = colorForPos(x, y, z); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    sz[i] = roll >= 0.93 ? (2.0 + Math.random() * 1.8) : (0.55 + Math.random() * 1.3)  // core boost
    ph[i] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
  return g
}
function buildDeepFieldGeometry(count) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
  const sz = new Float32Array(count), ph = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random()
    const theta = u * Math.PI * 2, phi = Math.acos(2 * v - 1), r = 260 + Math.random() * 90
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r
    pos[i * 3 + 1] = Math.cos(phi) * r
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r
    const c = defaultStarColor(); const dim = 0.55 + Math.random() * 0.45
    col[i * 3] = c.r * dim; col[i * 3 + 1] = c.g * dim; col[i * 3 + 2] = c.b * dim
    sz[i] = 0.5 + Math.random() * 1.0; ph[i] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
  return g
}
function makeStarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      uMap: { value: getDiscTex() },
    },
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      varying vec3 vColor; varying float vTwinkle;
      uniform float uTime; uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = aSize * uPixelRatio * (180.0 / max(dist, 1.0));
        vTwinkle = 0.65 + 0.35 * sin(uTime * 0.9 + aPhase * 6.28);
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vTwinkle; uniform sampler2D uMap;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        if (tex.a < 0.01) discard;
        vec2 d = gl_PointCoord - 0.5;
        float core = smoothstep(0.18, 0.0, length(d));
        gl_FragColor = vec4(vColor * (1.0 + core * 0.8) * vTwinkle, tex.a);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
}

// Procedural galaxy starfield (replaces the old flat parallax layers).
function ParallaxStarfield({ density, sparseMode, lowPower = false, reducedMotion = false }) {
  const { diskPoints, deepPoints } = useMemo(() => {
    const scale = sparseMode ? 0.4 : lowPower ? 0.6 : 1
    const diskPoints = new THREE.Points(buildGalaxyDiskGeometry(Math.floor(14000 * scale)), makeStarMaterial())
    const deepPoints = new THREE.Points(buildDeepFieldGeometry(Math.floor(6000 * scale)), makeStarMaterial())
    diskPoints.rotation.x = 0.18; deepPoints.rotation.x = 0.18
    return { diskPoints, deepPoints }
  }, [sparseMode, lowPower])

  useEffect(() => () => {
    [diskPoints, deepPoints].forEach((p) => { p.geometry.dispose(); p.material.dispose() })
  }, [diskPoints, deepPoints])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    diskPoints.material.uniforms.uTime.value += dt
    deepPoints.material.uniforms.uTime.value += dt
    // Gentle ambient rotation of the galaxy disk; deep field stays static.
    if (!reducedMotion) diskPoints.rotation.y += 0.00025
  })

  return (
    <>
      <primitive object={deepPoints} />
      <primitive object={diskPoints} />
    </>
  )
}

// Gradient sky shell (BackSide) — warm deep-space backdrop behind everything.
function GalaxySky() {
  const mesh = useMemo(() => {
    const geo = new THREE.SphereGeometry(500, 32, 32)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x070512) },
        uMidColor: { value: new THREE.Color(0x130a1e) },
        uBotColor: { value: new THREE.Color(0x1e0a18) },
      },
      vertexShader: `varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vWorld; uniform vec3 uTopColor; uniform vec3 uMidColor; uniform vec3 uBotColor;
        void main() {
          float t = normalize(vWorld).y * 0.5 + 0.5;
          vec3 c = mix(uBotColor, uMidColor, smoothstep(0.0, 0.5, t));
          c = mix(c, uTopColor, smoothstep(0.5, 1.0, t));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    return new THREE.Mesh(geo, mat)
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose() }, [mesh])
  return <primitive object={mesh} />
}

// Soft additive nebula puffs, chromatically varied per biome, drifting slowly.
function GalaxyNebulae({ sparseGraphics = false, reducedMotion = false }) {
  const groups = useMemo(() => {
    const puff = getPuffTex()
    const scale = sparseGraphics ? 0.45 : 1
    return NEBULAE.map((n) => {
      const group = new THREE.Group()
      const baseColor = new THREE.Color(n.color)
      const count = Math.max(6, Math.floor(n.count * scale))
      for (let i = 0; i < count; i++) {
        const u = Math.random(), v = Math.random(), rr = Math.pow(Math.random(), 0.6)
        const phi = Math.acos(2 * v - 1), theta = u * Math.PI * 2
        const px = n.center[0] + Math.sin(phi) * Math.cos(theta) * rr * n.rx + (Math.random() - 0.5) * 4
        const py = n.center[1] + Math.sin(phi) * Math.sin(theta) * rr * n.ry * 0.6 + (Math.random() - 0.5) * 3
        const pz = n.center[2] + Math.cos(phi) * rr * n.rz + (Math.random() - 0.5) * 4
        const mat = new THREE.SpriteMaterial({
          map: puff,
          color: baseColor.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.25),
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
          opacity: 0.14 + Math.random() * 0.2, rotation: Math.random() * Math.PI * 2,
        })
        const sp = new THREE.Sprite(mat)
        const s = 14 + Math.random() * 30
        sp.scale.set(s, s * (0.7 + Math.random() * 0.5), 1)
        sp.position.set(px, py, pz)
        group.add(sp)
      }
      group.rotation.x = 0.18
      group.userData.driftYaw = (Math.random() - 0.5) * 0.0004
      return group
    })
  }, [sparseGraphics])

  useEffect(() => () => {
    groups.forEach((g) => g.children.forEach((sp) => sp.material.dispose()))
  }, [groups])

  useFrame(() => {
    if (reducedMotion) return
    groups.forEach((g) => { g.rotation.y += g.userData.driftYaw })
  })

  return <>{groups.map((g, i) => <primitive key={i} object={g} />)}</>
}

function CameraTracker({ onDistance, onPosition, distanceRef }) {
  const last = useRef({ t: 0, d: 0, p: new THREE.Vector3() })
  useFrame(({ camera, clock }) => {
    const d = camera.position.length()
    // Always keep the ref hot for frame-loop consumers (no React re-render).
    if (distanceRef) distanceRef.current = d
    // Throttle the React state update that drives label visibility to <=4/sec
    // and only on a meaningful change, so the scene graph does NOT re-render
    // every frame (previously ~60 re-renders/sec of the whole SceneContents).
    // Label LOD also keys off camera POSITION (per-node distance gating), so
    // fire when the camera has translated enough even if its distance from
    // centre is unchanged (e.g. flying across the cloud at a fixed radius).
    const now = clock.getElapsedTime()
    const moved = camera.position.distanceTo(last.current.p)
    if (now - last.current.t > 0.25 && (Math.abs(d - last.current.d) > 0.4 || moved > 1.2)) {
      last.current = { t: now, d, p: camera.position.clone() }
      onDistance(d)
      if (onPosition) onPosition({ x: camera.position.x, y: camera.position.y, z: camera.position.z })
    }
  })
  return null
}

// Gentle, cinematic focus move: dolly + look-at EASE toward the selected star
// (~800ms ease-out), then hand control back to OrbitControls. Clearing the focus
// eases back to the resting framing. This is a focus move, NOT a free orbit.
function FocusController({ focusTarget, controlsRef, reducedMotion = false, restAutoRotate = true, enabled = true }) {
  const { camera } = useThree()
  const tween = useRef(null)

  useEffect(() => {
    const controls = controlsRef.current
    // When traversal is active (/universe), TraversalController owns the camera —
    // don't fight it. The focus ease only runs on the standard galaxy stage.
    if (!controls || !enabled) { tween.current = null; return }
    const toTarget = focusTarget
      ? new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z)
      : RESTING_TARGET.clone()
    const toPos = focusTarget ? toTarget.clone().add(FOCUS_OFFSET) : RESTING_POS.clone()

    if (reducedMotion) {
      // Respect prefers-reduced-motion: no camera travel. Selection is conveyed
      // by the node highlight, ring and Auralith panel instead. Leave the camera
      // where the user left it.
      tween.current = null
      return
    }
    // Pause autoRotate during the ease so it doesn't fight the dolly.
    controls.autoRotate = false
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos,
      toTarget,
      t: 0,
    }
  }, [camera, controlsRef, focusTarget, reducedMotion, enabled])

  useFrame((_, delta) => {
    const tw = tween.current
    const controls = controlsRef.current
    if (!tw || !controls) return
    tw.t = Math.min(1, tw.t + Math.min(delta, 0.05) / FOCUS_DURATION)
    const e = easeOutCubic(tw.t)
    camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
    controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
    controls.update()
    if (tw.t >= 1) {
      tween.current = null
      controls.autoRotate = restAutoRotate // resume gentle orbit around the new framing
    }
  })

  return null
}

// Single soft, warm selection ring that fades in around the focused star and
// follows it. One mesh + one useFrame for the whole scene (not per node), eased
// in/out so it persists until deselected. Warm amber — zero purple.
function SelectionRing({ model, reducedMotion = false }) {
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const groupRef = useRef()
  const matRef = useRef()
  const fade = useRef(0)

  const target = useMemo(() => {
    if (!focusedObject) return null
    const nodes = model?.nodes || []
    if (focusedObject.type === 'core') {
      const core = model?.metadata?.core
      return core?.position ? { pos: core.position, size: 1.2 } : null
    }
    const node = focusedObject.type === 'cluster'
      ? nodes.find((n) => n.clusterId === focusedObject.id)
      : nodes.find((n) => n.id === focusedObject.id)
    if (!node?.position) return null
    const size = clamp(node.size || 0.5, node.type === 'track' ? 0.13 : 0.24, node.type === 'cluster' ? 1.45 : node.type === 'genre' ? 1.34 : 0.92)
    return { pos: node.position, size }
  }, [focusedObject, model])

  useFrame((state, delta) => {
    const g = groupRef.current
    const m = matRef.current
    if (!g || !m) return
    const dt = Math.min(delta, 0.05)
    fade.current = THREE.MathUtils.damp(fade.current, target ? 1 : 0, 6, dt) // ~500ms fade
    m.opacity = fade.current * 0.5
    g.visible = fade.current > 0.01
    if (target) {
      g.position.set(target.pos.x, target.pos.y, target.pos.z)
      const pulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.getElapsedTime() * 1.6) * 0.04
      g.scale.setScalar(target.size * pulse)
    }
  })

  return (
    <Billboard ref={groupRef} visible={false}>
      <mesh>
        {/* Unit ring; the group scales it to the focused node's size. */}
        <ringGeometry args={[2.0, 2.45, 56]} />
        <meshBasicMaterial ref={matRef} color="#ffce8a" transparent opacity={0} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </Billboard>
  )
}

function getNodeVisibility(node, galaxyMode, viewMode, showTracks, sparseMode) {
  if (sparseMode) {
    if (node.type === 'track') return { visible: false, opacity: 0 }
    if (node.type === 'cluster' && (node.metrics?.significance || 0) < 0.65) return { visible: false, opacity: 0 }
    if (node.type === 'artist' && (node.metrics?.significance || 0) < 0.55) return { visible: true, opacity: 0.42 }
  }
  if (galaxyMode === 'genre') {
    if (node.type === 'track') return { visible: false, opacity: 0 }
    if (node.type === 'genre') return { visible: true, opacity: 0.94 }
    if (node.type === 'cluster') return { visible: true, opacity: 0.82 }
    if (node.type === 'artist') return { visible: true, opacity: node.metrics?.anchorScore > 0.52 ? 0.92 : 0.56 }
  }

  if (galaxyMode === 'artist') {
    if (node.type !== 'artist') return { visible: false, opacity: 0 }
    return { visible: true, opacity: node.metrics?.significance > 0.58 ? 0.96 : 0.54 }
  }

  if (galaxyMode === 'song') {
    if (node.type !== 'track') return { visible: false, opacity: 0 }
    return { visible: showTracks, opacity: node.metrics?.significance > 0.56 ? 0.92 : 0.48 }
  }

  if (node.type === 'track' && !showTracks) return { visible: false, opacity: 0 }

  if (viewMode === 'identity') {
    if (node.type === 'track') return { visible: false, opacity: 0 }
    if (node.type === 'genre') return { visible: true, opacity: 0.68 }
    if (node.type === 'cluster') return { visible: true, opacity: 0.82 }
    return { visible: true, opacity: node.metrics?.anchorScore > 0.6 ? 0.98 : 0.62 }
  }

  if (viewMode === 'discovery') {
    if (node.type === 'genre') return { visible: true, opacity: 0.2 }
    if ((node.metrics?.discoveryScore || 0) > 0.42 || node.type === 'track') return { visible: true, opacity: 0.94 }
    return { visible: true, opacity: 0.2 }
  }

  if (viewMode === 'mood') {
    if (node.type === 'track') return { visible: showTracks, opacity: 0.45 }
    return { visible: true, opacity: node.type === 'cluster' ? 0.88 : 0.72 }
  }

  if (viewMode === 'genre') {
    if (node.type === 'genre' || node.type === 'cluster') return { visible: true, opacity: 0.94 }
    return { visible: true, opacity: node.type === 'track' ? 0.35 : 0.5 }
  }

  return { visible: true, opacity: node.type === 'track' ? 0.5 : 0.95 }
}

// Label visibility by tier. camDist is the distance from the camera to THIS
// node, so reveals are driven by how close you fly to a star — not by a global
// zoom level. Three fixed behaviours:
//   genre  — always visible (region anchors; you must always know where you are)
//   artist — hidden until hovered/selected OR the camera comes within reveal
//            range; only a few qualify at once
//   song   — never labelled; songs are texture/dust only
const ARTIST_REVEAL_DIST = 10  // an artist names itself only this near the camera

function shouldShowNodeLabel(node, revealed, camDist) {
  if (node.type === 'track') return false   // songs are dust — never a text label
  if (revealed) return true                 // hover/selection always names it
  if (node.type === 'genre') return true    // region anchors — always visible
  if (node.type === 'artist') return camDist < ARTIST_REVEAL_DIST
  return false
}

// Label opacity ramps with camera proximity so text feels emitted by the haze:
// brighter as you approach, dimmer far away. Genres never fully vanish (they
// are anchors); artists ramp from 0 at the reveal edge so their unmount past
// the edge is invisible (already transparent) — a soft fade, never a pop.
function genreLabelOpacity(camDist) {
  if (!Number.isFinite(camDist)) return 0.46
  const t = clamp((40 - camDist) / 30, 0, 1)   // far → 0, near → 1 over 10..40u
  return 0.46 + t * 0.42                        // 0.46 (far) .. 0.88 (near)
}
function artistLabelOpacity(camDist, revealed) {
  if (revealed) return 0.92
  if (!Number.isFinite(camDist)) return 0
  const t = clamp((ARTIST_REVEAL_DIST - camDist) / ARTIST_REVEAL_DIST, 0, 1)
  return t * 0.9
}

function labelPriority(node) {
  if (node.type === 'genre') return 5 + (node.metrics?.significance || 0)
  if (node.role === 'anchor-star') return 4 + (node.metrics?.anchorScore || 0)
  if (node.type === 'artist') return 3 + (node.metrics?.significance || 0)
  if (node.type === 'track') return 2 + (node.metrics?.significance || 0)
  return 1
}

function nodeCamDistance(node, cameraPos) {
  // No camera fix yet → treat as infinitely far so proximity-gated artist
  // labels stay hidden (and genres fall back to their dim base opacity).
  if (!cameraPos) return Infinity
  const p = node.position || { x: 0, y: 0, z: 0 }
  const dx = p.x - cameraPos.x
  const dy = p.y - cameraPos.y
  const dz = p.z - cameraPos.z
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
}

function buildVisibleLabelLayout(nodes, galaxyMode, viewMode, showTracks, focusedObject, hoveredObject, sparseMode, cameraPos) {
  const candidates = nodes
    .filter((node) => NODE_TYPES_WITH_LABELS.has(node.type))
    .filter((node) => getNodeVisibility(node, galaxyMode, viewMode, showTracks, sparseMode).visible)
    .map((node) => {
      const objectType = node.type === 'cluster' ? 'cluster' : node.type
      const objectId = node.type === 'cluster' ? node.clusterId : node.id
      const revealed = (focusedObject?.id === objectId && focusedObject?.type === objectType)
        || (hoveredObject?.id === objectId && hoveredObject?.type === objectType)
      return { node, camDist: nodeCamDistance(node, cameraPos), revealed }
    })
    .filter(({ node, camDist, revealed }) => shouldShowNodeLabel(node, revealed, camDist))
    // Nearer artists win collisions (distance penalty), so the star you fly
    // toward keeps its name while the ones behind it yield.
    .sort((left, right) =>
      (labelPriority(right.node) - right.camDist * 0.1) -
      (labelPriority(left.node) - left.camDist * 0.1))

  // Genres are always placed (region anchors, collision-exempt). Only artists
  // compete for space: a tight collision radius + a small budget keep at most a
  // few names visible near the camera at once. Songs never reach here.
  const threshold = 2.8
  const maxArtistLabels = sparseMode ? 4 : 7
  let artistCount = 0
  const accepted = []
  const layout = new Map()

  const place = (node, camDist, revealed) => {
    accepted.push(node)
    const hash = stableHash(node.id || node.label || 'label')
    const opacity = node.type === 'genre'
      ? genreLabelOpacity(camDist)
      : artistLabelOpacity(camDist, revealed)
    layout.set(node.id, {
      y: (node.type === 'genre' ? 0.7 : 0.5) + ((hash % 3) - 1) * 0.1,
      x: (((hash >> 3) % 3) - 1) * 0.14,
      opacity,
    })
  }

  candidates.forEach(({ node, camDist, revealed }) => {
    if (node.type === 'genre') { place(node, camDist, revealed); return } // anchors: always
    if (artistCount >= maxArtistLabels) return
    const position = node.position || { x: 0, y: 0, z: 0 }
    const collides = accepted.some((acceptedNode) => {
      if (acceptedNode.type === 'genre') return false // names float free of region anchors
      const other = acceptedNode.position || { x: 0, y: 0, z: 0 }
      const dx = position.x - other.x
      const dy = position.y - other.y
      const dz = position.z - other.z
      return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) < threshold
    })
    if (collides) return
    place(node, camDist, revealed)
    artistCount += 1
  })

  return layout
}

function GalaxyNode({ node, cameraDistance, galaxyMode, viewMode, showTracks, showLabel, labelOffset, sparseMode, registerRef }) {
  const groupRef = useRef()
  const meshRef = useRef()
  const haloRef = useRef()
  const matRef = useRef()
  const haloMatRef = useRef()
  const nodeRef = useRef(node)
  const position = node.position || { x: 0, y: 0, z: 0 }
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const setHoveredObject = useGalaxyInteractionStore((state) => state.setHoveredObject)
  const setFocusedObject = useGalaxyInteractionStore((state) => state.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)
  const setFocusTarget = useGalaxyInteractionStore((state) => state.setFocusTarget)
  const setConstellationOrigin = useGalaxyInteractionStore((state) => state.setConstellationOrigin)
  const constellationMode = useGalaxyInteractionStore((state) => state.constellationMode)

  const isClusterNode = node.type === 'cluster'
  const objectType = isClusterNode ? 'cluster' : node.type
  const objectId = isClusterNode ? node.clusterId : node.id
  const selected = focusedObject?.id === objectId && focusedObject?.type === objectType
  const visibility = getNodeVisibility(node, galaxyMode, viewMode, showTracks, sparseMode)
  const renderedSize = clamp(node.size || 0.5, node.type === 'track' ? 0.13 : 0.24, node.type === 'cluster' ? 1.45 : node.type === 'genre' ? 1.34 : 0.92)
  // Generous invisible hit sphere so click-to-focus is reliable even for small
  // stars: artists/clusters get a wide target, genres wider, tracks a usable
  // minimum. (Was renderedSize*2.2, min 0.45/0.7 — too small to hit reliably.)
  const hitRadius = Math.max(
    renderedSize * 3.4,
    node.type === 'track' ? 0.7 : node.type === 'genre' ? 2.6 : 1.5,
  )
  const driftSeed = useMemo(() => stableHash(node.id || node.label || 'node'), [node.id, node.label])
  const basePosition = useMemo(() => new THREE.Vector3(position.x, position.y, position.z), [position.x, position.y, position.z])

  // Keep nodeRef current so the parent's single useFrame always sees latest node data.
  nodeRef.current = node

  // Register this node's refs with the parent animation loop. Runs once per mount
  // (deps are stable per-node), and cleans up on unmount.
  useEffect(() => {
    if (!registerRef) return
    return registerRef(node.id, { groupRef, meshRef, haloRef, matRef, haloMatRef, basePosition, driftSeed, nodeRef, objectId, objectType })
  }, [node.id, registerRef, basePosition, driftSeed, objectId, objectType])

  if (!visibility.visible) return null

  const handleSelect = (event) => {
    event.stopPropagation()
    if (selected) {
      clearFocusedObject()
      setFocusTarget(null)
      if (constellationMode) setConstellationOrigin(null)
      return
    }
    setFocusedObject({
      id: objectId,
      type: objectType,
      label: node.label,
      clusterId: node.clusterId || null,
      regionId: node.regionLabel ? `region:${slugifyInteraction(node.regionLabel)}` : null,
    })
    setFocusTarget(node.position || null)
    if (constellationMode && node.type === 'artist') setConstellationOrigin(node.id)
  }

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Genre regions get a big soft nebula glow so they read as places, not
          points. Size scales with the genre's weight. Additive, very soft. */}
      {node.type === 'genre' && (
        <mesh raycast={NO_RAYCAST}>
          <sphereGeometry args={[renderedSize * (4.6 + (node.significance || node.metrics?.significance || 0.4) * 3.4), 20, 20]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* Decorative meshes are NON-raycastable so they never intercept a click;
          only the generous invisible hit sphere below is the click target. */}
      <mesh ref={haloRef} raycast={NO_RAYCAST}>
        <sphereGeometry args={[renderedSize * (node.type === 'track' ? 1.4 : 1.8), 16, 16]} />
        {/* Base opacity only — hover/selection raise is eased in the parent useFrame via haloMatRef. */}
        <meshBasicMaterial ref={haloMatRef} color={node.color} transparent opacity={0.03} />
      </mesh>

      <mesh ref={meshRef} raycast={NO_RAYCAST}>
        <sphereGeometry args={[renderedSize, node.type === 'track' ? 12 : 24, node.type === 'track' ? 12 : 24]} />
        <MeshDistortMaterial
          ref={matRef}
          color={node.color}
          emissive={node.color}
          emissiveIntensity={node.type === 'cluster' ? 0.9 : 0.65}
          roughness={0.24}
          metalness={0.62}
          transparent
          opacity={clamp(visibility.opacity * (node.type === 'track' ? 0.86 : 0.92), 0.18, 0.95)}
          distort={node.type === 'genre' ? 0.11 : node.type === 'cluster' ? 0.07 : node.type === 'track' ? 0.04 : 0.13}
          speed={node.type === 'track' ? 0.62 : node.type === 'genre' ? 0.44 : 0.9}
        />
      </mesh>

      <mesh
        onClick={handleSelect}
        onPointerOver={(event) => {
          event.stopPropagation()
          if (typeof document !== 'undefined') document.body.style.cursor = 'pointer'
          setHoveredObject({
            id: objectId,
            type: objectType,
            label: node.label,
            clusterId: node.clusterId || null,
            regionId: node.regionLabel ? `region:${slugifyInteraction(node.regionLabel)}` : null,
          })
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          // Only the newest hover wins: if the pointer already moved onto another
          // star (its onPointerOver ran first), don't clear that fresher hover.
          const current = useGalaxyInteractionStore.getState().hoveredObject
          if (current && !(current.id === objectId && current.type === objectType)) return
          if (typeof document !== 'undefined') document.body.style.cursor = ''
          setHoveredObject(null)
        }}
      >
        <sphereGeometry args={[hitRadius, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {showLabel && node.type !== 'track' && (
        <Billboard position={[labelOffset?.x || 0, renderedSize + (labelOffset?.y || 0.6), 0]}>
          {/* No box, no pill — the text reads by its own weight and a soft
              text-shadow (warm glow for "emitted by the haze" + a dark halo for
              legibility over the bright bloom). Opacity is driven by camera
              proximity from the layout, and framer tweens it smoothly as you
              move, so labels brighten/dim and fade in/out without a pop. */}
          <Html distanceFactor={node.type === 'genre' ? 20 : 15} center zIndexRange={[40, 0]}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: labelOffset?.opacity ?? (node.type === 'genre' ? 0.6 : 0.85) }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="pointer-events-none select-none whitespace-nowrap"
            >
              {node.type === 'genre' ? (
                <span
                  className="font-display lowercase text-[20px] font-normal leading-none text-[#f4dcb4]"
                  style={{ textShadow: '0 0 22px rgba(244,196,120,0.30), 0 0 5px rgba(0,0,0,0.68), 0 1px 2px rgba(0,0,0,0.55)' }}
                >
                  {node.label}
                </span>
              ) : (
                <span
                  className="text-[13px] font-medium leading-tight text-[#ecd9c0]"
                  style={{ textShadow: '0 0 14px rgba(240,210,150,0.22), 0 0 4px rgba(0,0,0,0.72), 0 1px 2px rgba(0,0,0,0.55)' }}
                >
                  {node.label}
                </span>
              )}
            </motion.div>
          </Html>
        </Billboard>
      )}
    </group>
  )
}

function RegionParticles({ region, selected, hovered }) {
  const pointsRef = useRef()
  const geometry = useMemo(() => {
    const count = clamp(22 + Math.round((region.coverage || 0) * 70), 18, 72)
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      const radius = 0.65 + ((index % 7) / 7) * (2.3 + (region.coverage || 0) * 3.2)
      const x = Math.cos(angle) * radius + Math.sin(index * 0.7) * 0.32
      const y = (((index % 5) - 2) * 0.16) + Math.cos(index * 0.45) * 0.08
      const z = Math.sin(angle) * radius + Math.cos(index * 0.6) * 0.35
      positions[index * 3] = x
      positions[(index * 3) + 1] = y
      positions[(index * 3) + 2] = z
    }
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return nextGeometry
  }, [region.coverage])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const t = clock.getElapsedTime()
    pointsRef.current.rotation.y = t * (0.05 + (region.coverage || 0) * 0.08)
    pointsRef.current.rotation.z = Math.sin(t * 0.1 + region.coverage) * 0.08
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={selected ? 0.14 : hovered ? 0.11 : 0.09}
        color={region.color}
        transparent
        opacity={selected ? 0.34 : hovered ? 0.24 : 0.15}
        sizeAttenuation
      />
    </points>
  )
}

function RegionNebula({ region, model, galaxyMode, viewMode }) {
  const groupRef = useRef()
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const setHoveredObject = useGalaxyInteractionStore((state) => state.setHoveredObject)
  const setFocusedObject = useGalaxyInteractionStore((state) => state.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)
  const setFocusTarget = useGalaxyInteractionStore((state) => state.setFocusTarget)
  const motionState = useGalaxyInteractionStore((state) => state.motionState)
  const selected = focusedObject?.type === 'region' && focusedObject?.id === region.id
  const hovered = hoveredObject?.type === 'region' && hoveredObject?.id === region.id
  const topArtists = (region.anchorArtistIds || [])
    .map((artistId) => model?.nodes?.find((node) => node.id === artistId))
    .filter(Boolean)
    .slice(0, 3)
  const profileTier = model?.metadata?.profileTier || 'partial'
  const tierScale = profileTier === 'rich' ? 1 : profileTier === 'medium' ? 0.85 : 0.7
  const baseScale = clamp((4.4 + (region.coverage || 0) * 8.5) * tierScale, 3.6, 8.2)
  const visible = galaxyMode === 'universal' || galaxyMode === 'genre'
  const centroid = region?.centroid || { x: 0, y: 0, z: 0 }
  const centroidValid = Number.isFinite(centroid.x) && Number.isFinite(centroid.y) && Number.isFinite(centroid.z)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    if (!centroidValid) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.z = t * 0.02 + region.coverage * 0.08
    groupRef.current.rotation.x = Math.sin(t * 0.07 + region.coverage * 8) * 0.05
    groupRef.current.position.set(
      centroid.x + Math.sin(t * 0.03 + region.coverage * 10) * (motionState?.driftStrength || 0.18) * 0.35,
      centroid.y + Math.cos(t * 0.028 + region.coverage * 13) * (motionState?.driftStrength || 0.18) * 0.22,
      centroid.z - 1.2,
    )
  })

  if (!centroidValid) return null
  if (!visible && !hovered && !selected && viewMode !== 'mood') return null

  return (
    <group ref={groupRef} position={[centroid.x, centroid.y, centroid.z - 1.2]}>
      <RegionParticles region={region} selected={selected} hovered={hovered} />
      {[1, 0.74, 0.48].map((factor, index) => (
        <mesh key={`${region.id}-${factor}`} scale={[baseScale * factor, baseScale * factor * (0.66 + index * 0.08), baseScale * factor]}>
          <sphereGeometry args={[1, 26, 26]} />
          {/* Additive, layered → soft volumetric haze instead of a flat disc. */}
          <meshBasicMaterial
            color={region.color}
            transparent
            opacity={(selected ? 0.12 : hovered ? 0.09 : 0.06) - index * 0.012}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      <mesh
        onClick={(event) => {
          event.stopPropagation()
          if (selected) {
            clearFocusedObject()
            setFocusTarget(null)
            return
          }
          setFocusedObject({ id: region.id, type: 'region', label: region.title || region.label })
          setFocusTarget(region.centroid || null)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHoveredObject({ id: region.id, type: 'region', label: region.title || region.label })
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHoveredObject(null)
        }}
      >
        <sphereGeometry args={[baseScale * 0.68, 18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, baseScale * 0.82, 0]}>
        <Html center distanceFactor={7.5}>
          <div className="pointer-events-none min-w-[180px] text-center">
            <p className="text-[clamp(22px,2vw,38px)] font-semibold tracking-tight text-white/92 drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)]">
              {region.title || region.label}
            </p>
            {!!topArtists.length && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {topArtists.map((artist) => (
                  <span key={artist.id} className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] text-white/80 backdrop-blur">
                    {artist.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Html>
      </Billboard>
    </group>
  )
}

function TasteCore({ core, model, galaxyMode }) {
  const groupRef = useRef()
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const setHoveredObject = useGalaxyInteractionStore((state) => state.setHoveredObject)
  const setFocusedObject = useGalaxyInteractionStore((state) => state.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)
  const setFocusTarget = useGalaxyInteractionStore((state) => state.setFocusTarget)
  const motionState = useGalaxyInteractionStore((state) => state.motionState)
  const selected = focusedObject?.type === 'core'
  const hovered = hoveredObject?.type === 'core'
  const coreArtists = (core?.supportingArtists || [])
    .map((artistId) => model?.nodes?.find((node) => node.id === artistId))
    .filter(Boolean)
    .slice(0, 4)

  const corePosition = core?.position || { x: 0, y: 0, z: 0 }
  // `core` is absent on legacy/demo models (no metadata.core). Treat that as
  // "no core to render" rather than crashing on core.supportingArtists/.color.
  const coreValid = Boolean(core) && Number.isFinite(corePosition.x) && Number.isFinite(corePosition.y) && Number.isFinite(corePosition.z)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    if (!coreValid) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.12
    groupRef.current.rotation.z = Math.sin(t * 0.08) * 0.06
    groupRef.current.position.set(
      corePosition.x + Math.sin(t * 0.04) * (motionState?.driftStrength || 0.18) * 0.18,
      corePosition.y + Math.cos(t * 0.05) * (motionState?.driftStrength || 0.18) * 0.12,
      corePosition.z,
    )
    groupRef.current.scale.setScalar(
      1
      + Math.sin(t * (galaxyMode === 'song' ? 1.45 : 1.1)) * 0.04
      + (selected ? 0.12 : hovered ? 0.05 : 0),
    )
  })

  if (!coreValid) return null

  return (
    <group ref={groupRef} position={[corePosition.x, corePosition.y, corePosition.z]}>
      {/* Additive halo shells incl. a near-white inner glow (#fff1d6). Reduced
          ~40% (0.12/0.18/0.24 → 0.07/0.11/0.14) so the core stops hazing white
          over panels on content routes. */}
      {[1.7, 1.28, 0.94].map((factor, index) => (
        <mesh key={`${factor}`}>
          <sphereGeometry args={[factor, 28, 28]} />
          {/* Middle halo shell warmed off the purple data fallback (#8b5cf6)
              to gold #ffd89b — sits between the amber outer (#f0c089) and the
              near-white inner (#fff1d6) for a peach-gold gradient, no purple. */}
          <meshBasicMaterial color={index === 0 ? '#f0c089' : index === 1 ? '#ffd89b' : '#fff1d6'} transparent opacity={index === 0 ? 0.07 : index === 1 ? 0.11 : 0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {/* core mesh emissive base/hover/select dropped ~35%: 0.9/1.2/1.5 -> 0.58/0.78/0.98 */}
      <mesh>
        <sphereGeometry args={[0.85, 28, 28]} />
        {/* Core sphere forced to the app's warm valence tone (#ffba95, the same
            peach the Soul Orb uses) instead of the purple data fallback
            (#8b5cf6). Colour/emissive only — size, glow, intensity unchanged. */}
        <MeshDistortMaterial
          color="#ffba95"
          emissive="#ffba95"
          emissiveIntensity={selected ? 0.98 : hovered ? 0.78 : 0.58}
          roughness={0.14}
          metalness={0.58}
          transparent
          opacity={0.94}
          distort={0.18}
          speed={0.8}
        />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          if (selected) {
            clearFocusedObject()
            setFocusTarget(null)
            return
          }
          setFocusedObject({ id: 'taste-core', type: 'core', label: core.label })
          setFocusTarget(core.position)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHoveredObject({ id: 'taste-core', type: 'core', label: core.label })
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHoveredObject(null)
        }}
      >
        <sphereGeometry args={[2.6, 18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, 2.6, 0]}>
        <Html center distanceFactor={7.5}>
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={MOTION_TOKENS.label}
            className="pointer-events-none text-center"
          >
            <p className="text-sm uppercase tracking-[0.35em] text-[#EAE6FF]/78">Taste Core</p>
            {!!coreArtists.length && (
              <p className="mt-1 text-[11px] text-[#D6D0F0]/72">{coreArtists.map((artist) => artist.label).join(' / ')}</p>
            )}
          </motion.div>
        </Html>
      </Billboard>
    </group>
  )
}

/**
 * GalaxyEdgesBatch
 * ----------------
 * Renders ALL edges as a SINGLE LineSegments draw call (one BufferGeometry,
 * one material).  This replaces the previous per-edge approach that created
 * a new THREE.BufferGeometry object on every React render, leaking GPU memory.
 *
 * Highlighted edges (hovered / focused) are rendered on top as a separate,
 * smaller LineSegments so they can have a different colour and opacity without
 * changing the main geometry.
 *
 * Edge midpoint hit-meshes and tooltips are kept but rendered only for a
 * filtered subset (bridge_lane + audio_similarity) to avoid hundreds of
 * invisible hit targets.
 */
function GalaxyEdgesBatch({ model, galaxyMode, viewMode }) {
  const hoveredObject      = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject      = useGalaxyInteractionStore((state) => state.focusedObject)
  const setHoveredObject   = useGalaxyInteractionStore((state) => state.setHoveredObject)
  const setFocusedObject   = useGalaxyInteractionStore((state) => state.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)

  const nodeMap = useMemo(
    () => Object.fromEntries((model?.nodes || []).map((n) => [n.id, n])),
    [model],
  )

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set()
    if (focusedObject?.id)       ids.add(focusedObject.id)
    if (focusedObject?.clusterId) ids.add(focusedObject.clusterId)
    if (hoveredObject?.id)       ids.add(hoveredObject.id)
    if (hoveredObject?.clusterId) ids.add(hoveredObject.clusterId)
    return ids
  }, [focusedObject, hoveredObject])

  const visibleEdges = useMemo(() => {
    const all = model?.edges || []
    const hi  = (e) => highlightedNodeIds.has(e.source) || highlightedNodeIds.has(e.target)
    if (viewMode === 'constellation') return all.filter((e) => e.type === 'bridge_lane' || e.type === 'audio_similarity' || hi(e)).slice(0, 90)
    if (galaxyMode === 'song')        return all.filter((e) => e.type.startsWith('song_') && hi(e)).slice(0, 36)
    if (galaxyMode === 'artist')      return all.filter((e) => (e.type === 'bridge_lane' || e.type === 'audio_similarity' || e.type === 'shared_genre') && (hi(e) || (e.weight || 0) > 0.74)).slice(0, 54)
    if (galaxyMode === 'genre')       return all.filter((e) => (e.type === 'genre_affinity' || e.type === 'bridge_lane') && (hi(e) || (e.weight || 0) > 0.78)).slice(0, 48)
    if (viewMode === 'discovery')     return all.filter((e) => e.type === 'bridge_lane' && (hi(e) || (e.weight || 0) > 0.8)).slice(0, 42)
    if (viewMode === 'genre')         return all.filter((e) => (e.type === 'genre_affinity' || e.type === 'cluster_membership') && (hi(e) || (e.weight || 0) > 0.8)).slice(0, 42)
    return all.filter((e) => e.type === 'bridge_lane' && (hi(e) || (e.weight || 0) > 0.84)).slice(0, 34)
  }, [galaxyMode, highlightedNodeIds, model, viewMode])

  // ── Build main batch geometry ──────────────────────────────────────────────
  // Every edge becomes 2 consecutive vertices in a flat positions array.
  // LineSegments interprets them as pairs, so no index buffer is needed.
  // highlightGeometry is built here too — use it in JSX, do NOT re-create it.
  const { batchGeometry, highlightGeometry, normalEdges, highlightedEdges } = useMemo(() => {
    const normalEdges     = []
    const highlightedEdges = []
    const normalPositions  = []
    const highlightPositions = []

    visibleEdges.forEach((edge) => {
      const src = nodeMap[edge.source]
      const tgt = nodeMap[edge.target]
      if (!src || !tgt) return

      const isHighlighted = (
        (hoveredObject?.type === 'edge' && hoveredObject?.id === edge.id) ||
        (focusedObject?.type === 'edge' && focusedObject?.id === edge.id) ||
        highlightedNodeIds.has(edge.source) ||
        highlightedNodeIds.has(edge.target)
      )

      const bucket = isHighlighted ? highlightPositions : normalPositions
      bucket.push(src.position.x, src.position.y, src.position.z)
      bucket.push(tgt.position.x, tgt.position.y, tgt.position.z)

      if (isHighlighted) highlightedEdges.push(edge)
      else               normalEdges.push(edge)
    })

    const batchGeo = new THREE.BufferGeometry()
    if (normalPositions.length) {
      batchGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(normalPositions), 3))
    }

    const hlGeo = new THREE.BufferGeometry()
    if (highlightPositions.length) {
      hlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(highlightPositions), 3))
    }

    return { batchGeometry: batchGeo, highlightGeometry: hlGeo, normalEdges, highlightedEdges }
  }, [visibleEdges, nodeMap, hoveredObject, focusedObject, highlightedNodeIds])

  // ── Bridge-lane midpoint motes (limited to meaningful edges only) ──────────
  const bridgeMotes = useMemo(() => (
    visibleEdges.filter((e) => e.type === 'bridge_lane' || e.type === 'audio_similarity').slice(0, 24).map((edge) => {
      const src = nodeMap[edge.source]
      const tgt = nodeMap[edge.target]
      if (!src || !tgt) return null
      const hovered = hoveredObject?.type === 'edge' && hoveredObject?.id === edge.id
      const focused  = focusedObject?.type  === 'edge' && focusedObject?.id  === edge.id
      return {
        key:      edge.id,
        edge,
        midpoint: {
          x: (src.position.x + tgt.position.x) / 2,
          y: (src.position.y + tgt.position.y) / 2,
          z: (src.position.z + tgt.position.z) / 2,
        },
        hovered,
        focused,
      }
    }).filter(Boolean)
  ), [visibleEdges, nodeMap, hoveredObject, focusedObject])

  return (
    <>
      {/* Normal edges — single draw call */}
      {batchGeometry.attributes.position && (
        <lineSegments geometry={batchGeometry}>
          <lineBasicMaterial color="#c9a36a" transparent opacity={0.14} />
        </lineSegments>
      )}

      {/* Highlighted edges — uses the memoized geometry built above (no new allocation per render) */}
      {highlightedEdges.length > 0 && highlightGeometry.attributes?.position && (
        <lineSegments geometry={highlightGeometry}>
          <lineBasicMaterial color="#f2ebe0" transparent opacity={0.42} />
        </lineSegments>
      )}

      {/* Midpoint motes + hit targets for bridge lanes */}
      {bridgeMotes.map(({ key, edge, midpoint, hovered, focused }) => (
        <group key={key}>
          <mesh position={[midpoint.x, midpoint.y, midpoint.z]}>
            <sphereGeometry args={[edge.type === 'bridge_lane' ? 0.18 : 0.11, 8, 8]} />
            <meshBasicMaterial
              color={edge.type === 'bridge_lane' ? '#e0a35c' : '#f0dcc0'}
              transparent
              opacity={hovered || focused ? 0.42 : 0.18}
            />
          </mesh>

          {/* Invisible hit sphere */}
          <mesh
            position={[midpoint.x, midpoint.y, midpoint.z]}
            onClick={(evt) => {
              evt.stopPropagation()
              if (focused) { clearFocusedObject(); return }
              setFocusedObject({ id: edge.id, type: 'edge', label: edge.type })
            }}
            onPointerOver={(evt) => {
              evt.stopPropagation()
              setHoveredObject({ id: edge.id, type: 'edge', label: edge.type })
            }}
            onPointerOut={(evt) => {
              evt.stopPropagation()
              setHoveredObject(null)
            }}
          >
            <sphereGeometry args={[0.55, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {(hovered || focused) && (
            <Billboard position={[midpoint.x, midpoint.y + 0.55, midpoint.z]}>
              <Html center distanceFactor={8}>
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={MOTION_TOKENS.tooltip}
                  className="pointer-events-none max-w-[240px] rounded-xl border border-fuchsia-400/30 bg-[#0c1024]/94 px-2.5 py-1.5 text-xs text-white shadow-[0_12px_34px_rgba(4,6,20,0.45)] backdrop-blur-sm"
                >
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200">
                    {edge.type.replace(/_/g, ' ')}
                  </p>
                  <p>{edge.explanation}</p>
                </motion.div>
              </Html>
            </Billboard>
          )}
        </group>
      ))}
    </>
  )
}

// Keep old export name so nothing else needs to change
const GalaxyEdges = GalaxyEdgesBatch

function ConstellationLines({ model, originId }) {
  // Build line geometries once per (model, originId) instead of allocating a new
  // THREE.BufferGeometry on every render (which previously leaked GPU memory),
  // and dispose them on unmount / when they change.
  const lines = useMemo(() => {
    const origin = (model?.nodes || []).find((node) => node.id === originId)
    if (!origin) return []
    const nodeMap = new Map((model?.nodes || []).map((node) => [node.id, node]))
    const out = []
    ;(model?.edges || [])
      .filter((edge) => edge.source === originId || edge.target === originId)
      .slice(0, 12)
      .forEach((edge) => {
        const other = nodeMap.get(edge.source === originId ? edge.target : edge.source)
        if (!other) return
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(origin.position.x, origin.position.y, origin.position.z),
          new THREE.Vector3(other.position.x, other.position.y, other.position.z),
        ])
        out.push({ id: edge.id, geometry, color: origin.color, opacity: 0.28 + (edge.weight || 0) * 0.36 })
      })
    return out
  }, [model, originId])

  useEffect(() => () => { lines.forEach((line) => line.geometry.dispose()) }, [lines])

  if (!lines.length) return null

  return (
    <>
      {lines.map((line) => (
        <line key={line.id} geometry={line.geometry}>
          <lineBasicMaterial color={line.color} transparent opacity={line.opacity} />
        </line>
      ))}
    </>
  )
}

function NebulaBackdrop({ colors, regions, model, galaxyMode, viewMode, showMoodRegions, reducedMotion = false }) {
  const meshRef = useRef()
  const profileTier = model?.metadata?.profileTier || 'partial'
  const minCoverage = profileTier === 'rich' ? 0.08 : profileTier === 'medium' ? 0.14 : 0.22

  useFrame(({ clock }) => {
    if (reducedMotion) return
    if (!meshRef.current) return
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.008
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.005) * 0.08
  })

  return (
    <>
      {/* Warm depth wash behind everything (was a cool data-tinted plane). */}
      <mesh ref={meshRef} position={[0, 0, -42]}>
        <planeGeometry args={[168, 168, 1, 1]} />
        <meshBasicMaterial color="#2a1d12" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {(showMoodRegions || viewMode === 'mood' || viewMode === 'identity' || galaxyMode === 'genre') && regions
        .filter((region) => (region.coverage || 0) >= minCoverage)
        .slice(0, 6)
        .map((region) => (
          <RegionNebula key={region.id} region={region} model={model} galaxyMode={galaxyMode} viewMode={viewMode} />
        ))}
    </>
  )
}

function SceneContents({
  model: rawModel,
  sparseMode,
  lowPower       = false,
  reducedMotion  = false,
  extraChildren  = null,
  // Traversal + presence additions
  traversalEnabled = false,
  scanPulseCount   = 0,
  onScanPulse      = null,
  autoRotateSpeed  = 0.18,
  showLabels       = true,
}) {
  // Structured three-tier layout: genres become separated regions, artists
  // cluster inside them, tracks satellite their artist. Keeps the model from
  // piling at the centre when audio features are mid-range. Everything below
  // (nodes, labels, edges, focus) reads from this laid-out model.
  const model = useMemo(() => applyTierLayout(rawModel), [rawModel])
  const [cameraDistance, setCameraDistance] = useState(24)
  const [cameraPos, setCameraPos] = useState(null)
  const cameraDistanceRef = useRef(24)
  const galaxyMode = useGalaxyInteractionStore((state) => state.galaxyMode)
  const viewMode = useGalaxyInteractionStore((state) => state.constellationMode ? 'constellation' : state.viewMode)
  const showTracks = useGalaxyInteractionStore((state) => state.showTracks)
  const showMoodRegions = useGalaxyInteractionStore((state) => state.showMoodRegions)
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const focusTarget = useGalaxyInteractionStore((state) => state.focusTarget)
  const constellationOrigin = useGalaxyInteractionStore((state) => state.constellationOrigin)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)
  const clearHoveredObject = useGalaxyInteractionStore((state) => state.clearHoveredObject)
  const setFocusTarget = useGalaxyInteractionStore((state) => state.setFocusTarget)
  const nebulaColors = getNebulaColors(model)
  const controlsRef = useRef()

  // Keyboard a11y: Esc deselects the focused node (eases the camera back).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (!useGalaxyInteractionStore.getState().focusedObject) return
      clearFocusedObject()
      setFocusTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearFocusedObject, setFocusTarget])
  // Labels render only where the galaxy is the foreground (passed from the
  // persistent canvas by active route). Off-route → empty layout → no Html
  // labels mount at all (also a small perf win), while stars/haze/nebulae
  // keep rendering as a silent background.
  const labelLayout = useMemo(
    () => (showLabels
      ? buildVisibleLabelLayout(model?.nodes || [], galaxyMode, viewMode, showTracks, focusedObject, hoveredObject, sparseMode, cameraPos)
      : EMPTY_LABEL_LAYOUT),
    [showLabels, cameraPos, focusedObject, galaxyMode, hoveredObject, model?.nodes, showTracks, viewMode, sparseMode],
  )

  // Single animation driver for all GalaxyNode instances.
  // Replaces 50-100 individual useFrame subscriptions with one pass over a Map.
  const nodeRefsMap = useRef(new Map())
  const registerNodeRef = useCallback((id, entry) => {
    nodeRefsMap.current.set(id, entry)
    return () => nodeRefsMap.current.delete(id)
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    const dt = Math.min(delta, 0.05)
    const { hoveredObject: ho, focusedObject: fo, motionState } = useGalaxyInteractionStore.getState()
    nodeRefsMap.current.forEach((entry) => {
      const { groupRef, meshRef, haloRef, matRef, haloMatRef, basePosition, driftSeed, nodeRef, objectId, objectType } = entry
      const node = nodeRef.current
      const sel = fo?.id === objectId && fo?.type === objectType
      const hov = ho?.id === objectId && ho?.type === objectType

      // Eased hover / selection activation, driven purely off refs (no per-node
      // React state, no re-render storm). Asymmetric for organic feel: spring-IN
      // (snappy + subtle overshoot), gentle exponential settle-OUT. glowT follows
      // the scale activation with a slight lag so light blooms after the grow.
      // Reduced motion: snap to target so hover still highlights but nothing animates.
      const hoverTarget = hov && !sel ? 1 : 0
      const selTarget = sel ? 1 : 0
      if (reducedMotion) {
        entry.hoverT = hoverTarget
        entry.hoverV = 0
        entry.glowT = hoverTarget
        entry.selT = selTarget
      } else {
        const h = entry.hoverT ?? 0
        if (hoverTarget > 0.5) {
          // Hover-IN: light underdamped spring (frame-rate independent via dt).
          let v = entry.hoverV ?? 0
          v += (HOVER_SPRING_K * (1 - h) - HOVER_SPRING_C * v) * dt
          entry.hoverT = h + v * dt
          entry.hoverV = v
        } else {
          // Hover-OUT: gentle monotonic settle, no undershoot. Drop spring velocity.
          entry.hoverT = THREE.MathUtils.damp(h, 0, HOVER_OUT_LAMBDA, dt)
          entry.hoverV = 0
        }
        // Glow trails the scale activation by ~40ms.
        entry.glowT = THREE.MathUtils.damp(entry.glowT ?? 0, entry.hoverT, GLOW_LAG_LAMBDA, dt)
        entry.selT = THREE.MathUtils.damp(entry.selT ?? 0, selTarget, 18, dt)
      }
      const hoverT = entry.hoverT
      const glowT = entry.glowT
      const selT = entry.selT

      // Click bloom: a brief scale+glow pulse on the rising edge of selection.
      // Onset is instant, decay eased (~375ms) → reads as a "bloom", not a bounce.
      if (sel && !entry.wasSel && !reducedMotion) entry.pulse = 1
      entry.wasSel = sel
      entry.pulse = entry.pulse ? THREE.MathUtils.damp(entry.pulse, 0, 8, dt) : 0
      const pulse = entry.pulse || 0

      if (groupRef.current) {
        if (reducedMotion) {
          // Freeze positional drift + sculptural tilt; keep nodes at rest.
          groupRef.current.position.copy(basePosition)
          groupRef.current.rotation.set(0, 0, 0)
        } else {
          const motionScale = sel ? 0.25 : hov ? 0.45 : 1
          const amplitude = (node.type === 'track' ? 0.08 : node.type === 'genre' ? 0.12 : 0.1) * (motionState?.oscillationStrength || 0.28) * motionScale
          groupRef.current.position.set(
            basePosition.x + Math.sin(t * 0.08 + driftSeed * 0.001) * amplitude,
            basePosition.y + Math.cos(t * 0.07 + driftSeed * 0.0017) * amplitude * 0.7,
            basePosition.z + Math.sin(t * 0.06 + driftSeed * 0.0021) * amplitude,
          )
          const sculpturalTilt = (sel ? 1 : hov ? 0.7 : 0.32) * MOTION_FLOAT.orb.tilt
          groupRef.current.rotation.y = Math.cos(t * 0.09 + driftSeed * 0.0014) * sculpturalTilt
          groupRef.current.rotation.x = Math.sin(t * 0.07 + driftSeed * 0.0019) * sculpturalTilt * 0.42
        }
      }
      if (meshRef.current) {
        if (!reducedMotion) {
          meshRef.current.rotation.y += node.type === 'genre' ? 0.0015 : node.type === 'cluster' ? 0.0012 : 0.0025
          meshRef.current.rotation.x = Math.sin(t * (node.type === 'track' ? 1.18 : 0.54) + basePosition.x) * 0.08
        }
        // Eased hover scale (~1.3x) + selected presence + brief click bloom.
        meshRef.current.scale.setScalar(1 + hoverT * 0.30 + selT * 0.22 + pulse * 0.18)
      }
      if (matRef.current) {
        // Raise emissive/bloom on hover + selection (base: cluster 0.9, else 0.65).
        // Uses the lagged glowT so light blooms a hair after the star grows; the
        // click pulse adds a brief extra flare.
        const baseEmissive = node.type === 'cluster' ? 0.9 : 0.65
        matRef.current.emissiveIntensity = baseEmissive + glowT * 0.85 + selT * 1.35 + pulse * 1.2
      }
      if (haloMatRef.current) {
        // Raise the soft halo glow with the lagged activation too.
        haloMatRef.current.opacity = 0.03 + glowT * 0.04 + selT * 0.07
      }
      if (haloRef.current) {
        const haloPulse = reducedMotion ? 0 : Math.sin(t * 0.8 + basePosition.y) * 0.03
        haloRef.current.scale.setScalar(1 + haloPulse + hoverT * 0.10 + selT * 0.18)
      }
    })
  })

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 26]} fov={54} far={2000} />
      {/* Exponential fog (reference: FogExp2 0x02030a, 0.0018) for depth falloff. */}
      <fogExp2 attach="fog" args={['#02030a', 0.0018]} />
      {/* Warm deep-space gradient sky behind everything. */}
      <GalaxySky />
      <ambientLight intensity={0.32} />
      <pointLight position={[0, 0, 7]} intensity={1.25} color="#ffb35a" />
      <pointLight position={[10, 8, 10]} intensity={0.7} color="#ffd89b" />
      <pointLight position={[-9, -6, -10]} intensity={0.5} color="#ff7a9d" />
      <pointLight position={[16, 12, 6]} intensity={0.32} color="#5fd8ff" />

        <ParallaxStarfield density={model?.metadata?.density} sparseMode={sparseMode} lowPower={lowPower} reducedMotion={reducedMotion} />
      <NebulaBackdrop colors={nebulaColors} regions={model?.regions || []} model={model} galaxyMode={galaxyMode} viewMode={viewMode} showMoodRegions={showMoodRegions} reducedMotion={reducedMotion} />
      {/* Ambient biome nebula puffs (reference technique), drifting slowly. */}
      <GalaxyNebulae sparseGraphics={sparseMode || lowPower} reducedMotion={reducedMotion} />

      {/* Luminous galactic core — warm additive glow at center (reference
          #fff0d0 + #ff8aa8) so the eye has a heart to orbit. Bloom lifts it.
          Opacities are tuned so the additive stack sums well below 1.0: the
          center must stay a warm luminous heart, not a white blob that erases
          stars and labels in front of it.
          (Was 0.55/0.30/0.18/0.09/0.04 → 0.30/0.16/0.10/0.05/0.025 → halved.) */}
      <group position={[0, 0, 0]}>
        {[
          { r: 1.1,  color: '#fff0d0', opacity: 0.15 },
          { r: 2.2,  color: '#ffd89b', opacity: 0.08 },
          { r: 4.0,  color: '#ff8aa8', opacity: 0.05 },
          { r: 7.0,  color: '#ff7a9d', opacity: 0.025 },
          { r: 11.0, color: '#5fd8ff', opacity: 0.0125 },
        ].map((layer) => (
          <mesh key={layer.r}>
            <sphereGeometry args={[layer.r, 24, 24]} />
            <meshBasicMaterial color={layer.color} transparent opacity={layer.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>

      <TasteCore core={model?.metadata?.core} model={model} galaxyMode={galaxyMode} />
      <GalaxyEdges model={model} galaxyMode={galaxyMode} viewMode={viewMode} />
      <ConstellationLines model={model} originId={constellationOrigin} />

      {(model?.nodes || []).map((node) => (
        <GalaxyNode
          key={node.id}
          node={node}
          cameraDistance={cameraDistance}
          galaxyMode={galaxyMode}
          viewMode={viewMode}
          showTracks={showTracks}
          showLabel={labelLayout.has(node.id)}
          labelOffset={labelLayout.get(node.id)}
          sparseMode={sparseMode}
          registerRef={registerNodeRef}
        />
      ))}

      <CameraTracker onDistance={setCameraDistance} onPosition={setCameraPos} distanceRef={cameraDistanceRef} />
      <FocusController
        focusTarget={focusTarget}
        controlsRef={controlsRef}
        reducedMotion={reducedMotion}
        restAutoRotate={!traversalEnabled || autoRotateSpeed > 0}
        enabled={!traversalEnabled}
      />
      <SelectionRing model={model} reducedMotion={reducedMotion} />
      {/* During traversal the wheel is owned by useTraversalCamera (dolly along
          view dir, shared WASD easing). Off traversal, OrbitControls keeps its
          built-in zoom. */}
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom={!traversalEnabled}
        enableRotate
        autoRotate={!traversalEnabled || autoRotateSpeed > 0}
        autoRotateSpeed={autoRotateSpeed}
        minDistance={8}
        maxDistance={42}
      />

      {/* Traversal + scan pulse — mounted only in /universe */}
      {traversalEnabled && (
        <Suspense fallback={null}>
          <TraversalController
            controlsRef={controlsRef}
            focusTarget={focusTarget}
            scanPulseCount={scanPulseCount}
            onScanPulse={onScanPulse}
            reducedMotion={reducedMotion}
            enabled={traversalEnabled}
          />
        </Suspense>
      )}

        {/* Living universe layer — heartbeat, cursor gravity, signal particles */}
        <Suspense fallback={null}>
          <GalaxyLivingLayer
            model={model}
            reducedMotion={reducedMotion}
            sparseGraphics={sparseMode || lowPower}
          />
        </Suspense>

        {/* Discovery comets — rendered inside the shared Canvas */}
        {extraChildren}

        {!sparseMode && !lowPower && !reducedMotion && (
          <Suspense fallback={null}>
            <GalaxyPostEffects />
          </Suspense>
        )}

      <mesh
        position={[0, 0, -60]}
        onClick={(event) => {
          clearFocusedObject()
          clearHoveredObject()
          setFocusTarget(null) // ease the camera back to the resting framing
          // Empty-space click only reaches this background plane when no node
          // hit-sphere intercepted (those stopPropagation). In traversal, glide
          // a comfortable hop toward the clicked direction so mouse-only users
          // can travel; the controller reuses the focus-glide easing.
          if (traversalEnabled && event?.point) {
            window.dispatchEvent(new CustomEvent('galaxy:glideToward', {
              detail: { x: event.point.x, y: event.point.y, z: event.point.z },
            }))
          }
        }}
      >
        <planeGeometry args={[400, 400, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  )
}

// Visually-hidden live region: reflects the focused node for screen readers so
// selection isn't a purely visual event. Lives in the DOM, outside the Canvas.
function GalaxyA11yAnnouncer() {
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const message = focusedObject?.label
    ? `Focused on ${focusedObject.label}. Press Escape to deselect.`
    : ''
  return <div className="sr-only" role="status" aria-live="polite">{message}</div>
}

export default function GalaxyScene({
  model,
  sparseMode       = false,
  lowPower         = false,
  reducedMotion    = false,
  webglEnabled     = true,
  extraChildren    = null,
  traversalEnabled = false,
  scanPulseCount   = 0,
  onScanPulse      = null,
  autoRotateSpeed  = 0.18,
  showLabels       = true,
}) {
  if (!webglEnabled) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center">
          <div className="max-w-md rounded-[24px] border border-white/10 bg-[#090d1f]/72 p-5 text-sm text-slate-200 backdrop-blur">
            WebGL is unavailable on this device right now, so the live galaxy is resting. Your profile and recommendation surfaces still work normally.
          </div>
        </div>
      )
    }

  return (
      <div
        className="relative h-full w-full"
        role="group"
        aria-label={`Interactive music galaxy with ${model?.nodes?.length || 0} stars. Click a star to focus it; press Escape to deselect.`}
      >
        <GalaxyA11yAnnouncer />
        <GalaxyAudioController reducedMotion={reducedMotion} />
        <GalaxySceneBoundary resetKey={`${model?.metadata?.galaxyMode || 'universal'}:${model?.nodes?.length || 0}`}>
          <Canvas
            gl={{ antialias: !lowPower, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
            dpr={lowPower ? [1, 1.1] : [1, 1.6]}
            onCreated={({ gl }) => {
              // Reference renderer setup: ACES tone mapping (set above), warm
              // exposure, SRGB output, deep-space clear colour.
              gl.toneMappingExposure = 1.05
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.setClearColor('#02030a', 1)
            }}
            onPointerMissed={() => useGalaxyInteractionStore.getState().clearHoveredObject()}
          >
            <Suspense fallback={null}>
              <SceneContents
                model={model}
                sparseMode={sparseMode}
                lowPower={lowPower}
                reducedMotion={reducedMotion}
                extraChildren={extraChildren}
                traversalEnabled={traversalEnabled}
                scanPulseCount={scanPulseCount}
                onScanPulse={onScanPulse}
                autoRotateSpeed={autoRotateSpeed}
                showLabels={showLabels}
              />
            </Suspense>
          </Canvas>
        </GalaxySceneBoundary>
      </div>
  )
}
