/**
 * ObsessionWell.jsx
 * -----------------
 * Visualises the user's most-repeated artist as a gravity well:
 *   - dark halo rings
 *   - orbiting particle cloud
 *   - subtle "lensing" distortion ring
 *   - "Obsession field detected" label
 *
 * Data: looks for metrics.isSurge === true + highest significance,
 *       or the first anchor-star in the model.
 * Demo: uses seeded obsession artist from demoPlanet.js (Neon Bruise).
 *
 * GPU safety (03-r3f-performance-engineer):
 *   - All geometry created in useMemo
 *   - Particle positions updated via ref mutation in useFrame
 *   - No new objects allocated per frame
 */
import { useMemo, useRef }   from 'react'
import { Html }              from '@react-three/drei'
import { useFrame }          from '@react-three/fiber'
import * as THREE            from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Three.js component
// ─────────────────────────────────────────────────────────────────────────────
const ORBIT_COUNT = 28

export function ObsessionGravityWell({ node, reducedMotion = false }) {
  const groupRef   = useRef()
  const ring1Ref   = useRef()
  const ring2Ref   = useRef()
  const lensRef    = useRef()
  const partRef    = useRef()
  const pos        = node?.position || { x: 0, y: 0, z: 0 }
  const color      = node?.color    || '#B994FF'
  const significance = node?.metrics?.significance || 0.7

  // Build particle orbit geometry once
  const particleGeo = useMemo(() => {
    const positions = new Float32Array(ORBIT_COUNT * 3)
    for (let i = 0; i < ORBIT_COUNT; i++) {
      const angle  = (i / ORBIT_COUNT) * Math.PI * 2
      const radius = 1.8 + (i % 5) * 0.22
      positions[i * 3]     = Math.cos(angle) * radius
      positions[i * 3 + 1] = ((i % 7) - 3) * 0.12
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const t = clock.getElapsedTime()

    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.14 * significance
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.09 * significance
    if (lensRef.current)  lensRef.current.scale.setScalar(1 + Math.sin(t * 0.7) * 0.04)
    if (partRef.current)  partRef.current.rotation.y  = t * 0.08 * significance
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.cos(t * 0.04) * 0.04
      groupRef.current.rotation.x = Math.sin(t * 0.03) * 0.03
    }
  })

  if (!node) return null

  const haloSize = 2.2 + significance * 1.4

  return (
    <group ref={groupRef} position={[pos.x, pos.y, pos.z]}>
      {/* Dark halos */}
      {[haloSize, haloSize * 1.38, haloSize * 1.72].map((r, i) => (
        <mesh key={i} ref={i === 0 ? ring1Ref : i === 1 ? ring2Ref : null}>
          <torusGeometry args={[r, 0.035, 8, 80]} />
          <meshBasicMaterial
            color="#050618"
            transparent
            opacity={0.55 - i * 0.12}
          />
        </mesh>
      ))}

      {/* Lensing ring */}
      <mesh ref={lensRef}>
        <torusGeometry args={[haloSize * 0.82, 0.018, 8, 72]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} />
      </mesh>

      {/* Orbiting particle cloud */}
      <group ref={partRef}>
        <points geometry={particleGeo}>
          <pointsMaterial
            size={0.08}
            color={color}
            transparent
            opacity={0.48}
            sizeAttenuation
          />
        </points>
      </group>

      {/* Label — uses honest basis-derived title */}
      <Html distanceFactor={9} center position={[0, haloSize + 0.6, 0]}>
        <div className="pointer-events-none rounded-xl border border-white/10 bg-[#070814]/88 px-2.5 py-1 text-center text-[11px] backdrop-blur">
          <p className="uppercase tracking-[0.2em] text-white/40">
            {node._obsessionLabel || 'Core Gravity Field'}
          </p>
          <p className="mt-0.5 font-semibold text-white/80">{node.label}</p>
          {node._obsessionBasis && node._obsessionBasis !== 'fallback_significance' && (
            <p className="mt-0.5 text-[10px] text-white/30">
              {node._obsessionBasis === 'lastfm_playcount' ? '↑ play count' :
               node._obsessionBasis === 'listening_events' ? '↑ event freq' :
               '↑ recent surge'}
            </p>
          )}
        </div>
      </Html>
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — find obsession node from model using real obsession scoring
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo as _useMemo } from 'react'
import { findObsessionNode, labelForBasis, descriptionForBasis } from './obsessionScore'

export function useObsessionNode(model, options = {}) {
  return _useMemo(() => {
    if (!model?.nodes) return null
    const artists = model.nodes.filter((n) => n.type === 'artist')
    if (!artists.length) return null

    const result = findObsessionNode(artists, options)
    if (!result) return null

    // Attach obsession metadata to the node for use in HUD
    return {
      ...result.node,
      _obsessionScore: result.score,
      _obsessionBasis: result.basis,
      _obsessionLabel: labelForBasis(result.basis),
      _obsessionDescription: descriptionForBasis(result.basis, result.node.label),
    }
  }, [model, options])
}
