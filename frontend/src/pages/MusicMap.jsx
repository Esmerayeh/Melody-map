import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { mapAPI } from '../services/api'
import useStore from '../store/useStore'
import { buildGalaxyModel, buildLegacyGalaxyModel } from '../features/galaxy/galaxyBuilder'
import GalaxyControls from '../features/galaxy/GalaxyControls'
import GalaxyInspector from '../features/galaxy/GalaxyInspector'
import GalaxyLegend from '../features/galaxy/GalaxyLegend'
import GalaxyScene from '../features/galaxy/GalaxyScene'

const DEMO_NODES = [
  { _id: 'demo-1', title: 'Only Shallow', artist: 'My Bloody Valentine', genres: ['shoegaze'], popularity: 80, sonic_color: 'hsl(198, 85%, 44%)', map_coords_3d: { x: -2, y: 4, z: -1 } },
  { _id: 'demo-2', title: 'Cherry-Coloured Funk', artist: 'Cocteau Twins', genres: ['dream pop'], popularity: 68, sonic_color: 'hsl(234, 79%, 49%)', map_coords_3d: { x: 3, y: 2, z: 1 } },
  { _id: 'demo-3', title: 'Fade Into You', artist: 'Mazzy Star', genres: ['dream pop', 'folk'], popularity: 85, sonic_color: 'hsl(117, 62%, 43%)', map_coords_3d: { x: -1, y: -3, z: -2 } },
  { _id: 'demo-4', title: 'Karma Police', artist: 'Radiohead', genres: ['alternative rock'], popularity: 92, sonic_color: 'hsl(91, 62%, 42%)', map_coords_3d: { x: -4, y: 1, z: -2 } },
]

function ClusterOverlay({ cluster }) {
  if (!cluster) return null

  return (
    <div className="absolute right-4 top-4 max-w-xs rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-xs text-gray-300 backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: cluster.color }} />
        <span className="font-semibold text-white">{cluster.label}</span>
      </div>
      <p>{cluster.explanation}</p>
    </div>
  )
}

export default function MusicMap() {
  const musicProfile = useStore((state) => state.musicProfile)
  const cinemaMode = useStore((state) => state.cinemaMode)
  const setCinemaMode = useStore((state) => state.setCinemaMode)

  const [model, setModel] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNodeId, setHoveredNodeId] = useState(null)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [constellationMode, setConstellationMode] = useState(false)
  const [constellationOrigin, setConstellationOrigin] = useState(null)

  const hoveredNode = useMemo(
    () => (model?.nodes || []).find((node) => node.id === hoveredNodeId) || null,
    [model, hoveredNodeId],
  )
  const hoveredCluster = useMemo(
    () => model?.clusters?.find((cluster) => cluster.id === hoveredNode?.clusterId) || null,
    [model, hoveredNode],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (musicProfile?.topArtists?.length || musicProfile?.genres?.length) {
        setModel(buildGalaxyModel(musicProfile))
        setIsDemo(false)
        return
      }

      if (musicProfile?.galaxyNodes?.length) {
        setModel(buildLegacyGalaxyModel(musicProfile.galaxyNodes, 'profile-galaxyNodes'))
        setIsDemo(false)
        return
      }

      const { data } = await mapAPI.getData()
      const legacyNodes = data?.length ? data : DEMO_NODES
      setModel(buildLegacyGalaxyModel(legacyNodes, data?.length ? 'map-api' : 'demo'))
      setIsDemo(!data?.length)
    } catch {
      setModel(buildLegacyGalaxyModel(DEMO_NODES, 'demo'))
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [musicProfile])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!model || !selectedNode) return
    const nextSelected = model.nodes.find((node) => node.id === selectedNode.id) || null
    setSelectedNode(nextSelected)
  }, [model, selectedNode])

  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node)
    if (constellationMode) setConstellationOrigin(node?.id || null)
  }, [constellationMode])

  const subtitle = useMemo(() => {
    if (loading) return 'Loading your galaxy...'
    if (isDemo) return 'Demo galaxy - connect a music source to see your own'
    if (!model) return 'No galaxy data available yet'
    return `${model.nodes.length} nodes • ${model.edges.length} edges • ${model.metadata?.layoutVersion || 'canonical model'}`
  }, [loading, isDemo, model])

  const scene = (
    <div className="relative h-full w-full">
      <GalaxyScene
        model={model}
        selectedNode={selectedNode}
        hoveredNodeId={hoveredNodeId}
        onSelectNode={handleSelectNode}
        onHoverNode={setHoveredNodeId}
        hoveredEdge={hoveredEdge}
        onHoverEdge={setHoveredEdge}
        constellationOrigin={constellationMode ? constellationOrigin : null}
      />
      {constellationMode && !constellationOrigin && !loading && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 text-xs text-purple-300">
          Click a node to reveal its local constellation
        </div>
      )}
      <ClusterOverlay cluster={hoveredCluster} />
      <GalaxyLegend clusters={model?.clusters || []} />
    </div>
  )

  if (cinemaMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : scene}
        <div className="absolute right-4 top-4 z-10">
          <GalaxyControls
            isDemo={isDemo}
            loading={loading}
            constellationMode={constellationMode}
            onRefresh={loadData}
            onToggleConstellation={() => {
              setConstellationMode((value) => !value)
              if (constellationMode) setConstellationOrigin(null)
            }}
            cinemaMode={cinemaMode}
            onToggleCinema={() => setCinemaMode(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Music Galaxy</h1>
          <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>
        </div>
        <GalaxyControls
          isDemo={isDemo}
          loading={loading}
          constellationMode={constellationMode}
          onRefresh={loadData}
          onToggleConstellation={() => {
            setConstellationMode((value) => !value)
            if (constellationMode) setConstellationOrigin(null)
          }}
          cinemaMode={cinemaMode}
          onToggleCinema={() => setCinemaMode(true)}
        />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#050810]" style={{ height: 580 }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-400">Loading music galaxy...</p>
            </div>
          </div>
        ) : (
          <motion.div
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {scene}
          </motion.div>
        )}
      </div>

      <GalaxyInspector node={selectedNode} edge={selectedNode ? null : hoveredEdge} />
    </div>
  )
}
