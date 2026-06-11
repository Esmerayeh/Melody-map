/**
 * ScanPulseEffect
 * ---------------
 * R3F component — lives inside the Canvas.
 * Renders expanding ring shockwaves from the galaxy core when Space is pressed.
 *
 * Props:
 *   triggerCount   integer; increment to spawn a new pulse
 *   reducedMotion  boolean; if true, no pulses are rendered
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function PulseRing({ id, onComplete }) {
  const meshRef     = useRef()
  const materialRef = useRef()
  const tRef        = useRef(0)
  const doneRef     = useRef(false)

  useFrame((_, delta) => {
    if (doneRef.current) return
    tRef.current += delta

    const t = tRef.current
    if (!meshRef.current || !materialRef.current) return

    const scale = 1 + t * 22
    meshRef.current.scale.setScalar(scale)
    materialRef.current.opacity = Math.max(0, 0.44 - t * 0.52)

    if (t > 0.85 && !doneRef.current) {
      doneRef.current = true
      onComplete(id)
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.0, 1.22, 72]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#9fdcff"
        transparent
        opacity={0.44}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

export default function ScanPulseEffect({ triggerCount = 0, reducedMotion = false }) {
  const [pulses, setPulses] = useState([])
  const lastCountRef = useRef(0)
  const nextIdRef    = useRef(0)

  useEffect(() => {
    if (reducedMotion) return
    if (triggerCount > lastCountRef.current) {
      const delta = triggerCount - lastCountRef.current
      lastCountRef.current = triggerCount
      // Spawn one ring per new trigger (cap at 3 simultaneous)
      setPulses((prev) => {
        const newPulses = Array.from({ length: Math.min(delta, 3) }, () => ({
          id: nextIdRef.current++,
        }))
        return [...prev, ...newPulses].slice(-6) // hard cap
      })
    }
  }, [triggerCount, reducedMotion])

  const removePulse = useCallback((id) => {
    setPulses((prev) => prev.filter((p) => p.id !== id))
  }, [])

  if (pulses.length === 0) return null

  return (
    <>
      {pulses.map((p) => (
        <PulseRing key={p.id} id={p.id} onComplete={removePulse} />
      ))}
    </>
  )
}
