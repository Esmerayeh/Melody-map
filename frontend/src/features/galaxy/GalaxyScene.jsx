import { Suspense, useMemo, useRef, useState } from 'react'
import { Billboard, Html, MeshDistortMaterial, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { getNebulaColors } from './galaxyExplainer'

function ParallaxStarfield() {
  const foregroundRef = useRef()
  const backgroundRef = useRef()

  const [foreground, background] = useMemo(() => {
    const buildGeometry = (count, radius) => {
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i += 1) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = radius * (0.8 + Math.random() * 0.2)
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[(i * 3) + 1] = r * Math.cos(phi)
        positions[(i * 3) + 2] = r * Math.sin(phi) * Math.sin(theta)
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      return geometry
    }

    return [buildGeometry(900, 30), buildGeometry(2400, 90)]
  }, [])

  useFrame(({ camera }) => {
    if (foregroundRef.current) foregroundRef.current.rotation.y = camera.rotation.y * -0.08
    if (backgroundRef.current) backgroundRef.current.rotation.y = camera.rotation.y * -0.02
  })

  return (
    <>
      <points ref={foregroundRef} geometry={foreground}>
        <pointsMaterial size={0.12} color="#ffffff" transparent opacity={0.9} sizeAttenuation />
      </points>
      <points ref={backgroundRef} geometry={background}>
        <pointsMaterial size={0.06} color="#9ca3ff" transparent opacity={0.5} sizeAttenuation />
      </points>
    </>
  )
}

function NebulaClouds({ colors }) {
  const meshRef = useRef()
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.015
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.008) * 0.08
  })

  return (
    <mesh ref={meshRef} position={[0, 0, -40]}>
      <planeGeometry args={[120, 120, 1, 1]} />
      <meshBasicMaterial transparent opacity={0.08} side={THREE.DoubleSide}>
        <color attach="color" args={[colors[0]]} />
      </meshBasicMaterial>
    </mesh>
  )
}

function CameraTracker({ onDistance }) {
  useFrame(({ camera }) => onDistance(camera.position.length()))
  return null
}

function GalaxyNode({ node, selectedId, hoveredId, onSelect, onHover, cameraDistance }) {
  const meshRef = useRef()
  const position = node.position || { x: 0, y: 0, z: 0 }
  const isSelected = selectedId === node.id
  const isHovered = hoveredId === node.id

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += node.type === 'genre' ? 0.003 : 0.005
    if (isSelected) {
      meshRef.current.scale.setScalar(1.18 + Math.sin(clock.getElapsedTime() * 2) * 0.04)
    } else if (isHovered) {
      meshRef.current.scale.setScalar(1.12)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      onClick={(event) => { event.stopPropagation(); onSelect(node) }}
      onPointerOver={(event) => { event.stopPropagation(); onHover(node.id) }}
      onPointerOut={(event) => { event.stopPropagation(); onHover(null) }}
    >
      <sphereGeometry args={[node.size || 0.5, 28, 28]} />
      <MeshDistortMaterial
        color={node.color}
        emissive={node.color}
        emissiveIntensity={isSelected ? 1.5 : isHovered ? 1.1 : 0.45}
        roughness={0.25}
        metalness={0.7}
        transparent
        opacity={node.type === 'genre' ? 0.72 : 0.88}
        distort={node.type === 'genre' ? 0.15 : 0.25}
        speed={node.type === 'genre' ? 0.8 : 1.3}
      />
      {(isSelected || isHovered || (cameraDistance < 12 && node.type === 'genre')) && (
        <Billboard>
          <Html distanceFactor={8} center>
            <div className="pointer-events-none rounded-lg border border-white/10 bg-[#0d1025]/90 px-2 py-1 text-xs text-white backdrop-blur-sm">
              <p className="font-semibold">{node.label}</p>
              <p className="text-[10px] capitalize text-gray-400">{node.type}</p>
            </div>
          </Html>
        </Billboard>
      )}
    </mesh>
  )
}

function GalaxyEdges({ model, hoveredEdgeId, onEdgeHover }) {
  const nodeMap = useMemo(
    () => Object.fromEntries((model?.nodes || []).map((node) => [node.id, node])),
    [model],
  )

  return (
    <>
      {(model?.edges || []).map((edge) => {
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
        return (
          <group key={edge.id}>
            <line geometry={geometry}>
              <lineBasicMaterial
                color={isHovered ? '#c084fc' : source.color}
                transparent
                opacity={Math.max(0.1, Math.min(0.55, edge.weight || 0.2))}
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
    .slice(0, 6)

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
            <lineBasicMaterial color={origin.color} transparent opacity={0.18 + (edge.weight || 0) * 0.45} />
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
}) {
  const [cameraDistance, setCameraDistance] = useState(20)
  const nebulaColors = getNebulaColors(model)

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={60} />
      <ambientLight intensity={0.28} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.45} color="#6366f1" />
      <pointLight position={[0, 15, 0]} intensity={0.3} color="#ec4899" />

      <ParallaxStarfield />
      <NebulaClouds colors={nebulaColors} />

      <GalaxyEdges model={model} hoveredEdgeId={hoveredEdge?.id} onEdgeHover={onHoverEdge} />
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
        />
      ))}

      <CameraTracker onDistance={setCameraDistance} />
      <OrbitControls enablePan enableZoom enableRotate autoRotate autoRotateSpeed={0.25} />

      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.18} luminanceSmoothing={0.9} mipmapBlur />
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
