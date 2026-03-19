import { useEffect, useRef, useState, useCallback, Suspense, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Billboard, PerspectiveCamera, MeshDistortMaterial } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { mapAPI } from '../services/api'
import { musicService } from '../services/musicService'
import { buildSonicIdentity, sonicColor, buildGalaxyGraph } from '../utils/musicMapper'
import useStore from '../store/useStore'
import { Loader2, Maximize2, Minimize2, RotateCcw, GitBranch } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────
const round2 = (n) => Math.round(n * 100) / 100
// Live tracks use sonicColor() from musicMapper instead.
const CLUSTER_COLORS = [
  '#6366f1','#ec4899','#10b981','#f59e0b',
  '#3b82f6','#8b5cf6','#ef4444','#06b6d4',
]

// Demo nodes pre-computed with sonicCoords / sonicColor so the demo galaxy
// already shows the Sonic Identity layout even without a Spotify connection.
const DEMO_NODES = [
  { _id:'1',  title:'Only Shallow',         artist:'My Bloody Valentine', cluster_id:2, popularity:80, sonic_color:'hsl(198, 85%, 44%)', map_coords_3d:{x:-1,  y:7,   z:-1  }, audio_features:{energy:0.85,valence:0.55,danceability:0.45,tempo:130} },
  { _id:'2',  title:'Sometimes',            artist:'My Bloody Valentine', cluster_id:2, popularity:72, sonic_color:'hsl(216, 77%, 47%)', map_coords_3d:{x:1,   y:3,   z:-2  }, audio_features:{energy:0.65,valence:0.60,danceability:0.40,tempo:95}  },
  { _id:'3',  title:'Cherry-Coloured Funk', artist:'Cocteau Twins',       cluster_id:3, popularity:68, sonic_color:'hsl(234, 79%, 49%)', map_coords_3d:{x:3,   y:4,   z:1   }, audio_features:{energy:0.70,valence:0.65,danceability:0.55,tempo:110} },
  { _id:'4',  title:'Heaven or Las Vegas',  artist:'Cocteau Twins',       cluster_id:3, popularity:74, sonic_color:'hsl(252, 77%, 51%)', map_coords_3d:{x:4,   y:2,   z:0   }, audio_features:{energy:0.60,valence:0.70,danceability:0.50,tempo:105} },
  { _id:'5',  title:'Fade Into You',        artist:'Mazzy Star',          cluster_id:0, popularity:85, sonic_color:'hsl(117, 62%, 43%)', map_coords_3d:{x:-1,  y:-3,  z:-3  }, audio_features:{energy:0.35,valence:0.45,danceability:0.35,tempo:72}  },
  { _id:'6',  title:'Karma Police',         artist:'Radiohead',           cluster_id:0, popularity:92, sonic_color:'hsl(91,  62%, 42%)', map_coords_3d:{x:-3,  y:1,   z:-2  }, audio_features:{energy:0.55,valence:0.35,danceability:0.42,tempo:76}  },
  { _id:'7',  title:'Creep',                artist:'Radiohead',           cluster_id:0, popularity:95, sonic_color:'hsl(65,  62%, 41%)', map_coords_3d:{x:-5,  y:3,   z:-1.5}, audio_features:{energy:0.65,valence:0.25,danceability:0.38,tempo:92}  },
  { _id:'8',  title:'Black',                artist:'Pearl Jam',           cluster_id:2, popularity:90, sonic_color:'hsl(78,  73%, 43%)', map_coords_3d:{x:-4,  y:5,   z:-3  }, audio_features:{energy:0.75,valence:0.30,danceability:0.40,tempo:84}  },
  { _id:'9',  title:'Blue Ridge Mountains', artist:'Fleet Foxes',         cluster_id:1, popularity:70, sonic_color:'hsl(195, 70%, 52%)', map_coords_3d:{x:5,   y:-1,  z:-2  }, audio_features:{energy:0.45,valence:0.75,danceability:0.48,tempo:88}  },
  { _id:'10', title:'White Winter Hymnal',  artist:'Fleet Foxes',         cluster_id:1, popularity:78, sonic_color:'hsl(208, 70%, 53%)', map_coords_3d:{x:6,   y:0,   z:-1  }, audio_features:{energy:0.50,valence:0.80,danceability:0.52,tempo:100} },
]

// ── Nebula color by dominant genre ────────────────────────────────────────────
const GENRE_NEBULA = {
  shoegaze:   ['#3a0ca3', '#7209b7'],
  synthwave:  ['#0d0221', '#00f5ff'],
  'dream pop':['#e0c3fc', '#8ec5fc'],
  electronic: ['#00f5ff', '#7700ff'],
  'lo-fi':    ['#2d1b69', '#4a3728'],
  ambient:    ['#0a0a2e', '#4040be'],
  metal:      ['#8b0000', '#1a1a1a'],
  jazz:       ['#8b4513', '#2c1810'],
  folk:       ['#4a7c3f', '#d4a96a'],
  'hip hop':  ['#ffd700', '#0a0a0a'],
  vaporwave:  ['#ff71ce', '#b967ff'],
  darkwave:   ['#2d0a4e', '#8a0aae'],
  'post-rock':['#2d3561', '#a0aec0'],
  default:    ['#3a0ca3', '#f72585'],
}

function getNebulaColors(songs) {
  if (!songs?.length) return GENRE_NEBULA.default
  // Use cluster distribution as a proxy for dominant genre
  const counts = {}
  songs.forEach((s) => { counts[s.cluster_id] = (counts[s.cluster_id] || 0) + 1 })
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const genreKeys = Object.keys(GENRE_NEBULA)
  return GENRE_NEBULA[genreKeys[dominant % (genreKeys.length - 1)]] || GENRE_NEBULA.default
}

// ── Parallax Starfield (custom shader) ────────────────────────────────────────
function ParallaxStarfield() {
  const fgRef = useRef()
  const bgRef = useRef()

  const [fgGeo, bgGeo] = useMemo(() => {
    const makeSphere = (count, radius) => {
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(2 * Math.random() - 1)
        const r     = radius * (0.8 + Math.random() * 0.2)
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = r * Math.cos(phi)
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      return geo
    }
    return [makeSphere(800, 30), makeSphere(2500, 90)]
  }, [])

  useFrame(({ camera }) => {
    if (fgRef.current) fgRef.current.rotation.y = camera.rotation.y * -0.08
    if (bgRef.current) bgRef.current.rotation.y = camera.rotation.y * -0.02
  })

  return (
    <>
      {/* Foreground stars — move more with parallax */}
      <points ref={fgRef} geometry={fgGeo}>
        <pointsMaterial size={0.12} color="#ffffff" transparent opacity={0.9} sizeAttenuation />
      </points>
      {/* Background stars — move less */}
      <points ref={bgRef} geometry={bgGeo}>
        <pointsMaterial size={0.06} color="#aaaaff" transparent opacity={0.5} sizeAttenuation />
      </points>
    </>
  )
}

// ── Nebula Cloud ───────────────────────────────────────────────────────────────
function NebulaClouds({ colors }) {
  const meshRef = useRef()
  const [c1, c2] = colors

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.015
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.008) * 0.1
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, -40]}>
      <planeGeometry args={[120, 120, 1, 1]} />
      <meshBasicMaterial transparent opacity={0.06} side={THREE.DoubleSide}>
        <color attach="color" args={[c1]} />
      </meshBasicMaterial>
    </mesh>
  )
}

// ── 3D Song Node ───────────────────────────────────────────────────────────────
function SongNode({ song, onSelect, isSelected, isHovered, onHover, neighborPositions, cameraDistance }) {
  const meshRef  = useRef()
  // Use the Sonic Identity color derived from valence+energy; fall back to
  // cluster palette for any legacy demo nodes that pre-date the mapper.
  const color    = song.sonic_color || CLUSTER_COLORS[song.cluster_id % CLUSTER_COLORS.length]
  // scale = 1 + popularity/20, clamped; base radius stays small so large nodes don't overlap
  const baseScale = song._scale || (1 + (song.popularity || 50) / 20)
  const radius   = 0.06 + (song.popularity || 50) / 100 * 0.22
  const pos      = song.map_coords_3d || { x: 0, y: 0, z: 0 }
  const bpm      = song.audio_features?.tempo || 120
  const beatHz   = bpm / 60

  // Gravitational pull: lean toward hovered node
  const basePos  = useMemo(() => new THREE.Vector3(pos.x, pos.y, pos.z), [pos.x, pos.y, pos.z])
  const currentPos = useRef(basePos.clone())

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += 0.005

    if (isHovered) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * beatHz * Math.PI * 2) * 0.18
      meshRef.current.scale.setScalar(pulse * 1.4)
      meshRef.current.material.emissiveIntensity = 1.8 + Math.sin(clock.getElapsedTime() * beatHz * Math.PI * 2) * 0.6
    } else if (isSelected) {
      meshRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 2) * 0.1)
      meshRef.current.material.emissiveIntensity = 1.4
    } else {
      // Gentle ambient pulse
      const ambient = 1 + Math.sin(clock.getElapsedTime() * 0.8 + pos.x) * 0.04
      meshRef.current.scale.setScalar(ambient)
      meshRef.current.material.emissiveIntensity = 0.4

      // Gravitational pull toward hovered neighbor
      if (neighborPositions?.length) {
        const pull = new THREE.Vector3()
        neighborPositions.forEach((np) => {
          const dir = new THREE.Vector3(np.x, np.y, np.z).sub(basePos)
          const dist = dir.length()
          if (dist < 4) pull.addScaledVector(dir.normalize(), 0.015 * (1 - dist / 4))
        })
        currentPos.current.lerp(basePos.clone().add(pull), 0.05)
      } else {
        currentPos.current.lerp(basePos, 0.05)
      }
      meshRef.current.position.set(currentPos.current.x, currentPos.current.y, currentPos.current.z)
    }
  })

  // Show labels only when zoomed in (camera distance < 18)
  const showLabel = isHovered || isSelected || (cameraDistance < 18 && (isHovered || isSelected))

  return (
    <mesh
      ref={meshRef}
      position={[pos.x, pos.y, pos.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(song) }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(song._id) }}
      onPointerOut={(e)  => { e.stopPropagation(); onHover(null) }}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <MeshDistortMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 1.4 : isHovered ? 1.8 : 0.4}
        roughness={0.2}
        metalness={0.7}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        transparent
        opacity={isHovered ? 0.95 : isSelected ? 0.9 : 0.75}
        // distort: energy maps 0→0.05 (calm) to 1→0.45 (intense)
        distort={isHovered ? 0.55 : 0.05 + (song.audio_features?.energy ?? 0.5) * 0.4}
        speed={isHovered ? beatHz * 2 : 1 + (song.audio_features?.energy ?? 0.5) * 2}
      />
      {(isSelected || isHovered) && (
        <Billboard>
          <Html distanceFactor={8} center>
            <div className="bg-[#0d1025]/90 border border-indigo-500/40 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap backdrop-blur-sm pointer-events-none">
              <p className="font-semibold">{song.title}</p>
              <p className="text-gray-400">{song.artist}</p>
              {song.genres?.length > 0 && (
                <p className="text-indigo-300 text-[10px] mt-0.5">{song.genres.slice(0, 2).join(' · ')}</p>
              )}
              {song.audio_features?.tempo && (
                <p className="text-indigo-400 text-[10px] mt-0.5">{Math.round(song.audio_features.tempo)} BPM</p>
              )}
            </div>
          </Html>
        </Billboard>
      )}
      {/* Zoom-in artist label */}
      {cameraDistance < 14 && !isHovered && !isSelected && (
        <Billboard>
          <Html distanceFactor={12} center>
            <p className="text-[9px] text-white/50 whitespace-nowrap pointer-events-none">{song.artist}</p>
          </Html>
        </Billboard>
      )}
    </mesh>
  )
}

// ── Cluster edges ──────────────────────────────────────────────────────────────
function ClusterEdges({ songs }) {
  const lines = []
  const byCluster = {}
  songs.forEach((s) => {
    const c = s.cluster_id ?? 0
    if (!byCluster[c]) byCluster[c] = []
    byCluster[c].push(s)
  })
  Object.values(byCluster).forEach((members) => {
    for (let i = 0; i < members.length - 1; i++) {
      const a = members[i].map_coords_3d || { x:0,y:0,z:0 }
      const b = members[i+1].map_coords_3d || { x:0,y:0,z:0 }
      // Use sonic_color of the first member so edges share the node's hue
      const color = members[i].sonic_color || CLUSTER_COLORS[members[i].cluster_id % CLUSTER_COLORS.length]
      lines.push([a, b, color])
    }
  })
  return (
    <>
      {lines.map(([a, b, color], i) => {
        const points = [new THREE.Vector3(a.x,a.y,a.z), new THREE.Vector3(b.x,b.y,b.z)]
        const geo    = new THREE.BufferGeometry().setFromPoints(points)
        return (
          <line key={i} geometry={geo}>
            <lineBasicMaterial color={color} transparent opacity={0.12} />
          </line>
        )
      })}
    </>
  )
}

// ── Graph edges from buildGalaxyGraph (artist→genre, genre→genre) ─────────────
// Builds genre-shared edges between artist nodes with hover tooltip
function GraphEdges({ galaxyNodes, songs, hoveredEdge, onEdgeHover }) {
  const genreEdges = useMemo(() => {
    const artistNodes = songs.filter((s) => s.genres?.length > 0)
    const edges = []
    for (let i = 0; i < artistNodes.length; i++) {
      for (let j = i + 1; j < artistNodes.length; j++) {
        const a = artistNodes[i]
        const b = artistNodes[j]
        const shared = (a.genres || []).filter((g) => (b.genres || []).includes(g))
        if (shared.length > 0) {
          edges.push({
            id: `${a._id}-${b._id}`,
            source: a._id,
            target: b._id,
            sharedGenre: shared[0],
            nameA: a.title,
            nameB: b.title,
          })
        }
      }
    }
    return edges
  }, [songs])

  const posMap = useMemo(() => {
    const m = {}
    songs.forEach((s) => { m[s._id] = s.map_coords_3d || { x: 0, y: 0, z: 0 } })
    return m
  }, [songs])

  return (
    <>
      {genreEdges.map((edge) => {
        const a = posMap[edge.source]
        const b = posMap[edge.target]
        if (!a || !b) return null
        const isHov = hoveredEdge === edge.id
        const mid = {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          z: (a.z + b.z) / 2,
        }
        const points = [new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]
        const geo = new THREE.BufferGeometry().setFromPoints(points)
        return (
          <group key={edge.id}>
            <line geometry={geo}>
              <lineBasicMaterial color={isHov ? '#c084fc' : '#7c6fff'} transparent opacity={isHov ? 0.55 : 0.15} />
            </line>
            {/* Invisible wider hit area */}
            <mesh
              position={[mid.x, mid.y, mid.z]}
              onPointerOver={(e) => { e.stopPropagation(); onEdgeHover(edge) }}
              onPointerOut={(e)  => { e.stopPropagation(); onEdgeHover(null) }}
            >
              <sphereGeometry args={[0.25, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
            {isHov && (
              <Billboard position={[mid.x, mid.y, mid.z]}>
                <Html distanceFactor={8} center>
                  <div className="bg-[#0d1025]/95 border border-purple-500/40 rounded-lg px-2 py-1.5 text-xs text-white whitespace-nowrap backdrop-blur-sm pointer-events-none max-w-[200px]">
                    <p className="text-purple-300 font-semibold text-[10px] mb-0.5">Genre connection</p>
                    <p>These artists are connected because they share the genre:</p>
                    <p className="text-purple-400 font-bold mt-0.5">"{edge.sharedGenre}"</p>
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

// ── Cosine similarity over audio features ─────────────────────────────────────
function cosineSim(a, b) {
  const keys = ['energy', 'valence', 'danceability', 'tempo']
  const scale = { tempo: 1 / 200 }
  const va = keys.map((k) => (a[k] ?? 0.5) * (scale[k] ?? 1))
  const vb = keys.map((k) => (b[k] ?? 0.5) * (scale[k] ?? 1))
  const dot  = va.reduce((s, v, i) => s + v * vb[i], 0)
  const magA = Math.sqrt(va.reduce((s, v) => s + v * v, 0))
  const magB = Math.sqrt(vb.reduce((s, v) => s + v * v, 0))
  return magA && magB ? dot / (magA * magB) : 0
}

// ── Constellation lines (glowing connections from origin to similar nodes) ────
function ConstellationLines({ songs, originId }) {
  const origin = songs.find((s) => s._id === originId)
  if (!origin) return null

  const af = origin.audio_features || {}
  const topN = songs
    .filter((s) => s._id !== originId)
    .map((s) => ({ song: s, sim: cosineSim(af, s.audio_features || {}) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 6)

  const op = origin.map_coords_3d || { x: 0, y: 0, z: 0 }

  return (
    <>
      {topN.map(({ song, sim }) => {
        const tp = song.map_coords_3d || { x: 0, y: 0, z: 0 }
        const points = [new THREE.Vector3(op.x, op.y, op.z), new THREE.Vector3(tp.x, tp.y, tp.z)]
        const geo = new THREE.BufferGeometry().setFromPoints(points)
        const color = origin.sonic_color || '#a78bfa'
        return (
          <line key={song._id} geometry={geo}>
            <lineBasicMaterial color={color} transparent opacity={0.15 + sim * 0.55} linewidth={1} />
          </line>
        )
      })}
    </>
  )
}

// ── Camera distance tracker ────────────────────────────────────────────────────
function CameraTracker({ onDistance }) {
  useFrame(({ camera }) => {
    onDistance(camera.position.length())
  })
  return null
}

// ── Mouse parallax scene wrapper ───────────────────────────────────────────────
function ParallaxScene({ children, mouseRef }) {
  const groupRef = useRef()
  useFrame(() => {
    if (!groupRef.current || !mouseRef.current) return
    const { x, y } = mouseRef.current
    groupRef.current.rotation.y += (x * 0.3 - groupRef.current.rotation.y) * 0.04
    groupRef.current.rotation.x += (-y * 0.2 - groupRef.current.rotation.x) * 0.04
  })
  return <group ref={groupRef}>{children}</group>
}

// ── Galaxy Scene ───────────────────────────────────────────────────────────────
function GalaxyScene({ songs, selected, onSelect, hovered, onHover, onClusterHover, nebulaColors, constellationOrigin, mouseRef, galaxyNodes, hoveredEdge, onEdgeHover }) {
  const [camDist, setCamDist] = useState(20)

  // Build neighbor map for gravitational pull
  const neighborMap = useMemo(() => {
    const map = {}
    if (!hovered) return map
    const hoveredSong = songs.find((s) => s._id === hovered)
    if (!hoveredSong) return map
    const hp = hoveredSong.map_coords_3d || { x:0,y:0,z:0 }
    songs.forEach((s) => {
      if (s._id === hovered) return
      const sp = s.map_coords_3d || { x:0,y:0,z:0 }
      const dx = sp.x - hp.x, dy = sp.y - hp.y, dz = sp.z - hp.z
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
      if (dist < 4) map[s._id] = [hp]
    })
    return map
  }, [hovered, songs])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={60} />
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />
      <pointLight position={[0, 15, 0]} intensity={0.3} color="#ec4899" />

      <ParallaxStarfield />
      <NebulaClouds colors={nebulaColors} />

      <ParallaxScene mouseRef={mouseRef}>
        <ClusterEdges songs={songs} />

        {/* Graph edges — genre-based connections between artist nodes */}
        <GraphEdges galaxyNodes={galaxyNodes} songs={songs} hoveredEdge={hoveredEdge} onEdgeHover={onEdgeHover} />

        {constellationOrigin && (
          <ConstellationLines songs={songs} originId={constellationOrigin} />
        )}

        {songs.map((song) => (
          <SongNode
            key={song._id}
            song={song}
            onSelect={onSelect}
            isSelected={selected?._id === song._id}
            isHovered={hovered === song._id}
            neighborPositions={neighborMap[song._id]}
            cameraDistance={camDist}
            onHover={(id) => {
              onHover(id)
              if (id) {
                const s = songs.find((x) => x._id === id)
                onClusterHover(s ? { clusterId: s.cluster_id, songId: id } : null)
              } else {
                onClusterHover(null)
              }
            }}
          />
        ))}
      </ParallaxScene>

      <CameraTracker onDistance={setCamDist} />
      <OrbitControls enablePan enableZoom enableRotate autoRotate autoRotateSpeed={0.3} />

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}

// ── Cluster Explainer ──────────────────────────────────────────────────────────
const CLUSTER_DESCRIPTORS = [
  { adjective: 'Low-Energy, Melancholic',  texture: 'minor keys and slow tempos',     vibe: 'introspective and shadowed' },
  { adjective: 'Low-Energy, Euphoric',     texture: 'soft harmonics and warm tones',  vibe: 'dreamy and weightless' },
  { adjective: 'High-Energy, Melancholic', texture: 'distortion and tension',          vibe: 'intense and cathartic' },
  { adjective: 'High-Energy, Euphoric',    texture: 'driving rhythms and bright keys', vibe: 'electric and unstoppable' },
  { adjective: 'Acoustic, Warm',           texture: 'organic instruments and space',   vibe: 'grounded and nostalgic' },
  { adjective: 'Atmospheric, Ambient',     texture: 'reverb and texture layers',       vibe: 'vast and meditative' },
  { adjective: 'Dark, Brooding',           texture: 'heavy low-end and minor modes',   vibe: 'raw and powerful' },
  { adjective: 'Bright, Danceable',        texture: 'syncopated beats and hooks',      vibe: 'joyful and kinetic' },
]

function ClusterExplainer({ clusterId, color, songCount }) {
  const desc = CLUSTER_DESCRIPTORS[clusterId % CLUSTER_DESCRIPTORS.length]
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="absolute top-4 right-4 max-w-xs pointer-events-none z-10"
    >
      <div className="rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={{ background: `${color}12`, borderColor: `${color}30`, backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-white">{desc.adjective} Nebula</span>
          <span className="text-gray-600">· {songCount} stars</span>
        </div>
        <p className="text-gray-400">Heavy on <span style={{ color }}>{desc.texture}</span> — {desc.vibe}.</p>
      </div>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MusicMap() {
  const [songs, setSongs]               = useState([])
  const [selected, setSelected]         = useState(null)
  const [hovered, setHovered]           = useState(null)
  const [clusterHover, setClusterHover] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [isDemo, setIsDemo]             = useState(false)
  const [isLive, setIsLive]             = useState(false)
  const [constellationMode, setConstellationMode] = useState(false)
  const [constellationOrigin, setConstellationOrigin] = useState(null)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const cinemaMode                      = useStore((s) => s.cinemaMode)
  const setCinemaMode                   = useStore((s) => s.setCinemaMode)
  const { musicProvider }               = useStore()

  const nebulaColors = useMemo(() => getNebulaColors(songs), [songs])

  const handleSelect = useCallback((song) => {
    setSelected(song)
    if (constellationMode) setConstellationOrigin(song._id)
  }, [constellationMode])

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width  - 0.5) * 2,
      y: ((e.clientY - rect.top)  / rect.height - 0.5) * 2,
    }
  }, [])

  // Pull data from the central profile store
  const profileGalaxyNodes    = useStore((s) => s.musicProfile?.galaxyNodes)
  const profileArtists        = useStore((s) => s.musicProfile?.topArtists)
  const profileTracks         = useStore((s) => s.musicProfile?.topTracks)
  const profileFeatures       = useStore((s) => s.musicProfile?.audioFeatures)
  const profileRecentlyPlayed = useStore((s) => s.musicProfile?.recentlyPlayed)

  const loadData = useCallback(async () => {
    setLoading(true)
    setIsLive(false)

    if (profileArtists?.length || profileTracks?.length) {
      const af      = profileFeatures || {}
      const energy  = af.energy       ?? 0.5
      const valence = af.valence      ?? 0.5
      const dance   = af.danceability ?? 0.5
      const SPREAD  = 12

      const artistMap = new Map()
      ;(profileArtists || []).forEach((a) => {
        if (a.id || a.name) artistMap.set(a.id || a.name, { ...a, _source: 'top' })
      })
      ;(profileTracks || []).forEach((t) => {
        const name = t.artist || t.artists?.[0]?.name
        const id   = t.artist_id || t.artists?.[0]?.id || name
        if (id && !artistMap.has(id)) {
          artistMap.set(id, { id, name, genres: [], popularity: t.popularity || 40,
            image: t.album_art || null, spotify_url: t.spotify_url || null, _source: 'track' })
        }
      })
      ;(profileRecentlyPlayed || []).forEach((t) => {
        const name = t.artist || t.artists?.[0]?.name
        const id   = t.artist_id || t.artists?.[0]?.id || name
        if (id && !artistMap.has(id)) {
          artistMap.set(id, { id, name, genres: [], popularity: t.popularity || 35,
            image: t.album_art || null, spotify_url: t.spotify_url || null, _source: 'recent' })
        }
      })

      const allArtists = [...artistMap.values()].slice(0, 120)
      const mapped = allArtists.map((artist, i) => {
        const pop      = (artist.popularity || 50) / 100
        const hueShift = (i / allArtists.length) * 0.4 - 0.2
        const nodeColor = sonicColor({ energy: Math.min(1, energy + hueShift), valence: Math.min(1, valence + hueShift * 0.5) })
        const angle    = (i / allArtists.length) * Math.PI * 2
        const r        = 3 + pop * 8
        const genreHash = (artist.genres?.[0] || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)
        const gAngle   = (genreHash % 100) / 100 * Math.PI * 2
        return {
          _id:           `artist_${artist.id || i}`,
          title:         artist.name,
          artist:        artist.name,
          name:          artist.name,
          cluster_id:    i % 8,
          popularity:    artist.popularity || 50,
          sonic_color:   nodeColor,
          _scale:        Math.max(1.2, 1 + (artist.popularity || 50) / 20),
          map_coords_3d: {
            x: round2(r * Math.cos(angle + gAngle * 0.3) + (valence - 0.5) * SPREAD * 0.4),
            y: round2((energy - 0.5) * SPREAD + (pop - 0.5) * 5),
            z: round2(r * Math.sin(angle + gAngle * 0.3) + (dance - 0.5) * SPREAD * 0.4),
          },
          audio_features: { energy, valence, danceability: dance, tempo: af.tempo ?? 120 },
          image:         artist.image || null,
          spotify_url:   artist.spotify_url || null,
          genres:        artist.genres || [],
        }
      })
      setSongs(mapped)
      setIsLive(true); setIsDemo(false); setLoading(false)
      return
    }

    if (profileGalaxyNodes?.length) {
      const mapped = profileGalaxyNodes.map((node) => ({
        _id:           node.id,
        title:         node.label,
        artist:        node.genre || node.type,
        cluster_id:    node.type === 'genre' ? 0 : 1,
        popularity:    node.popularity || Math.round((node.size || 0.5) * 100),
        sonic_color:   node.color,
        map_coords_3d: { x: node.x, y: node.y, z: node.z },
        image:         node.image,
        spotify_url:   node.spotify_url,
        genres:        [],
      }))
      setSongs(mapped)
      setIsLive(true); setIsDemo(false); setLoading(false)
      return
    }

    try {
      const { data } = await mapAPI.getData()
      setSongs(data?.length > 0 ? data : DEMO_NODES)
      setIsDemo(!data?.length)
    } catch {
      setSongs(DEMO_NODES); setIsDemo(true)
    } finally { setLoading(false) }
  }, [musicProvider, profileArtists, profileGalaxyNodes, profileFeatures, profileTracks, profileRecentlyPlayed])
  useEffect(() => { loadData() }, [loadData])

  // Sonic Identity quadrant labels — always accurate for live data
  const CLUSTER_LABELS = [
    { label: 'Calm · Dark',    color: sonicColor({ energy: 0.25, valence: 0.25 }) },
    { label: 'Calm · Bright',  color: sonicColor({ energy: 0.25, valence: 0.75 }) },
    { label: 'Intense · Dark', color: sonicColor({ energy: 0.75, valence: 0.25 }) },
    { label: 'Intense · Bright', color: sonicColor({ energy: 0.75, valence: 0.75 }) },
  ]

  const canvasContent = (
    <div className="w-full h-full" onMouseMove={handleMouseMove}>
      <Canvas gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Suspense fallback={null}>
          <GalaxyScene
            songs={songs} selected={selected} onSelect={handleSelect}
            hovered={hovered} onHover={setHovered}
            onClusterHover={setClusterHover}
            nebulaColors={nebulaColors}
            constellationOrigin={constellationMode ? constellationOrigin : null}
            mouseRef={mouseRef}
            galaxyNodes={profileGalaxyNodes}
            hoveredEdge={hoveredEdge}
            onEdgeHover={setHoveredEdge}
          />
        </Suspense>
      </Canvas>
    </div>
  )

  // Cinema mode: full-screen overlay
  if (cinemaMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <div className="w-full h-full">{canvasContent}</div>
        )}
        {/* Cinema controls overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {isDemo && (
            <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-md text-amber-400 text-xs">Demo</span>
          )}
          <button onClick={() => setCinemaMode(false)}
            className="p-2 rounded-xl bg-black/60 border border-white/10 text-white hover:bg-white/10 transition-all backdrop-blur-sm"
            title="Exit Cinema Mode">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
        <AnimatePresence>
          {clusterHover && (() => {
            const clusterSongs = songs.filter((s) => s.cluster_id === clusterHover.clusterId)
            // Use the hovered song's own sonic_color for the tooltip accent
            const hoveredSong = songs.find((s) => s._id === clusterHover.songId)
            const color = hoveredSong?.sonic_color || CLUSTER_COLORS[clusterHover.clusterId % CLUSTER_COLORS.length]
            return <ClusterExplainer key={clusterHover.clusterId} clusterId={clusterHover.clusterId} color={color} songCount={clusterSongs.length} />
          })()}
        </AnimatePresence>
        {selected && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
            <div className="p-4 bg-black/70 border border-white/10 rounded-2xl flex items-center gap-4 backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                {selected.album_art
                  ? <img src={selected.album_art} alt={selected.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-indigo-500/30 flex items-center justify-center text-xl">🎵</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{selected.title}</p>
                <p className="text-gray-400 text-xs truncate">{selected.artist}</p>
              </div>
              {selected.spotify_url && (
                <a href={selected.spotify_url} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 rounded-lg text-[#1DB954] text-xs font-medium transition-all shrink-0">
                  Open ↗
                </a>
              )}
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white transition-colors shrink-0">×</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Normal mode
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Music Galaxy</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {isLive ? `${songs.length} artists mapped from your library` : isDemo ? 'Demo galaxy — connect a music source to see your own' : `${songs.length} nodes in your galaxy`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-md text-amber-400 text-xs">Demo</span>}
          <button onClick={loadData} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all" title="Refresh">
            <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => { setConstellationMode((v) => !v); if (constellationMode) setConstellationOrigin(null) }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
              constellationMode
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400'
            }`}
            title="Constellation Mode — click a star to see similar connections">
            <GitBranch className="w-3.5 h-3.5" />
            {constellationMode ? 'Constellation ON' : 'Constellation'}
          </button>
          <button onClick={() => setCinemaMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-medium transition-all"
            title="Cinema Mode">
            <Maximize2 className="w-3.5 h-3.5" /> Cinema
          </button>
        </div>
      </div>

      <div className="relative bg-[#050810] rounded-2xl border border-white/5 overflow-hidden" style={{ height: 580 }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-gray-400 text-sm">Loading music galaxy...</p>
            </div>
          </div>
        ) : (
          <motion.div className="w-full h-full"
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            {canvasContent}
          </motion.div>
        )}
        {/* Constellation mode hint */}
        {constellationMode && !constellationOrigin && !loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs pointer-events-none">
            Click a star to reveal its constellation
          </div>
        )}
        <AnimatePresence>
          {clusterHover && (() => {
            const clusterSongs = songs.filter((s) => s.cluster_id === clusterHover.clusterId)
            const hoveredSong = songs.find((s) => s._id === clusterHover.songId)
            const color = hoveredSong?.sonic_color || CLUSTER_COLORS[clusterHover.clusterId % CLUSTER_COLORS.length]
            return <ClusterExplainer key={clusterHover.clusterId} clusterId={clusterHover.clusterId} color={color} songCount={clusterSongs.length} />
          })()}
        </AnimatePresence>
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-1.5 pointer-events-none">
          {CLUSTER_LABELS.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 px-2 py-1 bg-black/50 rounded-md text-xs text-gray-300">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="mt-4 p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            {selected.album_art
              ? <img src={selected.album_art} alt={selected.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-2xl">🎵</div>}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">{selected.title}</h3>
            <p className="text-gray-400 text-sm">{selected.artist}</p>
            <div className="flex gap-4 mt-2">
              {[['Energy', selected.audio_features?.energy], ['Valence', selected.audio_features?.valence], ['Dance', selected.audio_features?.danceability]].map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-gray-500">{k} </span>
                  <span className="text-indigo-400 font-medium">{v != null ? Math.round(v * 100) + '%' : 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>
          {selected.spotify_url && (
            <a href={selected.spotify_url} target="_blank" rel="noreferrer"
              className="px-3 py-1.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 rounded-lg text-[#1DB954] text-xs font-medium transition-all">
              Open ↗
            </a>
          )}
          <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white transition-colors text-xl">×</button>
        </div>
      )}
    </div>
  )
}
