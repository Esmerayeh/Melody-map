import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Billboard, Html, MeshDistortMaterial, OrbitControls, PerspectiveCamera, shaderMaterial } from '@react-three/drei'
import { Canvas, extend, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import pinkNebulaImg from '../../assets/pink-nebula.avif'
import { motion } from 'framer-motion'
import useGalaxyInteractionStore from './useGalaxyInteractionStore'
import { getNebulaColors } from './galaxyExplainer'
import { stableHash } from './galaxyScoring'
import { slugifyInteraction } from './interactionModel.js'
import { MOTION_FLOAT, MOTION_TOKENS } from '../motion/motionTokens'
import GalaxySceneBoundary from './GalaxySceneBoundary'
import GalaxyAudioController from './GalaxyAudioController'
import useAdaptiveExperience from '../../hooks/useAdaptiveExperience'
import {
  applyTierLayout,
  SPREAD_SCALE,
  ARM_COUNT,
  ARM_INNER_RADIUS,
  ARM_OUTER_RADIUS,
  armCenterline,
} from './galaxyTierLayout'

const NODE_TYPES_WITH_LABELS = new Set(['genre', 'artist', 'track'])
const EMPTY_LABEL_LAYOUT = new Map() // stable ref for the no-labels (off-route) state
// Disables raycasting on a mesh (decorative layers) so only the hit sphere is
// clickable — makes click-to-focus reliable regardless of overlapping glow.
const NO_RAYCAST = () => null
const GalaxyPostEffects   = lazy(() => import('./GalaxyPostEffects'))
const GalaxyLivingLayer   = lazy(() => import('./GalaxyLivingLayer'))
const TraversalController = lazy(() => import('./TraversalController'))

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// ─────────────────────────────────────────────────────────────────────────────
// PlanetMaterial — every node (genre/artist/cluster/track) is a real rotating
// procedural planet, lit by the central hero core as its "sun".
//   • FBM value-noise surface in the node's own colour → continents + bands, each
//     planet unique via uSeed. Surface is sampled in LOCAL space so it spins with
//     the mesh (the parent useFrame rotates meshRef).
//   • Day/night terminator from uLightDir (per node: direction toward the core),
//     so the lit hemisphere always faces the galaxy's bright heart.
//   • Fresnel atmosphere rim (uAtmo) glowing against black, brighter on the day side.
//   • uGlow lifts emissive on hover/selection; uOpacity honours the view-mode fades.
// One shared program (compiled once); per-node instances just carry uniforms — no
// textures, no per-frame allocations. Warm palette preserved (driven by node colour).
// ─────────────────────────────────────────────────────────────────────────────
const PlanetMaterial = shaderMaterial(
  {
    uTime: 0, uSeed: 0, uGlow: 0, uOpacity: 1,
    uColor: new THREE.Color('#ffffff'),
    uColor2: new THREE.Color('#555555'),
    uAtmo: new THREE.Color('#ffffff'),
    uLightDir: new THREE.Vector3(0, 0, 1),
  },
  /* glsl */ `
    varying vec3 vWorldNormal; varying vec3 vViewDir; varying vec3 vPosL;
    void main() {
      vPosL = position;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  /* glsl */ `
    uniform float uTime; uniform float uSeed; uniform float uGlow; uniform float uOpacity;
    uniform vec3 uColor; uniform vec3 uColor2; uniform vec3 uAtmo; uniform vec3 uLightDir;
    varying vec3 vWorldNormal; varying vec3 vViewDir; varying vec3 vPosL;

    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vnoise(vec3 x){
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                     mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                     mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.02; a *= 0.5; } return s; }

    void main() {
      vec3 sp = normalize(vPosL) * 2.4 + uSeed;
      float n  = fbm(sp + vec3(0.0, uTime * 0.015, 0.0));
      float n2 = fbm(sp * 2.7 + 5.0);
      // Continents/seas + a faint banding so gas-giant-ish and rocky planets both read.
      float land  = smoothstep(0.44, 0.64, n);
      float bands = 0.5 + 0.5 * sin(vPosL.y * 7.0 + n2 * 2.5);
      vec3 surface = mix(uColor2, uColor, mix(land, bands, 0.4));
      surface *= 0.6 + 0.6 * n2;                         // stronger mottled contrast → reads as terrain
      // Day/night from the core "sun". Planets stay COOLER + dimmer than the hot
      // core so the core remains the focal hero and the surface (not a bloom blob)
      // is what you see — the terminator gives real volume.
      float ndl = dot(normalize(vWorldNormal), normalize(uLightDir));
      float day = smoothstep(-0.28, 0.5, ndl);
      vec3 col = surface * (0.1 + 0.72 * day);           // night side near-dark, day below bloom
      // Fresnel atmosphere rim — a thin lit halo on the day limb.
      float fres = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 3.0);
      col += uAtmo * fres * (0.22 + day * 0.6);
      // Hover / selection lift.
      col += uColor * uGlow;
      gl_FragColor = vec4(col, uOpacity);
    }`,
)
extend({ PlanetMaterial })

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
const RESTING_POS      = new THREE.Vector3(0, 0, 105)     // home framing (matches default camera; scaled to the SPREAD_SCALE galaxy)
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

// Pink-white star tints (palette): mostly white with soft pink/mauve hints — no
// warm-orange stars (they clashed with the pink nebula).
const STAR_PALETTE = [0xfaf5f8, 0xffffff, 0xf4e6ee, 0xe1a7c6, 0xc28fb2].map((hx) => new THREE.Color(hx))
function defaultStarColor() {
  const roll = Math.random()
  if (roll < 0.18) return STAR_PALETTE[0]
  if (roll < 0.55) return STAR_PALETTE[1]
  if (roll < 0.78) return STAR_PALETTE[2]
  if (roll < 0.93) return STAR_PALETTE[3]
  return STAR_PALETTE[4]
}
// Biome nebulae — reference hues, positions/radii scaled (~0.6) to this world. No purple.
// Restrained cosmic palette (per the cyber-celestial art direction): cool-dominant
// violet / indigo / steel-blue / cyan with a single soft-magenta accent. The muddy
// greens/teals/ambers were dropped — overlapping rainbow biomes are exactly what
// read as grey "slop"; a tight, mostly-cool palette reads as one deep galaxy.
// Pink-plum nebula biomes (palette only) — these tint both the dust clouds and
// the stars/backdrop that sample them, so the whole galaxy reads pink/mauve.
const NEBULAE = [
  { center: [-43, 2, -5],  rx: 39, ry: 14, rz: 29, color: 0xc1337f, count: 26 }, // pink 600
  { center: [31, -2, 11],  rx: 37, ry: 13, rz: 27, color: 0xa05488, count: 26 }, // mauve 600
  { center: [-18, -3, 49], rx: 33, ry: 12, rz: 26, color: 0xac6294, count: 22 }, // mauve 500
  { center: [23, 5, -59],  rx: 35, ry: 13, rz: 28, color: 0xd15296, count: 22 }, // pink 500
  { center: [66, 1, -24],  rx: 23, ry: 9,  rz: 18, color: 0xc28fb2, count: 16 }, // mauve 400
  { center: [55, -1, 37],  rx: 22, ry: 9,  rz: 19, color: 0xde83b4, count: 16 }, // pink 400
  { center: [-65, -1, 30], rx: 25, ry: 9,  rz: 18, color: 0x9a2d67, count: 16 }, // pink 700
  { center: [-35, 2, -67], rx: 28, ry: 9,  rz: 20, color: 0x81466e, count: 16 }, // mauve 700
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

// ── Procedural spiral disk (decorative ~14k stars) ───────────────────────────
// Reshaped from the old 4-wound-arms + bright-core-PILE into a grand-design
// spiral that OVERLAYS the data-node arms. The arms share ARM_COUNT / winding /
// inner+outer radius with galaxyTierLayout (imported via armCenterline), lifted
// into world space by SPREAD_SCALE so a decorative arm sits on its data arm.
// Three populations, no central size-boost (the luminous heart is TasteCore +
// the additive core shells — this disk only thickens the very centre subtly):
//   • arm spine  — log-spiral centerline + perpendicular Gaussian (visible arms)
//   • inter-arm  — faint sparse dust scattered between arms (fuzzy edges/realism)
//   • bulge      — small, dim, soft glow at the centre (NOT a star pile)
// ╭───────────────────────────  SPIRAL TUNING  ───────────────────────────╮
// Iterate by EYE, ONE knob per pass (so if a look gets worse you know exactly
// which change did it).
//
// SHARED with the data-node arms — do NOT redefine these here. Edit them in
// galaxyTierLayout.js (single source of truth, imported above) so the
// decorative arms and the data arms can never drift apart. Current values:
//   ARM_COUNT        = 2    arms       · raise → more arms       · lower → fewer
//   ARM_WIND_TURNS   = 0.7  tightness  · raise → tighter coil    · lower → looser / more open sweep
//   ARM_INNER_RADIUS = 4    arm start  · raise → wider open core · lower → arms start nearer centre
//   ARM_OUTER_RADIUS = 27   arm length · raise → arms reach rim  · lower → shorter / stubbier arms
//
// LOCAL to this decorative disk — edit these three RIGHT HERE:
const ARM_GAUSS_WIDTH = 6.0    // scatter / arm thickness   · raise → fuzzier, fatter arms · lower → tighter, crisper ribbons
const DISK_ARM_FRAC   = 0.76   // arm vs inter-arm balance  · raise → denser arms          · lower → more inter-arm dust
const DUST_LANE       = 0.35   // dark inner-edge dust lane · raise → deeper lane           · lower → symmetric (0 = off)
// ╰────────────────────────────────────────────────────────────────────────╯

// Secondary disk shape — NOT part of the eye-tuning loop; left as-is.
const DISK_THICKNESS  = 7      // vertical disc thickness; thins toward rim → 3D disc, not flat
const DISK_BULGE_FRAC = 0.04   // small dim central bulge (remainder ≈0.20 = inter-arm field)
const ARM_T_POWER     = 0.85   // <1 loosens the inward pile so arms fill out to the rim
const BULGE_RADIUS    = 12     // world radius of the soft central bulge
const KNOT_CHANCE     = 0.05   // a few brighter star-forming knots along the arms (never at centre)

const R_INNER = ARM_INNER_RADIUS * SPREAD_SCALE   // ≈16 world units (arms begin)
const R_OUTER = ARM_OUTER_RADIUS * SPREAD_SCALE   // ≈108 world units (arms end)

// Cheap ~N(0,1): sum of 3 uniforms (mean 1.5, std 0.5) re-centred and scaled.
function gauss1() { return ((Math.random() + Math.random() + Math.random()) - 1.5) * 2 }

function buildGalaxyDiskGeometry(count) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
  const sz = new Float32Array(count), ph = new Float32Array(count)
  const bulgeCut = 1 - DISK_BULGE_FRAC
  for (let i = 0; i < count; i++) {
    const roll = Math.random()
    let x, y, z, size, dim = 1
    if (roll < DISK_ARM_FRAC) {
      // Arm star: pick a spot on the log-spiral centerline, then offset
      // perpendicular to the arm by a Gaussian whose width is the arm thickness.
      const arm = Math.floor(Math.random() * ARM_COUNT)
      let t = Math.pow(Math.random(), ARM_T_POWER)
      t = clamp(t + (Math.random() - 0.5) * 0.03, 0, 1)               // mild along-arm jitter
      const c0 = armCenterline(arm, t)
      const c1 = armCenterline(arm, Math.min(1, t + 0.002))           // tangent (finite difference)
      let tx = c1.x - c0.x, tz = c1.z - c0.z
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl
      const px = -tz, pz = tx                                          // perpendicular, in disk plane
      const r = c0.radius * SPREAD_SCALE
      const width = ARM_GAUSS_WIDTH * (0.55 + 0.9 * t)                 // arms flare a little outward
      const off = gauss1() * width + DUST_LANE * width                // +bias → darker inner/leading edge
      x = c0.x * SPREAD_SCALE + px * off + tx * gauss1() * width * 0.3
      z = c0.z * SPREAD_SCALE + pz * off + tz * gauss1() * width * 0.3
      const tk = DISK_THICKNESS * Math.max(0.25, 1 - (r / R_OUTER) * 0.6)
      y = gauss1() * tk * 0.5
      size = Math.random() < KNOT_CHANCE ? 1.4 + Math.random() * 0.9   // star-forming knot sparkle
                                         : 0.55 + Math.random() * 0.85
    } else if (roll < bulgeCut) {
      // Inter-arm field: faint sparse dust filling the gaps between arms so the
      // disk reads as a galaxy (fuzzy edges) rather than two clean ribbons.
      const ir = R_INNER * 0.5 + Math.pow(Math.random(), 0.8) * (R_OUTER - R_INNER * 0.5)
      const th = Math.random() * Math.PI * 2
      x = Math.cos(th) * ir; z = Math.sin(th) * ir
      const tk = DISK_THICKNESS * Math.max(0.25, 1 - (ir / R_OUTER) * 0.6)
      y = gauss1() * tk * 0.5
      dim = 0.55; size = 0.4 + Math.random() * 0.55
    } else {
      // Central bulge: small, DIM, soft — a subtle thickening under the bright
      // TasteCore, slightly rounder in Y. No size boost, no bright cluster.
      const br = Math.pow(Math.random(), 0.7) * BULGE_RADIUS
      const th = Math.random() * Math.PI * 2
      x = Math.cos(th) * br; z = Math.sin(th) * br
      y = gauss1() * DISK_THICKNESS * 0.55
      dim = 0.5; size = 0.4 + Math.random() * 0.5
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
    const c = colorForPos(x, y, z)
    col[i * 3] = c.r * dim; col[i * 3 + 1] = c.g * dim; col[i * 3 + 2] = c.b * dim
    sz[i] = size
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
// Mid/near volume field — stars scattered through the SPACE AROUND the disk (a
// spherical volume, not the disk plane) so there's real geometry at near/mid
// depth to parallax against. Three strata now exist: the structured disk, this
// volume, and the far deep-field shell (r≈260–350). As the camera orbits, these
// mid stars sweep noticeably faster than the far shell → legible parallax (the
// #1 depth cue). The per-star size attenuation in makeStarMaterial makes the
// nearest of these render large + bright, the farther ones tiny + dim.
function buildVolumeFieldGeometry(count) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
  const sz = new Float32Array(count), ph = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random()
    const theta = u * Math.PI * 2, phi = Math.acos(2 * v - 1)
    // Near/mid shell (~45..200). Slight power bias packs a few more in close so
    // the foreground parallax layer is populated. Flattened a touch in Y so the
    // volume hugs the disk rather than forming a perfect ball.
    const r = 45 + Math.pow(Math.random(), 0.8) * 155
    pos[i * 3]     = Math.sin(phi) * Math.cos(theta) * r
    pos[i * 3 + 1] = Math.cos(phi) * r * 0.85
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r
    const c = defaultStarColor(); const dim = 0.5 + Math.random() * 0.4
    col[i * 3] = c.r * dim; col[i * 3 + 1] = c.g * dim; col[i * 3 + 2] = c.b * dim
    sz[i] = 0.45 + Math.random() * 0.9; ph[i] = Math.random()
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
      // Backdrop tint that very distant stars bleed toward (matches the sky
      // shell's mid colour) so there's a sense of air between near and far.
      uHaze: { value: new THREE.Color(0x130a1e) },
    },
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      varying vec3 vColor; varying float vTwinkle; varying float vBright; varying float vHaze;
      uniform float uTime; uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        // Cap point size so flying point-blank through the field (WASD) can't
        // spawn screen-filling additive blobs — uncapped, a near bright core hits
        // ~1368px (≈1.9M fragments) and the summed overdraw tanks the framerate
        // every frame WHILE MOVING. The 150px cap only clips stars within a few
        // units of the camera; the resting framing never reaches it (nearest
        // normal points are ~70px), so the depth "near = bigger" look is unchanged.
        gl_PointSize = min(aSize * uPixelRatio * (200.0 / max(dist, 1.0)), 150.0 * uPixelRatio);
        // ── Distance depth cues (GPU-side, per-star, reuses dist) ──────────────
        // Near stars render brighter, far ones dimmer → a luminance gradient on
        // top of the size attenuation above. The very distant field also bleeds
        // toward the backdrop haze so far layers feel like air, not a flat wall
        // of equal points. depthN: 0 near (<=25u) → 1 far (>=340u).
        float depthN = smoothstep(25.0, 340.0, dist);
        vBright = mix(1.30, 0.50, depthN);               // near = +30%, far = -50%
        vHaze   = smoothstep(150.0, 360.0, dist) * 0.40; // soft atmospheric falloff, far only
        vTwinkle = 0.65 + 0.35 * sin(uTime * 0.9 + aPhase * 6.28);
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vTwinkle; varying float vBright; varying float vHaze;
      uniform sampler2D uMap; uniform vec3 uHaze;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        if (tex.a < 0.01) discard;
        vec2 d = gl_PointCoord - 0.5;
        float core = smoothstep(0.18, 0.0, length(d));
        vec3 col = mix(vColor, uHaze, vHaze);            // distant stars recede into haze
        col *= (1.0 + core * 0.8) * vTwinkle * vBright;  // near brighter, far dimmer
        gl_FragColor = vec4(col, tex.a);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
}

// Procedural galaxy starfield (replaces the old flat parallax layers).
function ParallaxStarfield({ density, sparseMode, lowPower = false, reducedMotion = false }) {
  const { diskPoints, volumePoints, deepPoints } = useMemo(() => {
    const scale = sparseMode ? 0.4 : lowPower ? 0.6 : 1
    // Counts cut hard — the all-over white dots were too dense. The volume + deep
    // shells (which fill the whole view) are thinned the most so the nebula reads
    // as the backdrop; the disk keeps a modest spine of stars along the arms.
    const diskPoints = new THREE.Points(buildGalaxyDiskGeometry(Math.floor(3000 * scale)), makeStarMaterial())
    const volumePoints = new THREE.Points(buildVolumeFieldGeometry(Math.floor(700 * scale)), makeStarMaterial())
    const deepPoints = new THREE.Points(buildDeepFieldGeometry(Math.floor(800 * scale)), makeStarMaterial())
    diskPoints.rotation.x = 0.18; deepPoints.rotation.x = 0.18
    return { diskPoints, volumePoints, deepPoints }
  }, [sparseMode, lowPower])

  useEffect(() => () => {
    [diskPoints, volumePoints, deepPoints].forEach((p) => { p.geometry.dispose(); p.material.dispose() })
  }, [diskPoints, volumePoints, deepPoints])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    diskPoints.material.uniforms.uTime.value += dt
    volumePoints.material.uniforms.uTime.value += dt
    deepPoints.material.uniforms.uTime.value += dt
    // Disk rotation stays LOCKED (no ambient spin). The decorative arms are wound
    // to overlay the data-node arms (same ARM_COUNT/winding/scale), and the data
    // nodes don't spin — so any drift would slide the two layers apart over
    // minutes and break the grand-design read.
    // The volume + deep-field layers are NOT aligned to anything, so a very slow
    // independent drift gives living motion AND a second parallax rate (near layer
    // slides faster than far) without breaking that alignment. Off for reduced motion.
    if (!reducedMotion) {
      volumePoints.rotation.y += dt * 0.006
      deepPoints.rotation.y   += dt * 0.0018
    }
  })

  return (
    <>
      <primitive object={deepPoints} />
      <primitive object={volumePoints} />
      <primitive object={diskPoints} />
    </>
  )
}

// Pink nebula backdrop — the rose/blush swirling galaxy image set as a FLAT
// screen-space background (default UVMapping), so the image's real swirl/vortex
// composition reads exactly as shot. (Equirectangular mapping was tried first but
// it wraps a 16:9 image around a sphere and smears the swirl into a diffuse blob —
// the composition only survives as a flat fill.) Replaces the old gradient sky
// shell + the dark gl.setClearColor. Nothing else in the scene (stars, planets,
// core, bloom, camera) is touched — only the backdrop.
function GalaxyEnvironment() {
  const scene = useThree((state) => state.scene)
  const texture = useLoader(THREE.TextureLoader, pinkNebulaImg)
  useEffect(() => {
    // Default UVMapping → Three renders the texture as a flat backdrop stretched
    // to fill the viewport, preserving the swirl rather than wrapping a sphere.
    texture.mapping = THREE.UVMapping
    texture.colorSpace = THREE.SRGBColorSpace
    const previousBg = scene.background
    const previousIntensity = scene.backgroundIntensity
    scene.background = texture
    // Dim the backdrop a touch so the MANY white stars baked into the nebula image
    // read softer (they were the bulk of the "too many dots"); keeps the pink swirl.
    scene.backgroundIntensity = 0.78
    return () => {
      scene.background = previousBg
      scene.backgroundIntensity = previousIntensity ?? 1
      texture.dispose()
    }
  }, [scene, texture])
  return null
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
          // Fog pass: additive ambient puffs stack toward bright and washed the
          // spiral arms into haze. Halved opacity (was 0.10+0.14) so the disk's
          // individual stars + arm structure read as 3D THROUGH the haze, not
          // buried under it. RegionNebula (data haze) is cut separately below;
          // together they stop the scene reading as flat fog.
          // Contrast pass (round 2): these big additive sprites overlap across the
          // whole frame and their summed luminance is what washes a HEMISPHERE
          // into grey-green fog (worst where a bright teal/mint biome sits, e.g.
          // the lower-left). Thinned again (0.028+0.042 → 0.016+0.024) so the
          // biome tint survives only as a hint and genuine black void returns
          // ACROSS the whole field, not just the sparse side.
          // Now that the flat bokeh discs (region shells + genre glow) are gone and
          // the palette is a cohesive cool cosmic set, these TEXTURED puffs are the
          // real nebula dust — nudged back up slightly so the galaxy has soft
          // violet/cyan clouds, not a sterile void. Still well below the old wash.
          opacity: 0.032 + Math.random() * 0.055, rotation: Math.random() * Math.PI * 2,
        })
        const sp = new THREE.Sprite(mat)
        // Smaller footprint too (was 11+22): fewer overlapping pixels per puff
        // means the additive stack rises less, so the haze stays local to each
        // biome instead of bleeding across a whole hemisphere.
        const s = 12 + Math.random() * 20
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
    // Song mode shows the top songs REGARDLESS of the Satellites toggle — entering
    // Song mode is itself the request to see songs (this was the "shows nothing"
    // bug). Top 50 by rank (Spotify's max for top items).
    if (node.type !== 'track') return { visible: false, opacity: 0 }
    return { visible: (node.rank ?? 0) < 50, opacity: node.metrics?.significance > 0.56 ? 0.95 : 0.62 }
  }

  // Songs live ONLY in Song mode — never clutter the rest of the galaxy.
  if (node.type === 'track') return { visible: false, opacity: 0 }

  // Genres: full top-50 in Genre mode (handled above). In Universe mode, cap to
  // the top 25 so it isn't crowded; other view-modes keep their own genre logic.
  if (galaxyMode === 'universal' && node.type === 'genre' && (node.rank ?? 0) >= 25) return { visible: false, opacity: 0 }

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
// Scaled by SPREAD_SCALE: the whole layout (and the resting camera distance) is
// multiplied by SPREAD_SCALE, so a base-10 reveal radius meant artists never came
// "near" enough to ever name themselves once the galaxy was spread 4×. This keeps
// the reveal at the same RELATIVE proximity it had before the spread pass.
const ARTIST_REVEAL_DIST = 10 * SPREAD_SCALE  // an artist names itself only this near the camera

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
  if (!Number.isFinite(camDist)) return 0.78
  // Distances scaled by SPREAD_SCALE — without it the ramp maxed out at 40u while
  // the resting camera sits ~105u away, so every genre label was pinned at its
  // dim far-opacity (0.46) and read as "no text". Now it brightens as you approach.
  const t = clamp((40 * SPREAD_SCALE - camDist) / (30 * SPREAD_SCALE), 0, 1) // far → 0, near → 1
  return 0.78 + t * 0.20                         // 0.78 (far) .. 0.98 (near) — readable on bright nebula
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

function GalaxyNode({ node, cameraDistance, galaxyMode, viewMode, showTracks, showLabel, labelOffset, sparseMode, coarsePointer = false, registerRef }) {
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
  // Scaled by SPREAD_SCALE: node POSITIONS are multiplied by SPREAD_SCALE in the
  // tier layout (galaxy spread 4× apart + camera pulled 4× back), but these radii
  // are local world units that don't inherit that scale — so without this they
  // shrink to ~1/4 their old screen size and clicks miss the now-tiny targets.
  // Multiplying here restores the exact pre-spread (relative) click geometry.
  // On touch (coarse pointer) enlarge the target ~1.5× — a fingertip is far less
  // precise than a cursor, and a small star is otherwise hard to tap reliably.
  const hitRadius = Math.max(
    renderedSize * 3.4,
    node.type === 'track' ? 0.7 : node.type === 'genre' ? 2.6 : 1.5,
  ) * SPREAD_SCALE * (coarsePointer ? 1.5 : 1)
  const driftSeed = useMemo(() => stableHash(node.id || node.label || 'node'), [node.id, node.label])
  const basePosition = useMemo(() => new THREE.Vector3(position.x, position.y, position.z), [position.x, position.y, position.z])

  // Per-node planet uniforms (memoised — no per-frame allocation). Colours derive
  // from the node's identity colour: a darker sea/land tone + a lighter atmosphere
  // tint. uLightDir points at the galaxy core (0,0,0) so every planet's day side
  // faces the hero "sun"; uSeed makes each planet's surface unique.
  const planet = useMemo(() => {
    const base = new THREE.Color(node.color || '#ffd9a8')
    const land = base.clone().lerp(new THREE.Color('#0a0608'), 0.62)
    const atmo = base.clone().lerp(new THREE.Color('#ffffff'), 0.45)
    const dir = new THREE.Vector3(-position.x, -position.y, -position.z)
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1)
    dir.normalize()
    return { base, land, atmo, dir, seed: (driftSeed % 1000) / 37 }
  }, [node.color, position.x, position.y, position.z, driftSeed])

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
      {/* (Removed the big additive genre glow sphere — those flat overlapping
          discs were the main "bokeh slop". The planet body + anchor ring + label
          mark a genre; the textured dust + crisp stars carry the atmosphere.) */}
      {/* STRUCTURE LEGIBILITY — genre anchors wear a thin billboard RING so they
          read on sight as labelled region anchors (a deliberate "you are here"
          marker), instantly distinct from the bare points used for artist stars
          and track satellites. Camera-facing, additive, dim — a designed glyph,
          not more haze. Only genres get it; that's what makes the type obvious. */}
      {node.type === 'genre' && galaxyMode !== 'universal' && (
        <Billboard>
          <mesh raycast={NO_RAYCAST}>
            <ringGeometry args={[renderedSize * 2.15, renderedSize * 2.42, 48]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.32} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
      {/* Luminous star marker for artists / clusters / songs — a camera-facing
          additive glow + hot white core so each reads as a bright POINT against the
          bright nebula (the dark procedural planet alone was invisible, which also
          made Song mode look empty and bridges look like they pointed at nothing).
          Tracks are tiny, so they get a larger glow multiplier. Opacity follows the
          view-mode dimming. */}
      {(node.type === 'artist' || node.type === 'cluster' || node.type === 'track') && (
        <Billboard>
          <mesh raycast={NO_RAYCAST}>
            <planeGeometry args={[renderedSize * (node.type === 'track' ? 18 : 7), renderedSize * (node.type === 'track' ? 18 : 7)]} />
            <meshBasicMaterial map={getDiscTex()} color={node.color} transparent opacity={Math.min(0.85, 0.35 + visibility.opacity * 0.55)} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh raycast={NO_RAYCAST}>
            <planeGeometry args={[renderedSize * (node.type === 'track' ? 7 : 2.6), renderedSize * (node.type === 'track' ? 7 : 2.6)]} />
            <meshBasicMaterial map={getDiscTex()} color="#fff3fb" transparent opacity={Math.min(0.95, 0.4 + visibility.opacity * 0.5)} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Songs wear a distinct RING so they read as selectable nodes, not the
              decorative background star dust (the "looks exactly like a star" issue). */}
          {node.type === 'track' && (
            <mesh raycast={NO_RAYCAST}>
              <ringGeometry args={[renderedSize * 11, renderedSize * 13, 30]} />
              <meshBasicMaterial color={node.color} transparent opacity={0.6 * visibility.opacity + 0.2} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          )}
        </Billboard>
      )}
      {/* Decorative meshes are NON-raycastable so they never intercept a click;
          only the generous invisible hit sphere below is the click target. */}
      <mesh ref={haloRef} raycast={NO_RAYCAST}>
        <sphereGeometry args={[renderedSize * (node.type === 'track' ? 1.05 : node.type === 'artist' ? 2.0 : 1.8), 16, 16]} />
        {/* Base opacity only — hover/selection raise is eased in the parent useFrame via haloMatRef. */}
        <meshBasicMaterial ref={haloMatRef} color={node.color} transparent opacity={0.03} />
      </mesh>

      {/* Every node is a real rotating procedural planet (spin applied in the
          parent useFrame via meshRef). Higher segment counts than the old blobs so
          the silhouette reads round when you fly in close; tracks stay low-poly as
          they're tiny dust. */}
      <mesh ref={meshRef} raycast={NO_RAYCAST}>
        <sphereGeometry args={[renderedSize, node.type === 'track' ? 18 : 44, node.type === 'track' ? 18 : 44]} />
        <planetMaterial
          ref={matRef}
          uColor={planet.base}
          uColor2={planet.land}
          uAtmo={planet.atmo}
          uLightDir={planet.dir}
          uSeed={planet.seed}
          // Planets are SOLID bodies — keep them near-opaque so the surface +
          // terminator read instead of the starfield showing through. View-mode
          // de-emphasis now comes from the glow/halo, not from making worlds glassy.
          uOpacity={clamp(visibility.opacity, node.type === 'track' ? 0.55 : 0.9, 1)}
          transparent
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
          {/* distanceFactor scaled by SPREAD_SCALE: drei sizes the label by
              factor/cameraDistance, and the camera now rests ~4× farther out, so an
              unscaled factor rendered the text ~4× too small to read. */}
          <Html distanceFactor={(node.type === 'genre' ? 20 : 15) * SPREAD_SCALE} center zIndexRange={[40, 0]}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: labelOffset?.opacity ?? (node.type === 'genre' ? 0.6 : 0.85) }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="pointer-events-none select-none whitespace-nowrap"
            >
              {node.type === 'genre' ? (
                <span
                  className="font-display lowercase text-[21px] font-normal leading-none text-[#faf5f8]"
                  style={{ textShadow: '0 0 3px rgba(18,10,16,0.95), 0 1px 4px rgba(18,10,16,0.9), 0 0 18px rgba(48,23,37,0.95), 0 0 30px rgba(48,23,37,0.7)' }}
                >
                  {node.label}
                </span>
              ) : (
                <span
                  className="text-[13px] font-semibold leading-tight text-[#faf5f8]"
                  style={{ textShadow: '0 0 3px rgba(18,10,16,0.95), 0 1px 4px rgba(18,10,16,0.92), 0 0 14px rgba(48,23,37,0.9)' }}
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

  // Dispose the imperatively-built buffer on coverage change / unmount (route away).
  useEffect(() => () => geometry?.dispose(), [geometry])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const t = clock.getElapsedTime()
    pointsRef.current.rotation.y = t * (0.05 + (region.coverage || 0) * 0.08)
    pointsRef.current.rotation.z = Math.sin(t * 0.1 + region.coverage) * 0.08
  })

  return (
    // Point spread is built at base scale (uses region.coverage), so scale the
    // whole cloud by SPREAD_SCALE to keep the particles covering the now-spread
    // stars — same dot size, wider spread.
    <points ref={pointsRef} geometry={geometry} scale={SPREAD_SCALE}>
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
  // The haze blob's radius must scale with the galaxy: its center (region
  // centroid) is already multiplied by SPREAD_SCALE in the tier layout, so the
  // radius has to scale by the same factor or the blob sits offset from — and
  // too small for — its spread-out stars. baseScale is clamped at base size,
  // THEN multiplied by SPREAD_SCALE so each haze wraps its genre exactly as it
  // did before the scale pass, just larger.
  // Fog pass: tightened again (was 3.2+cov*5.5, clamp 2.6..5.6) so adjacent
  // genre blobs stop OVERLAPPING into one screen-filling cloud. Each genre now
  // wraps as a distinct, smaller soft place — that separation is what lets the
  // eye read "regions" instead of "atmosphere". Pairs with the lower shell
  // opacity below; the goal is legible structure, not more haze.
  const baseScale = clamp((1.7 + (region.coverage || 0) * 2.8) * tierScale, 1.5, 3.0) * SPREAD_SCALE
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
      {/* The resting region-haze spheres are GONE — flat additive shells always
          read as 2D bokeh discs and were the screen-filling "slop". A region's
          soft cloud now appears ONLY when you hover/focus it (a gentle highlight),
          so the resting galaxy stays deep + dark with structure from stars/dust. */}
      {(hovered || selected) && [1, 0.6].map((factor, index) => (
        <mesh key={`${region.id}-${factor}`} scale={[baseScale * factor, baseScale * factor * (0.66 + index * 0.08), baseScale * factor]}>
          <sphereGeometry args={[1, 20, 20]} />
          <meshBasicMaterial
            color={region.color}
            transparent
            opacity={(selected ? 0.06 : 0.04) - index * 0.012}
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
      {/* Additive halo shells — amber → gold → near-white. Brightened back up
          (from 0.07/0.11/0.14) so on /universe the core reads as a luminous heart,
          not a flat disc. Kept warm + moderate so it glows without the big white
          wash that previously hazed content-route panels. */}
      {[1.85, 1.4, 1.02].map((factor, index) => (
        <mesh key={`${factor}`}>
          <sphereGeometry args={[factor, 28, 28]} />
          <meshBasicMaterial color={index === 0 ? '#f0c089' : index === 1 ? '#ffd89b' : '#fff1d6'} transparent opacity={index === 0 ? 0.12 : index === 1 ? 0.2 : 0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {/* White-hot inner heart — small + additive, so the core reads as a glowing
          star with a bright centre instead of one flat skin-toned circle. */}
      <mesh>
        <sphereGeometry args={[0.52, 24, 24]} />
        <meshBasicMaterial color="#fff6ea" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Core sphere — emissive-dominant (low metalness, higher emissive) so it
          reads as LIGHT, not a glossy flesh-toned ball. Warm valence peach
          (#ffba95) kept as the identity colour. */}
      <mesh>
        <sphereGeometry args={[0.85, 28, 28]} />
        <MeshDistortMaterial
          color="#ffba95"
          emissive="#ffcaa0"
          emissiveIntensity={selected ? 1.5 : hovered ? 1.2 : 0.95}
          roughness={0.32}
          metalness={0.1}
          transparent
          opacity={0.95}
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
function GalaxyEdgesBatch({ model, galaxyMode, viewMode, showTracks = false, sparseMode = false }) {
  const hoveredObject      = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject      = useGalaxyInteractionStore((state) => state.focusedObject)
  const setHoveredObject   = useGalaxyInteractionStore((state) => state.setHoveredObject)
  const setFocusedObject   = useGalaxyInteractionStore((state) => state.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)

  const nodeMap = useMemo(
    () => Object.fromEntries((model?.nodes || []).map((n) => [n.id, n])),
    [model],
  )

  // Only the nodes actually RENDERED in the current mode — edges to hidden nodes
  // would draw a line to an empty position ("bridges pointing nowhere").
  const visibleIds = useMemo(() => {
    const s = new Set()
    for (const n of (model?.nodes || [])) {
      if (getNodeVisibility(n, galaxyMode, viewMode, showTracks, sparseMode).visible) s.add(n.id)
    }
    return s
  }, [model, galaxyMode, viewMode, showTracks, sparseMode])

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
    if (galaxyMode === 'song')        return all.filter((e) => e.type.startsWith('song_')).slice(0, 110)
    if (galaxyMode === 'artist')      return all.filter((e) => (e.type === 'bridge_lane' || e.type === 'audio_similarity' || e.type === 'shared_genre') && (hi(e) || (e.weight || 0) > 0.74)).slice(0, 54)
    if (galaxyMode === 'genre')       return all.filter((e) => (e.type === 'genre_affinity' || e.type === 'bridge_lane') && (hi(e) || (e.weight || 0) > 0.78)).slice(0, 48)
    if (viewMode === 'discovery')     return all.filter((e) => e.type === 'bridge_lane' && (hi(e) || (e.weight || 0) > 0.8)).slice(0, 42)
    if (viewMode === 'genre')         return all.filter((e) => (e.type === 'genre_affinity' || e.type === 'cluster_membership') && (hi(e) || (e.weight || 0) > 0.8)).slice(0, 42)
    // Default (Universal): show the connective WEB — each artist linked to its
    // genre(s) (shared_genre) + genre affinities + the strongest bridge lanes — so
    // the 50 artists / 50 genres read as one connected galaxy, not loose dots.
    return all.filter((e) => (e.type === 'shared_genre' || e.type === 'genre_affinity' || e.type === 'bridge_lane') && (hi(e) || (e.weight || 0) > 0.5)).slice(0, 110)
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
      // Drop edges whose endpoint isn't rendered in this mode (no lines to nowhere).
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return

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

  // These two geometries are rebuilt on every hover/selection (deps include
  // hovered/focused). Without disposal the old GPU buffers leak each time — over a
  // session of hovering stars that VRAM growth is exactly what drives the
  // "Context Lost" crash the recovery layer guards against. Dispose on replace/unmount.
  useEffect(() => () => {
    batchGeometry?.dispose()
    highlightGeometry?.dispose()
  }, [batchGeometry, highlightGeometry])

  // ── Bridge-lane midpoint motes (limited to meaningful edges only) ──────────
  const bridgeMotes = useMemo(() => (
    visibleEdges.filter((e) => e.type === 'bridge_lane' || e.type === 'audio_similarity').slice(0, 24).map((edge) => {
      const src = nodeMap[edge.source]
      const tgt = nodeMap[edge.target]
      if (!src || !tgt) return
      // Drop edges whose endpoint isn't rendered in this mode (no lines to nowhere).
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return null
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
      {/* Normal edges — single draw call. Dark plum (palette 800 #72274F) on NORMAL
          blending so the bridge lanes read as darker threads against the bright pink
          nebula backdrop. (The old amber + additive added LIGHT, which washed out
          over the bright nebula; a dark shade only reads with normal blending.) */}
      {batchGeometry.attributes.position && (
        <lineSegments geometry={batchGeometry}>
          <lineBasicMaterial color="#72274F" transparent opacity={0.55} depthWrite={false} />
        </lineSegments>
      )}

      {/* Highlighted edges — a brighter palette pink (500 #D15296) so the active
          lane still pops against the darker plum base lanes. */}
      {highlightedEdges.length > 0 && highlightGeometry.attributes?.position && (
        <lineSegments geometry={highlightGeometry}>
          <lineBasicMaterial color="#D15296" transparent opacity={0.6} />
        </lineSegments>
      )}

      {/* Midpoint motes + hit targets for bridge lanes */}
      {bridgeMotes.map(({ key, edge, midpoint, hovered, focused }) => (
        <group key={key}>
          <mesh position={[midpoint.x, midpoint.y, midpoint.z]}>
            <sphereGeometry args={[edge.type === 'bridge_lane' ? 0.18 : 0.11, 8, 8]} />
            <meshBasicMaterial
              color={edge.type === 'bridge_lane' ? '#9A2D67' : '#72274F'}
              transparent
              opacity={hovered || focused ? 0.7 : 0.4}
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
      {/* Faint warm depth wash behind everything. This is a single flat plane, so
          any meaningful opacity reads as uniform fog and lifts the black floor of
          the WHOLE frame — the classic "flat colored fog" look. Cut to a whisper
          (0.14 → 0.05): just enough warmth on the backdrop, not a haze that erases
          the dark void depth is read against. The GalaxyEnvironment nebula already
          owns the backdrop colour; this only adds a hint of warmth near centre. */}
      <mesh ref={meshRef} position={[0, 0, -42]}>
        <planeGeometry args={[168, 168, 1, 1]} />
        <meshBasicMaterial color="#2a1d12" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
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

// ── Cinematic intro (one-time on load) ───────────────────────────────────────
// Camera rests CLOSE on the hot core in near-black, then eases BACK to the
// normal framing, blooming the galaxy into view. Module-level guard so it plays
// only once per page load even if the persistent canvas remounts.
const INTRO_START = new THREE.Vector3(0, 0.2, 12)   // near the core, inside the field
const INTRO_HOLD = 0.7                               // beat resting ON the hot core first
const INTRO_DOLLY = 3.2                              // then ease-out pull-back (≈3.9s total)
const INTRO_END_TRAVERSAL = new THREE.Vector3(0, 16, 88) // matches useTraversalCamera OVERVIEW
let _introPlayed = false

// ─────────────────────────────────────────────────────────────────────────────
// HeroCore — the luminous galactic centre. A small shader-lit sphere that is the
// single hottest, hardest point in the scene: a warm-white/gold heart with a
// fresnel rim, pushed past 1.0 (toneMapped:false) so Bloom catches it like a
// star you can't quite look at. A few tight warm additive shells give the soft
// halo. uTime drives a slow internal pulse. Material built once, disposed on
// unmount; only scalar uniforms/scale change in useFrame (no per-frame allocs).
// ─────────────────────────────────────────────────────────────────────────────
function HeroCore({ reducedMotion = false }) {
  const coreRef = useRef()
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uColorHot:  { value: new THREE.Color('#fff7ec') }, // white-hot centre
      uColorGold: { value: new THREE.Color('#ffce8a') }, // warm gold body
      uColorRim:  { value: new THREE.Color('#ff8f3c') }, // amber fresnel rim
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColorHot; uniform vec3 uColorGold; uniform vec3 uColorRim;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0); // 1 facing cam → 0 at rim
        float fres = pow(1.0 - f, 2.4);
        float pulse = 0.92 + 0.08 * sin(uTime * 1.3);
        vec3 col = mix(uColorGold, uColorHot, pow(f, 1.5));  // gold body → white centre
        col += uColorHot * pow(f, 7.0) * 0.9;                // searing centre highlight
        col += uColorRim * fres * 1.5;                       // glowing rim against black
        col *= pulse;
        gl_FragColor = vec4(col, 1.0);
      }`,
    toneMapped: false,   // HDR overdrive → Bloom blows the centre out (the hot star)
  }), [])

  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    material.uniforms.uTime.value += reducedMotion ? 0 : dt
    if (coreRef.current && !reducedMotion) {
      const s = 1 + Math.sin(material.uniforms.uTime.value * 1.3) * 0.04
      coreRef.current.scale.setScalar(s)
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Hard, hot centre — the focal point of the whole scene. */}
      <mesh ref={coreRef} material={material} raycast={NO_RAYCAST}>
        <sphereGeometry args={[1.15, 48, 48]} />
      </mesh>
      {/* Soft warm additive bloom halo — a few tight shells (kept small so the
          centre stays a sharp heart, not the haze blob of the old core stack). */}
      {[
        { r: 1.9, color: '#ffd89b', opacity: 0.16 },
        { r: 3.0, color: '#ff9a4a', opacity: 0.07 },
        { r: 5.2, color: '#ff7a3a', opacity: 0.028 },
      ].map((l) => (
        <mesh key={l.r} raycast={NO_RAYCAST}>
          <sphereGeometry args={[l.r, 28, 28]} />
          <meshBasicMaterial color={l.color} transparent opacity={l.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// IntroDolly — isolated, gated intro pass. While `active`, it OWNS the camera:
// holds a beat on the core (INTRO_HOLD), then eases from INTRO_START out to
// `endPos` over INTRO_DOLLY, keeping the centre framed. It drives THROUGH the
// (still-mounted) OrbitControls — syncing their target + update() each frame —
// so input stays suspended, there's no spherical snap-back, and handoff on
// onDone() is seamless. It never rewrites the shared loop, just suspends input.
function IntroDolly({ active, endPos, controlsRef, onDone }) {
  const { camera } = useThree()
  const elapsed = useRef(0)

  // Frame the start BEFORE the first painted frame so there's no 105→12 flash.
  useLayoutEffect(() => {
    if (!active) return
    camera.position.set(INTRO_START.x, INTRO_START.y, INTRO_START.z)
    camera.lookAt(0, 0, 0)
    if (controlsRef?.current) controlsRef.current.target.set(0, 0, 0)
    elapsed.current = 0
  }, [active, camera, controlsRef])

  useFrame((_, delta) => {
    if (!active) return
    elapsed.current += Math.min(delta, 0.05)
    // Phase 1: hold a beat resting ON the hot core. Phase 2: ease-out dolly back.
    const t = Math.min(1, Math.max(0, (elapsed.current - INTRO_HOLD) / INTRO_DOLLY))
    const e = easeOutCubic(t)
    camera.position.set(
      THREE.MathUtils.lerp(INTRO_START.x, endPos.x, e),
      THREE.MathUtils.lerp(INTRO_START.y, endPos.y, e),
      THREE.MathUtils.lerp(INTRO_START.z, endPos.z, e),
    )
    // Drive THROUGH OrbitControls: keep its target at centre and let it re-derive
    // its spherical from the dolly position each frame. This makes its own damping
    // update() idempotent (no snap-back) AND leaves zero jump when input re-enables.
    const controls = controlsRef?.current
    if (controls) { controls.target.set(0, 0, 0); controls.update() }
    else camera.lookAt(0, 0, 0)
    if (t >= 1) onDone()
  })

  return null
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
  // Coarse pointer = touch device → bigger hit targets + touch-tuned camera below.
  const { touchDevice } = useAdaptiveExperience()

  // ── One-time cinematic intro gate ──────────────────────────────────────────
  // While `introActive`, IntroDolly owns the camera and every other camera owner
  // (OrbitControls/Focus/Traversal) is disabled below — the intro never touches
  // the shared loop, it just suspends it, then releases on completion. Skipped
  // for reduced motion and on any remount after it has already played once.
  const [introActive, setIntroActive] = useState(() => !reducedMotion && !_introPlayed)
  useEffect(() => { if (introActive) _introPlayed = true }, [introActive])
  const endIntro = useCallback(() => { _introPlayed = true; setIntroActive(false) }, [])
  const introEndPos = useMemo(
    () => (traversalEnabled ? INTRO_END_TRAVERSAL.clone() : RESTING_POS.clone()),
    [traversalEnabled],
  )

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
        // Planet material: advance its spin/surface clock and drive uGlow for the
        // hover/selection lift. Per-type base glow keeps the STRUCTURE hierarchy
        // (clusters/artists read hotter as anchors/stars, tracks stay dim dust);
        // the lagged glowT blooms light a hair after the grow, selT + pulse flare
        // on focus/click. uTime is shared across nodes (cheap scalar write).
        matRef.current.uTime = t
        const baseGlow = node.type === 'cluster' ? 0.16
          : node.type === 'artist' ? 0.13
          : node.type === 'genre'  ? 0.08
          : node.type === 'track'  ? 0.05
          : 0.10
        matRef.current.uGlow = baseGlow + glowT * 0.55 + selT * 0.95 + pulse * 0.9
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
      <PerspectiveCamera makeDefault position={[0, 0, 105]} fov={54} far={2000} />
      {/* Exponential fog (reference: FogExp2 0x02030a, 0.0018) for depth falloff. */}
      <fogExp2 attach="fog" args={['#02030a', 0.0018]} />
      {/* Pink nebula wraps the whole scene as a panoramic backdrop. */}
      <GalaxyEnvironment />
      <ambientLight intensity={0.32} />
      <pointLight position={[0, 0, 7]} intensity={1.25} color="#ffb35a" />
      <pointLight position={[10, 8, 10]} intensity={0.7} color="#ffd89b" />
      <pointLight position={[-9, -6, -10]} intensity={0.5} color="#ff7a9d" />
      <pointLight position={[16, 12, 6]} intensity={0.32} color="#5fd8ff" />

        <ParallaxStarfield density={model?.metadata?.density} sparseMode={sparseMode} lowPower={lowPower} reducedMotion={reducedMotion} />
      <NebulaBackdrop colors={nebulaColors} regions={model?.regions || []} model={model} galaxyMode={galaxyMode} viewMode={viewMode} showMoodRegions={showMoodRegions} reducedMotion={reducedMotion} />
      {/* Ambient biome nebula puffs (reference technique), drifting slowly. */}
      <GalaxyNebulae sparseGraphics={sparseMode || lowPower} reducedMotion={reducedMotion} />

      {/* Luminous galactic core — the hero focal point. A real shader-lit sphere
          (hot warm-white/gold centre + fresnel rim, HDR-overdriven so Bloom
          catches it) with a tight warm additive halo. Replaces the old stack of
          flat additive shells that read as a haze blob. uTime pulse inside. */}
      <HeroCore reducedMotion={reducedMotion} />

      <TasteCore core={model?.metadata?.core} model={model} galaxyMode={galaxyMode} />
      <GalaxyEdges model={model} galaxyMode={galaxyMode} viewMode={viewMode} showTracks={showTracks} sparseMode={sparseMode} />
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
          coarsePointer={touchDevice}
          registerRef={registerNodeRef}
        />
      ))}

      <CameraTracker onDistance={setCameraDistance} onPosition={setCameraPos} distanceRef={cameraDistanceRef} />
      <FocusController
        focusTarget={focusTarget}
        controlsRef={controlsRef}
        reducedMotion={reducedMotion}
        restAutoRotate={!traversalEnabled || autoRotateSpeed > 0}
        enabled={!traversalEnabled && !introActive}
      />
      <SelectionRing model={model} reducedMotion={reducedMotion} />
      <OrbitControls
        ref={controlsRef}
        // Touch-first camera: damping gives smooth inertia (premium on desktop,
        // essential on touch where a hard stop reads as janky). On touch we drop
        // pan (a two-finger drag otherwise flings the camera off into empty space
        // and reads broken) and slow the rotate for finer control; one finger
        // orbits, two fingers pinch-zoom.
        enableDamping
        dampingFactor={0.08}
        enablePan={!touchDevice}
        enableZoom
        enableRotate
        rotateSpeed={touchDevice ? 0.6 : 1}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        // Input is suspended during the intro (so a stray drag can't fight the
        // dolly); IntroDolly drives the camera THROUGH these controls and calls
        // update() itself, so there's no unmount churn and no spherical snap-back.
        enabled={!introActive}
        // NO auto-rotate in traversal mode: it orbits the camera around the focus
        // target every frame, which fought the click-to-focus glide (refocusing
        // from one node to another read as broken). Idle auto-spin only on the
        // non-traversal stage, where FocusController pauses it during the ease.
        autoRotate={!traversalEnabled && autoRotateSpeed > 0 && !introActive}
        autoRotateSpeed={autoRotateSpeed}
        minDistance={8}
        maxDistance={240}
      />

      {/* One-time cinematic intro dolly. Placed AFTER the controls so its useFrame
          runs last and has final say on the camera while active; yields cleanly
          via endIntro() on completion. */}
      <IntroDolly active={introActive} endPos={introEndPos} controlsRef={controlsRef} onDone={endIntro} />

      {/* Traversal + scan pulse — mounted only in /universe, and held back until
          the intro releases so the two never fight over the camera. */}
      {traversalEnabled && !introActive && (
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
        onClick={() => {
          clearFocusedObject()
          clearHoveredObject()
          setFocusTarget(null) // ease the camera back to the resting framing
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

// A calm, non-blocking notice shown while a dropped WebGL context rebuilds.
function GalaxyRecoveryOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="rounded-2xl border border-white/10 bg-[#090d1f]/80 px-4 py-2.5 text-xs text-slate-200 backdrop-blur">
        Re-rendering the galaxy…
      </div>
    </div>
  )
}

// Attaches WebGL context-loss listeners from INSIDE the Canvas via useThree, so
// it runs within R3F's lifecycle with proper cleanup (more reliable than onCreated).
// preventDefault() on loss lets the browser attempt an in-place restore.
function ContextLossManager({ onLost, onRestored }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const el = gl.domElement
    const handleLost = (event) => { event.preventDefault(); onLost() }
    const handleRestored = () => onRestored()
    el.addEventListener('webglcontextlost', handleLost, false)
    el.addEventListener('webglcontextrestored', handleRestored, false)
    return () => {
      el.removeEventListener('webglcontextlost', handleLost, false)
      el.removeEventListener('webglcontextrestored', handleRestored, false)
    }
  }, [gl, onLost, onRestored])
  return null
}

// Owns the live <Canvas>. Recovery (remount key + overlay) lives one level up in
// GalaxyScene, ABOVE GalaxySceneBoundary — because a lost context also makes R3F's
// render loop throw "Cannot read properties of null (reading 'alpha')", which the
// boundary catches and would replace this component (and any in-component remount)
// with its error UI. Keying the boundary from above instead spawns a fresh boundary
// + fresh Canvas + fresh GL context, clearing the error and recovering for real.
function GalaxyCanvas({
  model,
  sparseMode,
  lowPower,
  reducedMotion,
  extraChildren,
  traversalEnabled,
  scanPulseCount,
  onScanPulse,
  autoRotateSpeed,
  showLabels,
  onContextLost,
  onContextRestored,
}) {
  return (
    <Canvas
      gl={{ antialias: !lowPower, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={lowPower ? [1, 1.1] : [1, 1.6]}
      onCreated={({ gl }) => {
        // Reference renderer setup: ACES tone mapping (set above), warm
        // exposure, SRGB output. The deep-space clear colour is no longer set —
        // GalaxyEnvironment paints the pink nebula via scene.background instead.
        gl.toneMappingExposure = 1.05
        gl.outputColorSpace = THREE.SRGBColorSpace
        // gl.setClearColor('#02030a', 1)
      }}
      onPointerMissed={() => useGalaxyInteractionStore.getState().clearHoveredObject()}
    >
      <ContextLossManager onLost={onContextLost} onRestored={onContextRestored} />
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
  )
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
  // WebGL context-loss recovery, owned ABOVE GalaxySceneBoundary so it survives the
  // boundary catching R3F's render-loop throw on a dead context. On loss we show a
  // calm overlay and, if the browser doesn't restore promptly, bump `recoveryKey` —
  // which remounts the boundary + Canvas fresh, rebuilding the GL context. On a
  // browser-side restore we remount immediately for a clean rebuild.
  const [recoveryKey, setRecoveryKey] = useState(0)
  const [recovering, setRecovering] = useState(false)
  const recoverTimer = useRef(null)

  useEffect(() => () => { if (recoverTimer.current) clearTimeout(recoverTimer.current) }, [])

  const handleContextLost = useCallback(() => {
    setRecovering(true)
    if (recoverTimer.current) clearTimeout(recoverTimer.current)
    recoverTimer.current = setTimeout(() => {
      recoverTimer.current = null
      setRecoveryKey((k) => k + 1)
      setRecovering(false)
    }, 600)
  }, [])

  const handleContextRestored = useCallback(() => {
    if (recoverTimer.current) { clearTimeout(recoverTimer.current); recoverTimer.current = null }
    setRecoveryKey((k) => k + 1)
    setRecovering(false)
  }, [])

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
        <GalaxySceneBoundary
          key={recoveryKey}
          resetKey={`${model?.metadata?.galaxyMode || 'universal'}:${model?.nodes?.length || 0}`}
        >
          <GalaxyCanvas
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
            onContextLost={handleContextLost}
            onContextRestored={handleContextRestored}
          />
        </GalaxySceneBoundary>
        {recovering && <GalaxyRecoveryOverlay />}
      </div>
  )
}
