import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { mapAPI } from '../services/api'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import useExperienceStore from '../store/useExperienceStore'
import { buildGalaxyModeModel, buildGalaxyModel, buildLegacyGalaxyModel } from '../features/galaxy/galaxyBuilder'
import GalaxyControls from '../features/galaxy/GalaxyControls'
import GalaxyInspector from '../features/galaxy/GalaxyInspector'
import GalaxyLegend from '../features/galaxy/GalaxyLegend'
import GalaxyScene from '../features/galaxy/GalaxyScene'
import SoulResonancePanel from '../components/SoulResonancePanel'
import ProfileBootPanel from '../components/ProfileBootPanel'
import { useRouteReadiness } from '../hooks/useRouteReadiness'
import { mapGalaxySelectionToResonance } from '../features/orb/resonanceEngine'
import useGalaxyInteractionStore from '../features/galaxy/useGalaxyInteractionStore'
import { resolveInteractionEntity, slugifyInteraction } from '../features/galaxy/interactionModel.js'
import { BrandBackdrop, BrandConstellation, BrandMark, BrandWatermark } from '../components/brand/BrandSystem'

const DEMO_NODES = [
  { _id: 'demo-1', title: 'Only Shallow', artist: 'My Bloody Valentine', genres: ['shoegaze'], popularity: 80, sonic_color: 'hsl(198, 85%, 44%)', map_coords_3d: { x: -2, y: 4, z: -1 } },
  { _id: 'demo-2', title: 'Cherry-Coloured Funk', artist: 'Cocteau Twins', genres: ['dream pop'], popularity: 68, sonic_color: 'hsl(234, 79%, 49%)', map_coords_3d: { x: 3, y: 2, z: 1 } },
  { _id: 'demo-3', title: 'Fade Into You', artist: 'Mazzy Star', genres: ['dream pop', 'folk'], popularity: 85, sonic_color: 'hsl(117, 62%, 43%)', map_coords_3d: { x: -1, y: -3, z: -2 } },
  { _id: 'demo-4', title: 'Karma Police', artist: 'Radiohead', genres: ['alternative rock'], popularity: 92, sonic_color: 'hsl(91, 62%, 42%)', map_coords_3d: { x: -4, y: 1, z: -2 } },
]

function ClusterOverlay({ cluster, region }) {
  const item = cluster || region
  if (!item) return null

  return (
    <div className="absolute right-5 top-5 max-w-xs rounded-[20px] border border-white/10 bg-[#090c1f]/70 px-4 py-3 text-xs text-gray-300 shadow-[0_18px_60px_rgba(10,8,30,0.48)] backdrop-blur-xl">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]" style={{ background: item.color, color: item.color }} />
        <span className="font-semibold text-white">{item.title || item.label}</span>
      </div>
      <p className="leading-relaxed text-gray-300">{item.explanation}</p>
    </div>
  )
}

export default function MusicMap() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile: profileSnapshot, loading: profileLoading, phase, readiness, tier } = useMusicProfile({ autoFetch: false })
  const musicProfile = profileSnapshot || useStore((state) => state.musicProfile)
  const cinemaMode = useStore((state) => state.cinemaMode)
  const setCinemaMode = useStore((state) => state.setCinemaMode)

  const boot = useRouteReadiness({
    phase,
    profile: musicProfile,
    readiness,
    tier,
    require: { profile: true, galaxy: true },
    copy: {
      loading: {
        title: 'The galaxy is assembling.',
        subtitle: 'We are plotting your core stars before the map ignites.',
        detail: 'Hold steady.',
      },
      error: {
        title: 'The galaxy could not render.',
        subtitle: 'The listening data is not reachable right now.',
        detail: 'Refresh once and the map should return.',
      },
      empty: {
        title: 'No listening signal yet.',
        subtitle: 'Connect a music source to reveal your galaxy.',
        detail: 'The map will appear once the signal arrives.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'We are rendering a lighter galaxy until the profile deepens.',
        detail: 'This is intentional, not an error.',
      },
    },
  })

  if (boot.blocked) {
    return (
      <ProfileBootPanel
        variant={boot.variant}
        title={boot.title}
        subtitle={boot.subtitle}
        detail={boot.detail}
        actionLabel={boot.variant === 'error' ? 'Reload the galaxy' : undefined}
        onAction={boot.variant === 'error' ? () => window.location.reload() : undefined}
      />
    )
  }

  const galaxyMode = useGalaxyInteractionStore((state) => state.galaxyMode)
  const viewMode = useGalaxyInteractionStore((state) => state.viewMode)
  const constellationMode = useGalaxyInteractionStore((state) => state.constellationMode)
  const constellationOrigin = useGalaxyInteractionStore((state) => state.constellationOrigin)
  const showTracks = useGalaxyInteractionStore((state) => state.showTracks)
  const showMoodRegions = useGalaxyInteractionStore((state) => state.showMoodRegions)
  const searchQuery = useGalaxyInteractionStore((state) => state.searchQuery)
  const focusTarget = useGalaxyInteractionStore((state) => state.focusTarget)
  const hoveredObject = useGalaxyInteractionStore((state) => state.hoveredObject)
  const focusedObject = useGalaxyInteractionStore((state) => state.focusedObject)
  const setGalaxyMode = useGalaxyInteractionStore((state) => state.setGalaxyMode)
  const setViewMode = useGalaxyInteractionStore((state) => state.setViewMode)
  const toggleTracks = useGalaxyInteractionStore((state) => state.toggleTracks)
  const toggleMoodRegions = useGalaxyInteractionStore((state) => state.toggleMoodRegions)
  const setSearchQuery = useGalaxyInteractionStore((state) => state.setSearchQuery)
  const setFocusTarget = useGalaxyInteractionStore((state) => state.setFocusTarget)
  const setFocusedObject = useGalaxyInteractionStore((state) => state.setFocusedObject)
  const clearFocusedObject = useGalaxyInteractionStore((state) => state.clearFocusedObject)
  const setConstellationOrigin = useGalaxyInteractionStore((state) => state.setConstellationOrigin)
  const setNodeData = useGalaxyInteractionStore((state) => state.setNodeData)
  const setLayoutData = useGalaxyInteractionStore((state) => state.setLayoutData)
  const setMotionState = useGalaxyInteractionStore((state) => state.setMotionState)
  const resetGalaxyInteraction = useGalaxyInteractionStore((state) => state.resetGalaxyInteraction)
  const setExperienceHoveredObject = useExperienceStore((state) => state.setHoveredObject)
  const setExperienceSelectedObject = useExperienceStore((state) => state.setSelectedObject)

  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [lowPower, setLowPower] = useState(false)

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
      if (profileLoading && !musicProfile) {
        setModel(null)
        return
      }
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
  }, [musicProfile, profileLoading])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return () => {
      resetGalaxyInteraction()
    }
  }, [resetGalaxyInteraction])

  useEffect(() => {
    setExperienceHoveredObject(hoveredObject)
  }, [hoveredObject, setExperienceHoveredObject])

  useEffect(() => {
    setExperienceSelectedObject(focusedObject)
  }, [focusedObject, setExperienceSelectedObject])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setIsCoarsePointer(media.matches)
    update()
    if (media.addEventListener) {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }
    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => {
      const deviceMemory = Number(navigator?.deviceMemory || 8)
      const cores = Number(navigator?.hardwareConcurrency || 8)
      const shouldReduce = tier === 'sparse'
        || tier === 'limited'
        || isCoarsePointer
        || deviceMemory <= 4
        || cores <= 4
        || Boolean(reduceMotion?.matches)
      setLowPower(shouldReduce)
    }
    update()
    if (reduceMotion?.addEventListener) {
      reduceMotion.addEventListener('change', update)
      return () => reduceMotion.removeEventListener('change', update)
    }
    if (reduceMotion?.addListener) {
      reduceMotion.addListener(update)
      return () => reduceMotion.removeListener(update)
    }
    return undefined
  }, [isCoarsePointer, tier])

  const activeModel = useMemo(
    () => buildGalaxyModeModel(model, galaxyMode),
    [galaxyMode, model],
  )

  useEffect(() => {
    if (!activeModel) return
    setNodeData(activeModel.nodes || [])
    setLayoutData({
      regions: activeModel.regions || [],
      clusters: activeModel.clusters || [],
      density: activeModel.metadata?.modeDensity || activeModel.metadata?.density || null,
      core: activeModel.metadata?.core || null,
      galaxyMode,
    })
  }, [activeModel, galaxyMode, setLayoutData, setNodeData])

  useEffect(() => {
    if (galaxyMode === 'song') {
      setMotionState({
        driftStrength: 0.24,
        oscillationStrength: 0.4,
        shimmerStrength: 0.28,
      })
      return
    }

    if (galaxyMode === 'artist') {
      setMotionState({
        driftStrength: 0.16,
        oscillationStrength: 0.24,
        shimmerStrength: 0.18,
      })
      return
    }

    if (galaxyMode === 'genre') {
      setMotionState({
        driftStrength: 0.2,
        oscillationStrength: 0.22,
        shimmerStrength: 0.16,
      })
      return
    }

    setMotionState({
      driftStrength: 0.18,
      oscillationStrength: 0.28,
      shimmerStrength: 0.2,
    })
  }, [galaxyMode, setMotionState])

  const focusedEntity = useMemo(
    () => resolveInteractionEntity(activeModel, musicProfile, focusedObject),
    [activeModel, focusedObject, musicProfile],
  )
  const hoveredEntity = useMemo(
    () => resolveInteractionEntity(activeModel, musicProfile, hoveredObject),
    [activeModel, hoveredObject, musicProfile],
  )

  useEffect(() => {
    if (!activeModel || !focusedObject?.id) return
    const resolved = resolveInteractionEntity(activeModel, musicProfile, focusedObject)
    const stillValid = resolved.node || resolved.cluster || resolved.region || resolved.edge
    if (!stillValid) clearFocusedObject()
  }, [activeModel, clearFocusedObject, focusedObject, musicProfile])

  const handleSelectCluster = useCallback((clusterId) => {
    if (!activeModel) return
    const cluster = activeModel.clusters?.find((entry) => entry.id === clusterId) || null
    if (!cluster) return

    setFocusedObject({
      id: cluster.id,
      type: 'cluster',
      label: cluster.label,
      regionId: cluster.regionLabel ? `region:${slugifyInteraction(cluster.regionLabel)}` : null,
    })
    setFocusTarget(cluster.centroid || resolveFocusPosition(cluster.members || []))
  }, [activeModel, resolveFocusPosition, setFocusTarget, setFocusedObject])

  const handleSelectRegion = useCallback((regionId) => {
    if (!activeModel) return
    const region = activeModel.regions?.find((entry) => entry.id === regionId) || null
    if (!region) return
    setFocusedObject({ id: region.id, type: 'region', label: region.title || region.label })
    setFocusTarget(region.centroid || null)
  }, [activeModel, setFocusTarget, setFocusedObject])

  const handleFocusPreset = useCallback((presetKey) => {
    const ids = activeModel?.metadata?.focusPresets?.[presetKey] || []
    const target = resolveFocusPosition(ids)
    if (!target) return

    setFocusTarget(target)

    if (ids.length === 1) {
      const node = activeModel?.nodes?.find((entry) => entry.id === ids[0]) || null
      if (node) {
        setFocusedObject({
          id: node.type === 'cluster' ? node.clusterId : node.id,
          type: node.type === 'cluster' ? 'cluster' : node.type,
          label: node.label,
          clusterId: node.clusterId || null,
          regionId: node.regionLabel ? `region:${slugifyInteraction(node.regionLabel)}` : null,
        })
        return
      }
    }

    clearFocusedObject()
  }, [activeModel, clearFocusedObject, resolveFocusPosition, setFocusTarget, setFocusedObject])

  useEffect(() => {
    if (!activeModel || !searchQuery.trim()) return
    const query = searchQuery.trim().toLowerCase()

    if (query === 'core' || query === 'taste core') {
      setFocusedObject({ id: 'taste-core', type: 'core', label: 'Taste Core' })
      setFocusTarget(activeModel.metadata?.core?.position || null)
      return
    }

    const nodeMatch = activeModel.nodes.find((node) => node.label?.toLowerCase().includes(query))
    if (nodeMatch) {
      setFocusedObject({
        id: nodeMatch.type === 'cluster' ? nodeMatch.clusterId : nodeMatch.id,
        type: nodeMatch.type === 'cluster' ? 'cluster' : nodeMatch.type,
        label: nodeMatch.label,
        clusterId: nodeMatch.clusterId || null,
        regionId: nodeMatch.regionLabel ? `region:${slugifyInteraction(nodeMatch.regionLabel)}` : null,
      })
      setFocusTarget(nodeMatch.position || null)
      return
    }

    const clusterMatch = activeModel.clusters?.find((cluster) => cluster.label?.toLowerCase().includes(query))
    if (clusterMatch) {
      handleSelectCluster(clusterMatch.id)
      return
    }

    const regionMatch = activeModel.regions?.find((region) => (region.title || region.label)?.toLowerCase().includes(query))
    if (regionMatch) {
      handleSelectRegion(regionMatch.id)
    }
  }, [activeModel, handleSelectCluster, handleSelectRegion, searchQuery, setFocusTarget, setFocusedObject])

  useEffect(() => {
    const requestedMode = searchParams.get('mode')
    if (requestedMode && ['universal', 'genre', 'artist', 'song'].includes(requestedMode) && requestedMode !== galaxyMode) {
      setGalaxyMode(requestedMode)
    }

    const requestedQuery = searchParams.get('q')
    if (requestedQuery && requestedQuery !== searchQuery) {
      setSearchQuery(requestedQuery)
    }
  }, [galaxyMode, searchParams, searchQuery, setGalaxyMode, setSearchQuery])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false

    if (next.get('mode') !== galaxyMode) {
      next.set('mode', galaxyMode)
      changed = true
    }

    if (searchQuery.trim()) {
      if (next.get('q') !== searchQuery.trim()) {
        next.set('q', searchQuery.trim())
        changed = true
      }
    } else if (next.has('q')) {
      next.delete('q')
      changed = true
    }

    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [galaxyMode, searchParams, searchQuery, setSearchParams])

  const activeViewMode = constellationMode ? 'constellation' : viewMode
  const focusedNodeForResonance = focusedEntity.node
  const hoveredNodeForResonance = hoveredEntity.node

  const selectedResonance = useMemo(() => mapGalaxySelectionToResonance({
    node: focusedNodeForResonance,
    cluster: focusedEntity.cluster,
    region: focusedEntity.region,
    edge: focusedEntity.edge,
    model: activeModel,
    mode: 'focused',
  }), [activeModel, focusedEntity.cluster, focusedEntity.edge, focusedEntity.region, focusedNodeForResonance])

  const liveResonance = useMemo(() => {
    if (selectedResonance) return selectedResonance
    return mapGalaxySelectionToResonance({
      node: hoveredNodeForResonance,
      cluster: hoveredEntity.cluster,
      region: hoveredEntity.region,
      edge: hoveredEntity.edge,
      model: activeModel,
      mode: 'live',
    })
  }, [activeModel, hoveredEntity.cluster, hoveredEntity.edge, hoveredEntity.region, hoveredNodeForResonance, selectedResonance])

  const resonanceHint = useMemo(() => {
    if (selectedResonance?.label) {
      return `The Soul Orb is holding ${selectedResonance.label.toLowerCase()} close.`
    }
    if (liveResonance?.label) {
      return `The Soul Orb is listening to ${liveResonance.label.toLowerCase()} in real time.`
    }
    return 'The Soul Orb is resting in your wider listening weather.'
  }, [liveResonance, selectedResonance])

  const subtitle = useMemo(() => {
    if (loading) return 'tuning into your signal...'
    if (isDemo) return 'a borrowed sky for now -- connect a music source to see your own'
    if (!activeModel) return 'the sky is still quiet'

    const density = activeModel.metadata?.modeDensity || activeModel.metadata?.density
    return `${galaxyMode} mode - ${density?.nodes || activeModel.nodes.length} visible bodies - ${density?.edges || activeModel.edges?.length || 0} links - ${activeModel.metadata?.profileTier || 'canonical'} profile`
  }, [activeModel, galaxyMode, isDemo, loading])

  const trustBanner = useMemo(() => {
    if (!activeModel) return null
    if (isDemo) return 'this is only a borrowed sky -- your own map arrives once your listening is connected.'
    if (activeModel.metadata?.source !== 'profile') return 'the full constellation has not settled yet, so some structures are still running on older signal.'
    if (activeModel.metadata?.profileTier === 'partial') return 'this galaxy is still forming. regions and bridges stay sparse on purpose.'
    if ((activeModel.metadata?.confidence?.galaxy?.score || 0) < 0.5) return 'the pattern is real, but still faint in places.'
    return null
  }, [activeModel, isDemo])

  const detailBanner = useMemo(() => {
    if (!activeModel || isDemo) return null
    const density = activeModel.metadata?.modeDensity || activeModel.metadata?.density
    if (!density) return null
    return `${density.anchors || density.clusters || 0} anchors - ${density.artistStars || density.nodes || 0} visible bodies - ${density.trackSatellites || 0} satellites - ${density.regions || 0} nebulae`
  }, [activeModel, isDemo])

  const controlProps = {
    isDemo,
    loading,
    cinemaMode,
    onRefresh: loadData,
    galaxyMode,
    onChangeGalaxyMode: setGalaxyMode,
    viewMode: activeViewMode,
    onChangeViewMode: setViewMode,
    showTracks,
    onToggleTracks: toggleTracks,
    showMoodRegions,
    onToggleMoodRegions: toggleMoodRegions,
    onFocusPreset: handleFocusPreset,
    searchQuery,
    onSearchChange: setSearchQuery,
  }

  const hoveredCluster = hoveredEntity.cluster || (hoveredEntity.node?.clusterId ? activeModel?.clusters?.find((cluster) => cluster.id === hoveredEntity.node.clusterId) : null)
  const hoveredRegion = hoveredEntity.region || (hoveredEntity.node?.regionLabel ? activeModel?.regions?.find((region) => region.label === hoveredEntity.node.regionLabel) : null)

  const sparseMode = boot?.mode === 'sparse' || tier === 'sparse' || Boolean(musicProfile && !readiness?.galaxy)
  const showBootPanel = loading && !activeModel && !cinemaMode

  const scene = (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(120,255,206,0.14),transparent_18%),radial-gradient(circle_at_18%_24%,rgba(194,120,255,0.18),transparent_28%),radial-gradient(circle_at_79%_24%,rgba(255,184,120,0.16),transparent_25%),radial-gradient(circle_at_72%_76%,rgba(255,193,120,0.12),transparent_24%),radial-gradient(circle_at_54%_82%,rgba(132,153,255,0.14),transparent_24%),linear-gradient(180deg,#050713_0%,#050610_48%,#03040b_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.02)_0%,transparent_18%,transparent_82%,rgba(255,255,255,0.02)_100%)] opacity-70" />
      {lowPower && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(143,117,255,0.08),transparent_40%),radial-gradient(circle_at_30%_70%,rgba(242,141,223,0.06),transparent_45%)]" />
      )}
      <GalaxyScene model={activeModel} sparseMode={sparseMode} quality={{ lowPower }} />
      {isCoarsePointer && !loading && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[#090d1f]/72 px-4 py-2 text-[11px] text-gray-200 shadow-[0_18px_40px_rgba(3,4,15,0.35)] backdrop-blur-xl">
          Touch a star, nebula, bridge, or the core to see what it reveals. Touch it again to let it go.
        </div>
      )}
      {constellationMode && !constellationOrigin && !loading && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-purple-500/30 bg-purple-500/18 px-3 py-1.5 text-xs text-purple-200 backdrop-blur">
          Touch a voice in the field to let its nearby constellation appear
        </div>
      )}
      <ClusterOverlay cluster={hoveredCluster} region={!hoveredCluster ? hoveredRegion : null} />
      <GalaxyLegend
        clusters={activeModel?.clusters || []}
        regions={activeModel?.regions || []}
        density={activeModel?.metadata?.modeDensity || activeModel?.metadata?.density}
        profileTier={activeModel?.metadata?.profileTier}
        onSelectCluster={handleSelectCluster}
        onSelectRegion={handleSelectRegion}
      />
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
            {...controlProps}
            onToggleCinema={() => setCinemaMode(false)}
          />
        </div>
      </div>
    )
  }

  if (showBootPanel) {
    return (
      <ProfileBootPanel
        variant="loading"
        title="The galaxy is still tuning in."
        subtitle="We are gathering the first wave of listening signals before the map can breathe."
        detail="This will settle in a few moments."
      />
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <BrandMark size={58} />
          <div>
            <p className="page-header-kicker mb-2">Home observatory</p>
            <h1 className="text-2xl font-bold text-gradient">Galaxy</h1>
            <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>
          </div>
        </div>
        <GalaxyControls
          {...controlProps}
          onToggleCinema={() => setCinemaMode(true)}
        />
      </div>

      <div className="brand-panel living-grid relative overflow-hidden shadow-[0_30px_120px_rgba(2,4,12,0.6)]" style={{ height: 680 }}>
        <BrandBackdrop opacity={0.3} />
        <BrandConstellation className="opacity-70" />
        <BrandWatermark className="absolute left-1/2 top-1/2 w-[34rem] -translate-x-1/2 -translate-y-1/2" opacity={0.06} rotate={0} />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-400">tuning into your signal...</p>
            </div>
          </div>
        ) : (
          <motion.div
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {scene}
          </motion.div>
        )}
        {trustBanner && !loading && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 backdrop-blur">
            {trustBanner}
          </div>
        )}
        {detailBanner && !loading && !trustBanner && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] text-gray-200 backdrop-blur">
            {detailBanner}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <SoulResonancePanel profile={musicProfile} model={activeModel} lowPower={lowPower} />

        <div>
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
            {resonanceHint}
          </div>
          <GalaxyInspector
            node={focusedEntity.node}
            edge={focusedEntity.edge}
            cluster={focusedEntity.cluster}
            region={focusedEntity.region}
          />
        </div>
      </div>
    </div>
  )
}
