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

const NODE_TYPES_WITH_LABELS = new Set(['genre', 'artist', 'track'])
const GalaxyPostEffects   = lazy(() => import('./GalaxyPostEffects'))
const GalaxyLivingLayer   = lazy(() => import('./GalaxyLivingLayer'))
const TraversalController = lazy(() => import('./TraversalController'))

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const buildStarGeometry = (count, radius, bias = 1) => {
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = radius * (0.65 + Math.random() * 0.35) * bias
    positions[index * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[(index * 3) + 1] = r * Math.cos(phi)
    positions[(index * 3) + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

function ParallaxStarfield({ density, sparseMode, lowPower = false }) {
  const foregroundRef = useRef()
  const midgroundRef = useRef()
  const backgroundRef = useRef()
  const dustRef = useRef()
  const foregroundMaterialRef = useRef()
  const dustMaterialRef = useRef()

  const [foreground, midground, background, dust] = useMemo(() => {
    const densityScale = sparseMode ? 0.35 : lowPower ? 0.55 : 1
    const artistDensity = (density?.artistStars || 30) * densityScale
    const trackDensity = (density?.trackSatellites || 20) * densityScale
    return [
      buildStarGeometry(1400 + artistDensity * 8, 34, 0.9),
      buildStarGeometry(2200 + trackDensity * 14, 68, 1),
      buildStarGeometry(3000 + (artistDensity + trackDensity) * 12, 115, 1.08),
      buildStarGeometry(900 + artistDensity * 5, 52, 0.96),
    ]
  }, [density, sparseMode, lowPower])

  // Dispose star buffer geometries when they are replaced or the field unmounts.
  useEffect(() => () => {
    [foreground, midground, background, dust].forEach((geometry) => geometry?.dispose?.())
  }, [foreground, midground, background, dust])

  useFrame(({ camera, clock }) => {
    const drift = Math.sin(clock.getElapsedTime() * 0.06) * 0.05
    if (foregroundRef.current) foregroundRef.current.rotation.y = camera.rotation.y * -0.08 + drift
    if (midgroundRef.current) midgroundRef.current.rotation.y = camera.rotation.y * -0.03 - drift * 0.6
    if (backgroundRef.current) backgroundRef.current.rotation.y = camera.rotation.y * -0.014 + drift * 0.35
    if (dustRef.current) dustRef.current.rotation.z = clock.getElapsedTime() * 0.01
    if (foregroundMaterialRef.current) foregroundMaterialRef.current.opacity = 0.84 + Math.sin(clock.getElapsedTime() * 0.18) * 0.08
    if (dustMaterialRef.current) dustMaterialRef.current.opacity = 0.06 + Math.sin(clock.getElapsedTime() * 0.22 + 1.5) * 0.025
  })

  return (
    <>
      <points ref={foregroundRef} geometry={foreground}>
        <pointsMaterial ref={foregroundMaterialRef} size={0.15} color="#ffffff" transparent opacity={0.92} sizeAttenuation />
      </points>
      <points ref={midgroundRef} geometry={midground}>
        <pointsMaterial size={0.08} color="#d9e2ff" transparent opacity={0.5} sizeAttenuation />
      </points>
      <points ref={backgroundRef} geometry={background}>
        <pointsMaterial size={0.05} color="#8ea0ff" transparent opacity={0.24} sizeAttenuation />
      </points>
      <points ref={dustRef} geometry={dust}>
        <pointsMaterial ref={dustMaterialRef} size={0.12} color="#f6c4ff" transparent opacity={0.07} sizeAttenuation />
      </points>
    </>
  )
}

function CameraTracker({ onDistance, distanceRef }) {
  const last = useRef({ t: 0, d: 0 })
  useFrame(({ camera, clock }) => {
    const d = camera.position.length()
    // Always keep the ref hot for frame-loop consumers (no React re-render).
    if (distanceRef) distanceRef.current = d
    // Throttle the React state update that drives label visibility to <=4/sec
    // and only on a meaningful change, so the scene graph does NOT re-render
    // every frame (previously ~60 re-renders/sec of the whole SceneContents).
    const now = clock.getElapsedTime()
    if (now - last.current.t > 0.25 && Math.abs(d - last.current.d) > 0.4) {
      last.current = { t: now, d }
      onDistance(d)
    }
  })
  return null
}

function FocusController({ focusTarget, controlsRef }) {
  const { camera } = useThree()

  useEffect(() => {
    if (!focusTarget || !controlsRef.current) return
    const target = new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z)
    controlsRef.current.target.copy(target)
    camera.position.set(target.x + 10, target.y + 5.5, target.z + 12.5)
    controlsRef.current.update()
  }, [camera, controlsRef, focusTarget])

  return null
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

function shouldShowNodeLabel(node, cameraDistance, selected, hovered) {
  if (selected || hovered) return true
  if (node.type === 'genre') return cameraDistance < 24
  if (node.role === 'anchor-star') return cameraDistance < 18
  if (node.type === 'artist') return cameraDistance < 12 && (node.metrics?.significance || 0) > 0.7
  if (node.type === 'track') return cameraDistance < 8 && (node.metrics?.significance || 0) > 0.74
  return false
}

function labelPriority(node) {
  if (node.type === 'genre') return 5 + (node.metrics?.significance || 0)
  if (node.role === 'anchor-star') return 4 + (node.metrics?.anchorScore || 0)
  if (node.type === 'artist') return 3 + (node.metrics?.significance || 0)
  if (node.type === 'track') return 2 + (node.metrics?.significance || 0)
  return 1
}

function buildVisibleLabelLayout(nodes, cameraDistance, galaxyMode, viewMode, showTracks, focusedObject, hoveredObject, sparseMode) {
  const candidates = nodes
    .filter((node) => NODE_TYPES_WITH_LABELS.has(node.type))
    .filter((node) => getNodeVisibility(node, galaxyMode, viewMode, showTracks, sparseMode).visible)
    .filter((node) => {
      const objectType = node.type === 'cluster' ? 'cluster' : node.type
      const objectId = node.type === 'cluster' ? node.clusterId : node.id
      const selected = focusedObject?.id === objectId && focusedObject?.type === objectType
      const hovered = hoveredObject?.id === objectId && hoveredObject?.type === objectType
      return shouldShowNodeLabel(node, cameraDistance, selected, hovered)
    })
    .sort((left, right) => labelPriority(right) - labelPriority(left))

  const threshold = cameraDistance < 10 ? 1.45 : cameraDistance < 16 ? 1.9 : 2.5
  const maxLabels = sparseMode ? 8 : 24
  const accepted = []
  const layout = new Map()

  candidates.forEach((node) => {
    if (accepted.length >= maxLabels) return
    const position = node.position || { x: 0, y: 0, z: 0 }
    const collides = accepted.some((acceptedNode) => {
      const other = acceptedNode.position || { x: 0, y: 0, z: 0 }
      const dx = position.x - other.x
      const dy = position.y - other.y
      const dz = position.z - other.z
      return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) < threshold
    })
    if (collides) return

    accepted.push(node)
    const hash = stableHash(node.id || node.label || 'label')
    layout.set(node.id, {
      y: (node.type === 'track' ? 0.34 : 0.55) + ((hash % 3) - 1) * 0.12,
      x: (((hash >> 3) % 3) - 1) * 0.16,
    })
  })

  return layout
}

function nodeLabelTone(type) {
  if (type === 'genre') return 'border-purple-400/30 bg-[#0c0f25]/88 text-purple-100'
  if (type === 'track') return 'border-cyan-400/25 bg-[#0a1020]/84 text-cyan-100'
  return 'border-white/12 bg-[#0a0f23]/88 text-white'
}

function GalaxyNode({ node, cameraDistance, galaxyMode, viewMode, showTracks, showLabel, labelOffset, sparseMode, registerRef }) {
  const groupRef = useRef()
  const meshRef = useRef()
  const haloRef = useRef()
  const nodeRef = useRef(node)
  const position = node.position || { x: 0, y: 0, z: 0 }
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
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
  const hovered = hoveredObject?.id === objectId && hoveredObject?.type === objectType
  const visibility = getNodeVisibility(node, galaxyMode, viewMode, showTracks, sparseMode)
  const renderedSize = clamp(node.size || 0.5, node.type === 'track' ? 0.13 : 0.24, node.type === 'cluster' ? 1.45 : node.type === 'genre' ? 1.34 : 0.92)
  const hitRadius = Math.max(renderedSize * 2.2, node.type === 'track' ? 0.45 : 0.7)
  const driftSeed = useMemo(() => stableHash(node.id || node.label || 'node'), [node.id, node.label])
  const basePosition = useMemo(() => new THREE.Vector3(position.x, position.y, position.z), [position.x, position.y, position.z])

  // Keep nodeRef current so the parent's single useFrame always sees latest node data.
  nodeRef.current = node

  // Register this node's refs with the parent animation loop. Runs once per mount
  // (deps are stable per-node), and cleans up on unmount.
  useEffect(() => {
    if (!registerRef) return
    return registerRef(node.id, { groupRef, meshRef, haloRef, basePosition, driftSeed, nodeRef, objectId, objectType })
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
      <mesh ref={haloRef}>
        <sphereGeometry args={[renderedSize * (node.type === 'track' ? 1.4 : 1.8), 16, 16]} />
        <meshBasicMaterial color={node.color} transparent opacity={selected ? 0.1 : hovered ? 0.06 : 0.03} />
      </mesh>

      <mesh ref={meshRef}>
        <sphereGeometry args={[renderedSize, node.type === 'track' ? 12 : 24, node.type === 'track' ? 12 : 24]} />
        <MeshDistortMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={selected ? 1.95 : hovered ? 1.35 : node.type === 'cluster' ? 0.9 : 0.65}
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
          setHoveredObject(null)
        }}
      >
        <sphereGeometry args={[hitRadius, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {showLabel && (
        <Billboard position={[labelOffset?.x || 0, renderedSize + (labelOffset?.y || 0.55), 0]}>
          <Html distanceFactor={8} center>
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={MOTION_TOKENS.label}
              className={`pointer-events-none rounded-xl border px-2.5 py-1 text-[11px] shadow-[0_10px_30px_rgba(4,6,20,0.45)] backdrop-blur-sm ${nodeLabelTone(node.type)}`}
            >
              <p className="font-semibold leading-tight">{node.label}</p>
              {node.type !== 'genre' && <p className="text-[10px] capitalize text-gray-400">{node.role?.replace(/-/g, ' ') || node.type}</p>}
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
          <meshBasicMaterial color={region.color} transparent opacity={(selected ? 0.085 : hovered ? 0.065 : 0.045) - index * 0.01} />
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
  const coreArtists = (core.supportingArtists || [])
    .map((artistId) => model?.nodes?.find((node) => node.id === artistId))
    .filter(Boolean)
    .slice(0, 4)

  const corePosition = core?.position || { x: 0, y: 0, z: 0 }
  const coreValid = Number.isFinite(corePosition.x) && Number.isFinite(corePosition.y) && Number.isFinite(corePosition.z)

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
      {[1.7, 1.28, 0.94].map((factor, index) => (
        <mesh key={`${factor}`}>
          <sphereGeometry args={[factor, 28, 28]} />
          <meshBasicMaterial color={index === 0 ? '#c9c2ff' : index === 1 ? core.color : '#f6f4ff'} transparent opacity={index === 0 ? 0.12 : index === 1 ? 0.18 : 0.24} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.85, 28, 28]} />
        <MeshDistortMaterial
          color={core.color}
          emissive={core.color}
          emissiveIntensity={selected ? 2.25 : hovered ? 1.75 : 1.5}
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
          <lineBasicMaterial color="#9DB7FF" transparent opacity={0.14} />
        </lineSegments>
      )}

      {/* Highlighted edges — uses the memoized geometry built above (no new allocation per render) */}
      {highlightedEdges.length > 0 && highlightGeometry.attributes?.position && (
        <lineSegments geometry={highlightGeometry}>
          <lineBasicMaterial color="#EAE6FF" transparent opacity={0.42} />
        </lineSegments>
      )}

      {/* Midpoint motes + hit targets for bridge lanes */}
      {bridgeMotes.map(({ key, edge, midpoint, hovered, focused }) => (
        <group key={key}>
          <mesh position={[midpoint.x, midpoint.y, midpoint.z]}>
            <sphereGeometry args={[edge.type === 'bridge_lane' ? 0.18 : 0.11, 8, 8]} />
            <meshBasicMaterial
              color={edge.type === 'bridge_lane' ? '#B994FF' : '#DCE6FF'}
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

function NebulaBackdrop({ colors, regions, model, galaxyMode, viewMode, showMoodRegions }) {
  const meshRef = useRef()
  const profileTier = model?.metadata?.profileTier || 'partial'
  const minCoverage = profileTier === 'rich' ? 0.08 : profileTier === 'medium' ? 0.14 : 0.22

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.008
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.005) * 0.08
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, 0, -42]}>
        <planeGeometry args={[168, 168, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.1} side={THREE.DoubleSide}>
          <color attach="color" args={[colors[0]]} />
        </meshBasicMaterial>
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
  model,
  sparseMode,
  lowPower       = false,
  reducedMotion  = false,
  extraChildren  = null,
  // Traversal + presence additions
  traversalEnabled = false,
  scanPulseCount   = 0,
  onScanPulse      = null,
  autoRotateSpeed  = 0.18,
}) {
  const [cameraDistance, setCameraDistance] = useState(24)
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
  const nebulaColors = getNebulaColors(model)
  const controlsRef = useRef()
  const labelLayout = useMemo(
    () => buildVisibleLabelLayout(model?.nodes || [], cameraDistance, galaxyMode, viewMode, showTracks, focusedObject, hoveredObject, sparseMode),
    [cameraDistance, focusedObject, galaxyMode, hoveredObject, model?.nodes, showTracks, viewMode, sparseMode],
  )

  // Single animation driver for all GalaxyNode instances.
  // Replaces 50-100 individual useFrame subscriptions with one pass over a Map.
  const nodeRefsMap = useRef(new Map())
  const registerNodeRef = useCallback((id, entry) => {
    nodeRefsMap.current.set(id, entry)
    return () => nodeRefsMap.current.delete(id)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const { hoveredObject: ho, focusedObject: fo, motionState } = useGalaxyInteractionStore.getState()
    nodeRefsMap.current.forEach(({ groupRef, meshRef, haloRef, basePosition, driftSeed, nodeRef, objectId, objectType }) => {
      const node = nodeRef.current
      const sel = fo?.id === objectId && fo?.type === objectType
      const hov = ho?.id === objectId && ho?.type === objectType
      if (groupRef.current) {
        const motionScale = sel ? 0.25 : hov ? 0.45 : 1
        const amplitude = (node.type === 'track' ? 0.08 : node.type === 'genre' ? 0.12 : 0.1) * (motionState?.oscillationStrength || 0.28) * motionScale
        groupRef.current.position.set(
          basePosition.x + Math.sin(t * 0.08 + driftSeed * 0.001) * amplitude,
          basePosition.y + Math.cos(t * 0.07 + driftSeed * 0.0017) * amplitude * 0.7,
          basePosition.z + Math.sin(t * 0.06 + driftSeed * 0.0021) * amplitude,
        )
      }
      if (meshRef.current) {
        meshRef.current.rotation.y += node.type === 'genre' ? 0.0015 : node.type === 'cluster' ? 0.0012 : 0.0025
        meshRef.current.rotation.x = Math.sin(t * (node.type === 'track' ? 1.18 : 0.54) + basePosition.x) * 0.08
        meshRef.current.scale.setScalar(sel ? 1.16 : hov ? 1.08 : 1)
      }
      if (groupRef.current) {
        const sculpturalTilt = (sel ? 1 : hov ? 0.7 : 0.32) * MOTION_FLOAT.orb.tilt
        groupRef.current.rotation.y = Math.cos(t * 0.09 + driftSeed * 0.0014) * sculpturalTilt
        groupRef.current.rotation.x = Math.sin(t * 0.07 + driftSeed * 0.0019) * sculpturalTilt * 0.42
      }
      if (haloRef.current) {
        haloRef.current.scale.setScalar(1 + Math.sin(t * 0.8 + basePosition.y) * 0.03 + (sel ? 0.18 : hov ? 0.08 : 0))
      }
    })
  })

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 26]} fov={54} />
      <fog attach="fog" args={['#03050f', 28, 98]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 7]} intensity={1.2} color="#B994FF" />
      <pointLight position={[10, 8, 10]} intensity={0.74} color="#d7cfff" />
      <pointLight position={[-9, -6, -10]} intensity={0.52} color="#9DB7FF" />
      <pointLight position={[16, 12, 6]} intensity={0.34} color="#EAE6FF" />

        <ParallaxStarfield density={model?.metadata?.density} sparseMode={sparseMode} lowPower={lowPower} />
      <NebulaBackdrop colors={nebulaColors} regions={model?.regions || []} model={model} galaxyMode={galaxyMode} viewMode={viewMode} showMoodRegions={showMoodRegions} />
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

      <CameraTracker onDistance={setCameraDistance} distanceRef={cameraDistanceRef} />
      <FocusController focusTarget={focusTarget} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
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
        onClick={() => {
          clearFocusedObject()
          clearHoveredObject()
        }}
      >
        <planeGeometry args={[400, 400, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
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
      <div className="h-full w-full">
        <GalaxySceneBoundary resetKey={`${model?.metadata?.galaxyMode || 'universal'}:${model?.nodes?.length || 0}`}>
          <Canvas
            gl={{ antialias: !lowPower, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
            dpr={lowPower ? [1, 1.1] : [1, 1.6]}
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
              />
            </Suspense>
          </Canvas>
        </GalaxySceneBoundary>
      </div>
  )
}
