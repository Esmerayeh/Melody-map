import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Billboard, Html, MeshDistortMaterial, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { getNebulaColors } from './galaxyExplainer'

const VIEW_LABELS = {
  identity: ['genre', 'cluster', 'artist'],
  constellation: ['genre', 'cluster', 'artist', 'track'],
  mood: ['cluster', 'artist', 'track'],
  discovery: ['artist', 'track', 'genre'],
  genre: ['genre', 'cluster', 'artist', 'track'],
}

function buildStarGeometry(count, radius, bias = 1) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = radius * (0.65 + Math.random() * 0.35) * bias
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[(i * 3) + 1] = r * Math.cos(phi)
    positions[(i * 3) + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

function ParallaxStarfield({ density }) {
  const foregroundRef = useRef()
  const midgroundRef = useRef()
  const backgroundRef = useRef()

  const [foreground, midground, background] = useMemo(() => {
    const artistDensity = density?.artistStars || 30
    const trackDensity = density?.trackSatellites || 20
    return [
      buildStarGeometry(1100 + artistDensity * 6, 34, 0.9),
      buildStarGeometry(1800 + trackDensity * 14, 68, 1),
      buildStarGeometry(2600 + (artistDensity + trackDensity) * 10, 110, 1.05),
    ]
  }, [density])

  useFrame(({ camera, clock }) => {
    const drift = Math.sin(clock.getElapsedTime() * 0.06) * 0.05
    if (foregroundRef.current) foregroundRef.current.rotation.y = camera.rotation.y * -0.08 + drift
    if (midgroundRef.current) midgroundRef.current.rotation.y = camera.rotation.y * -0.035 - drift * 0.6
    if (backgroundRef.current) backgroundRef.current.rotation.y = camera.rotation.y * -0.015 + drift * 0.35
  })

  return (
    <>
      <points ref={foregroundRef} geometry={foreground}>
        <pointsMaterial size={0.14} color="#ffffff" transparent opacity={0.92} sizeAttenuation />
      </points>
      <points ref={midgroundRef} geometry={midground}>
        <pointsMaterial size={0.08} color="#c7d2fe" transparent opacity={0.45} sizeAttenuation />
      </points>
      <points ref={backgroundRef} geometry={background}>
        <pointsMaterial size={0.05} color="#818cf8" transparent opacity={0.24} sizeAttenuation />
      </points>
    </>
  )
}

function NebulaClouds({ colors, regions = [], showMoodRegions }) {
  const meshRef = useRef()
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.015
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.008) * 0.08
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, 0, -40]}>
        <planeGeometry args={[160, 160, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.08} side={THREE.DoubleSide}>
          <color attach="color" args={[colors[0]]} />
        </meshBasicMaterial>
      </mesh>
      {showMoodRegions && regions.slice(0, 5).map((region) => (
        <mesh
          key={region.id}
          position={[region.centroid.x, region.centroid.y, region.centroid.z]}
          scale={[6 + region.coverage * 22, 4 + region.coverage * 16, 6 + region.coverage * 22]}
        >
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color={region.color} transparent opacity={0.035 + region.coverage * 0.06} />
        </mesh>
      ))}
    </>
  )
}

function CameraTracker({ onDistance }) {
  useFrame(({ camera }) => onDistance(camera.position.length()))
  return null
}

function FocusController({ focusTarget, controlsRef }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!focusTarget || !controlsRef.current) return
    const target = new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z)
    controlsRef.current.target.copy(target)
    camera.position.set(target.x + 8, target.y + 5, target.z + 10)
    controlsRef.current.update()
  }, [focusTarget, camera, controlsRef])
  return null
}

function getNodeVisibility(node, viewMode, showTracks) {
  if (node.type === 'track' && !showTracks) return { visible: false, opacity: 0 }
  if (!VIEW_LABELS[viewMode]?.includes(node.type)) return { visible: false, opacity: 0 }

  if (viewMode === 'identity') {
    if (node.type === 'track') return { visible: false, opacity: 0 }
    if (node.type === 'artist') return { visible: true, opacity: node.metrics?.anchorScore > 0.5 ? 0.95 : 0.55 }
  }

  if (viewMode === 'discovery') {
    if (node.type === 'genre') return { visible: true, opacity: 0.28 }
    if (node.metrics?.discoveryScore > 0.5) return { visible: true, opacity: 0.95 }
    return { visible: true, opacity: 0.18 }
  }

  if (viewMode === 'mood') {
    if (node.type === 'cluster') return { visible: true, opacity: 0.8 }
    if (node.type === 'artist') return { visible: true, opacity: 0.7 }
    if (node.type === 'track') return { visible: true, opacity: 0.35 }
  }

  if (viewMode === 'genre') {
    if (node.type === 'genre' || node.type === 'cluster') return { visible: true, opacity: 0.92 }
    return { visible: true, opacity: 0.5 }
  }

  return { visible: true, opacity: 1 }
}

function labelVisible(node, cameraDistance, isSelected, isHovered) {
  if (isSelected || isHovered) return true
  if (node.type === 'genre' || node.type === 'cluster') return cameraDistance < 22
  if (node.role === 'anchor-star') return cameraDistance < 14
  if (node.type === 'artist') return cameraDistance < 10 && (node.metrics?.significance || 0) > 0.62
  return cameraDistance < 7 && node.type === 'track'
}

function GalaxyNode({ node, selectedId, hoveredId, onSelect, onHover, cameraDistance, viewMode, showTracks }) {
  const meshRef = useRef()
  const position = node.position || { x: 0, y: 0, z: 0 }
  const isSelected = selectedId === node.id
  const isHovered = hoveredId === node.id
  const visibility = getNodeVisibility(node, viewMode, showTracks)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += node.type === 'genre' ? 0.0025 : node.type === 'cluster' ? 0.002 : 0.004
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * (node.type === 'track' ? 1.2 : 0.7) + position.x) * 0.08
    const baseScale = node.type === 'track'
      ? 0.85
      : node.type === 'cluster'
        ? 1.08
        : node.role === 'anchor-star'
          ? 1.12
          : 1
    if (isSelected) {
      meshRef.current.scale.setScalar(baseScale * (1.2 + Math.sin(clock.getElapsedTime() * 2) * 0.05))
    } else if (isHovered) {
      meshRef.current.scale.setScalar(baseScale * 1.12)
    } else {
      meshRef.current.scale.setScalar(baseScale)
    }
  })

  if (!visibility.visible) return null

  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      onClick={(event) => { event.stopPropagation(); onSelect(node) }}
      onPointerOver={(event) => { event.stopPropagation(); onHover(node.id) }}
      onPointerOut={(event) => { event.stopPropagation(); onHover(null) }}
    >
      <sphereGeometry args={[node.size || 0.5, node.type === 'track' ? 14 : 26, node.type === 'track' ? 14 : 26]} />
      <MeshDistortMaterial
        color={node.color}
        emissive={node.color}
        emissiveIntensity={isSelected ? 1.8 : isHovered ? 1.25 : node.type === 'cluster' ? 0.75 : 0.5}
        roughness={0.25}
        metalness={0.7}
        transparent
        opacity={Math.max(0.12, Math.min(0.95, visibility.opacity * (node.type === 'track' ? 0.82 : 0.92)))}
        distort={node.type === 'genre' ? 0.17 : node.type === 'cluster' ? 0.1 : node.type === 'track' ? 0.08 : 0.24}
        speed={node.type === 'track' ? 0.8 : node.type === 'genre' ? 0.6 : 1.25}
      />
      {labelVisible(node, cameraDistance, isSelected, isHovered) && (
        <Billboard>
          <Html distanceFactor={8} center>
            <div className="pointer-events-none rounded-lg border border-white/10 bg-[#0d1025]/90 px-2 py-1 text-xs text-white backdrop-blur-sm">
              <p className="font-semibold">{node.label}</p>
              <p className="text-[10px] capitalize text-gray-400">{node.type.replace(/-/g, ' ')}</p>
            </div>
          </Html>
        </Billboard>
      )}
    </mesh>
  )
}

function GalaxyEdges({ model, hoveredEdgeId, onEdgeHover, viewMode }) {
  const nodeMap = useMemo(
    () => Object.fromEntries((model?.nodes || []).map((node) => [node.id, node])),
    [model],
  )

  const visibleEdges = useMemo(() => {
    const allEdges = model?.edges || []
    if (viewMode === 'identity') return allEdges.filter((edge) => edge.type !== 'track_artist' && edge.type !== 'track_genre').slice(0, 220)
    if (viewMode === 'constellation') return allEdges.slice(0, 320)
    if (viewMode === 'discovery') return allEdges.filter((edge) => edge.type === 'bridge_lane' || edge.type === 'audio_similarity' || edge.type === 'track_artist').slice(0, 260)
    if (viewMode === 'genre') return allEdges.filter((edge) => edge.type === 'artist_genre' || edge.type === 'genre_affinity' || edge.type === 'cluster_membership').slice(0, 260)
    return allEdges.slice(0, 280)
  }, [model, viewMode])

  return (
    <>
      {visibleEdges.map((edge) => {
        const source = nodeMap[edge.source]
        const target = nodeMap[edge.target]
        if (!source || !target) return null
        const points = [
          new THREE.Vector3(source.position.x, source.position.y, source.position.z),
          new THREE.Vector3(target.position.x, target.position.y, target.position.z),
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const midpoint = {
          x: (source.position.x + target.position.x) / 2,
          y: (source.position.y + target.position.y) / 2,
          z: (source.position.z + target.position.z) / 2,
        }
        const isHovered = hoveredEdgeId === edge.id
        const baseOpacity = edge.type === 'bridge_lane'
          ? 0.26 + (edge.weight || 0.2) * 0.35
          : Math.max(0.06, Math.min(0.45, edge.weight || 0.18))
        return (
          <group key={edge.id}>
            <line geometry={geometry}>
              <lineBasicMaterial
                color={isHovered ? '#c084fc' : source.color}
                transparent
                opacity={isHovered ? Math.min(0.88, baseOpacity + 0.2) : baseOpacity}
              />
            </line>
            <mesh
              position={[midpoint.x, midpoint.y, midpoint.z]}
              onPointerOver={(event) => { event.stopPropagation(); onEdgeHover(edge) }}
              onPointerOut={(event) => { event.stopPropagation(); onEdgeHover(null) }}
            >
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
            {isHovered && (
              <Billboard position={[midpoint.x, midpoint.y, midpoint.z]}>
                <Html distanceFactor={8} center>
                  <div className="pointer-events-none max-w-[220px] rounded-lg border border-purple-500/40 bg-[#0d1025]/95 px-2 py-1.5 text-xs text-white backdrop-blur-sm">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">{edge.type.replace(/_/g, ' ')}</p>
                    <p>{edge.explanation}</p>
                  </div>
                </Html>
              </Billboard>
            )}
          </group>
        )
      })}
    </>
  )
}

function ConstellationLines({ model, originId }) {
  const origin = (model?.nodes || []).find((node) => node.id === originId)
  if (!origin) return null

  const related = (model?.edges || [])
    .filter((edge) => edge.source === originId || edge.target === originId)
    .slice(0, 10)

  return (
    <>
      {related.map((edge) => {
        const otherId = edge.source === originId ? edge.target : edge.source
        const other = (model?.nodes || []).find((node) => node.id === otherId)
        if (!other) return null
        const points = [
          new THREE.Vector3(origin.position.x, origin.position.y, origin.position.z),
          new THREE.Vector3(other.position.x, other.position.y, other.position.z),
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        return (
          <line key={edge.id} geometry={geometry}>
            <lineBasicMaterial color={origin.color} transparent opacity={0.2 + (edge.weight || 0) * 0.5} />
          </line>
        )
      })}
    </>
  )
}

function SceneContents({
  model,
  selectedNode,
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
  hoveredEdge,
  onHoverEdge,
  constellationOrigin,
  viewMode,
  showTracks,
  showMoodRegions,
  focusTarget,
}) {
  const [cameraDistance, setCameraDistance] = useState(24)
  const nebulaColors = getNebulaColors(model)
  const controlsRef = useRef()

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 24]} fov={58} />
      <ambientLight intensity={0.28} />
      <pointLight position={[10, 10, 10]} intensity={1.55} />
      <pointLight position={[-10, -10, -10]} intensity={0.52} color="#6366f1" />
      <pointLight position={[0, 15, 0]} intensity={0.35} color="#ec4899" />

      <ParallaxStarfield density={model?.metadata?.density} />
      <NebulaClouds colors={nebulaColors} regions={model?.regions || []} showMoodRegions={showMoodRegions || viewMode === 'mood'} />

      <GalaxyEdges model={model} hoveredEdgeId={hoveredEdge?.id} onEdgeHover={onHoverEdge} viewMode={viewMode} />
      <ConstellationLines model={model} originId={constellationOrigin} />

      {(model?.nodes || []).map((node) => (
        <GalaxyNode
          key={node.id}
          node={node}
          selectedId={selectedNode?.id}
          hoveredId={hoveredNodeId}
          onSelect={onSelectNode}
          onHover={onHoverNode}
          cameraDistance={cameraDistance}
          viewMode={viewMode}
          showTracks={showTracks}
        />
      ))}

      <CameraTracker onDistance={setCameraDistance} />
      <FocusController focusTarget={focusTarget} controlsRef={controlsRef} />
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate autoRotate autoRotateSpeed={0.22} />

      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.16} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </>
  )
}

export default function GalaxyScene(props) {
  return (
    <div className="h-full w-full">
      <Canvas gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} onPointerMissed={() => props.onSelectNode(null)}>
        <Suspense fallback={null}>
          <SceneContents {...props} />
        </Suspense>
      </Canvas>
    </div>
  )
}
