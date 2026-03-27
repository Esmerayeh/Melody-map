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
  const [selectedClusterId, setSelectedClusterId] = useState(null)
  const [selectedRegionId, setSelectedRegionId] = useState(null)
  const [hoveredNodeId, setHoveredNodeId] = useState(null)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [constellationMode, setConstellationMode] = useState(false)
  const [constellationOrigin, setConstellationOrigin] = useState(null)
  const [viewMode, setViewMode] = useState('identity')
  const [showTracks, setShowTracks] = useState(true)
  const [showMoodRegions, setShowMoodRegions] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusTarget, setFocusTarget] = useState(null)

  const hoveredNode = useMemo(
    () => (model?.nodes || []).find((node) => node.id === hoveredNodeId) || null,
    [model, hoveredNodeId],
  )
  const hoveredCluster = useMemo(
    () => model?.clusters?.find((cluster) => cluster.id === hoveredNode?.clusterId) || null,
    [model, hoveredNode],
  )
  const selectedCluster = useMemo(
    () => model?.clusters?.find((cluster) => cluster.id === selectedClusterId) || null,
    [model, selectedClusterId],
  )
  const selectedRegion = useMemo(
    () => model?.regions?.find((region) => region.id === selectedRegionId) || null,
    [model, selectedRegionId],
  )

  const resolveFocusPosition = useCallback((ids = []) => {
    if (!model) return null
    const targets = ids
      .map((id) => model.nodes.find((node) => node.id === id))
      .filter(Boolean)

    if (!targets.length) return null

    const total = targets.reduce(
      (accumulator, node) => ({
        x: accumulator.x + (node.position?.x || 0),
        y: accumulator.y + (node.position?.y || 0),
        z: accumulator.z + (node.position?.z || 0),
      }),
      { x: 0, y: 0, z: 0 },
    )

    return {
      x: total.x / targets.length,
      y: total.y / targets.length,
      z: total.z / targets.length,
    }
  }, [model])

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

  useEffect(() => {
    if (!model) return
    if (selectedClusterId && !model.clusters?.some((cluster) => cluster.id === selectedClusterId)) {
      setSelectedClusterId(null)
    }
    if (selectedRegionId && !model.regions?.some((region) => region.id === selectedRegionId)) {
      setSelectedRegionId(null)
    }
  }, [model, selectedClusterId, selectedRegionId])

  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node)
    setSelectedClusterId(node?.clusterId || null)
    setSelectedRegionId(null)
    setFocusTarget(node?.position || null)
    if (constellationMode) setConstellationOrigin(node?.id || null)
  }, [constellationMode])

  const handleSelectCluster = useCallback((clusterId) => {
    if (!model) return
    const cluster = model.clusters?.find((entry) => entry.id === clusterId) || null
    if (!cluster) return

    setSelectedClusterId(cluster.id)
    setSelectedRegionId(null)
    setSelectedNode(null)
    setHoveredEdge(null)
    setFocusTarget(cluster.centroid || resolveFocusPosition(cluster.members || []))
  }, [model, resolveFocusPosition])

  const handleFocusPreset = useCallback((presetKey) => {
    const ids = model?.metadata?.focusPresets?.[presetKey] || []
    const target = resolveFocusPosition(ids)
    if (!target) return

    setFocusTarget(target)
    setSelectedRegionId(null)
    setHoveredEdge(null)

    if (ids.length === 1) {
      const node = model?.nodes?.find((entry) => entry.id === ids[0]) || null
      setSelectedNode(node)
      setSelectedClusterId(node?.clusterId || null)
    } else {
      setSelectedNode(null)
      setSelectedClusterId(null)
    }
  }, [model, resolveFocusPosition])

  useEffect(() => {
    if (!model || !searchQuery.trim()) return
    const query = searchQuery.trim().toLowerCase()

    const nodeMatch = model.nodes.find((node) => node.label?.toLowerCase().includes(query))
    if (nodeMatch) {
      setSelectedNode(nodeMatch)
      setSelectedClusterId(nodeMatch.clusterId || null)
      setSelectedRegionId(null)
      setFocusTarget(nodeMatch.position || null)
      return
    }

    const clusterMatch = model.clusters?.find((cluster) => cluster.label?.toLowerCase().includes(query))
    if (clusterMatch) {
      handleSelectCluster(clusterMatch.id)
      return
    }

    const regionMatch = model.regions?.find((region) => region.label?.toLowerCase().includes(query))
    if (regionMatch) {
      setSelectedNode(null)
      setSelectedClusterId(null)
      setSelectedRegionId(regionMatch.id)
      setHoveredEdge(null)
      setFocusTarget(regionMatch.centroid || null)
    }
  }, [handleSelectCluster, model, searchQuery])

  const activeViewMode = constellationMode ? 'constellation' : viewMode

  const subtitle = useMemo(() => {
    if (loading) return 'Loading your galaxy...'
    if (isDemo) return 'Demo galaxy - connect a music source to see your own'
    if (!model) return 'No galaxy data available yet'

    const density = model.metadata?.density
    return `${density?.artistStars || model.nodes.length} artist stars • ${density?.trackSatellites || 0} satellites • ${model.clusters?.length || 0} neighborhoods • ${model.metadata?.layoutVersion || 'canonical model'}`
  }, [loading, isDemo, model])

  const trustBanner = useMemo(() => {
    if (!model) return null
    if (isDemo) return 'Demo galaxy - not based on your live Spotify profile yet.'
    if (model.metadata?.source !== 'profile') return 'Legacy galaxy data - canonical profile graph is not fully available yet.'
    if ((model.metadata?.confidence?.galaxy?.score || 0) < 0.5) return 'Galaxy is rendered from partial profile data. Neighborhoods may be less reliable.'
    return null
  }, [isDemo, model])

  const detailBanner = useMemo(() => {
    if (!model || isDemo) return null
    const density = model.metadata?.density
    if (!density) return null
    return `${density.anchors} anchors • ${density.artistStars} artist stars • ${density.trackSatellites} satellites • ${density.regions} nebulae`
  }, [isDemo, model])

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
        viewMode={activeViewMode}
        showTracks={showTracks}
        showMoodRegions={showMoodRegions}
        focusTarget={focusTarget}
      />
      {constellationMode && !constellationOrigin && !loading && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 text-xs text-purple-300">
          Click a node to reveal its local constellation
        </div>
      )}
      <ClusterOverlay cluster={hoveredCluster} />
      <GalaxyLegend
        clusters={model?.clusters || []}
        regions={model?.regions || []}
        density={model?.metadata?.density}
        onSelectCluster={handleSelectCluster}
      />
    </div>
  )

  const controlProps = {
    isDemo,
    loading,
    cinemaMode,
    onRefresh: loadData,
    viewMode: activeViewMode,
    onChangeViewMode: (mode) => {
      setViewMode(mode)
      setConstellationMode(mode === 'constellation')
      if (mode !== 'constellation') setConstellationOrigin(null)
    },
    showTracks,
    onToggleTracks: () => setShowTracks((value) => !value),
    showMoodRegions,
    onToggleMoodRegions: () => setShowMoodRegions((value) => !value),
    onFocusPreset: handleFocusPreset,
    searchQuery,
    onSearchChange: setSearchQuery,
  }

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
            {...controlProps}
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
          {...controlProps}
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
        {trustBanner && !loading && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
            {trustBanner}
          </div>
        )}
        {detailBanner && !loading && !trustBanner && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] text-gray-300 backdrop-blur">
            {detailBanner}
          </div>
        )}
      </div>

      <GalaxyInspector
        node={selectedNode}
        edge={selectedNode || selectedCluster || selectedRegion ? null : hoveredEdge}
        cluster={selectedNode ? null : selectedCluster}
        region={selectedNode || selectedCluster ? null : selectedRegion}
      />
    </div>
  )
}
