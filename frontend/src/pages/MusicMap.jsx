import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { mapAPI } from '../services/api'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import useLiveTasteSignal from '../hooks/useLiveTasteSignal'
import useExperienceStore from '../store/useExperienceStore'
import { buildGalaxyModeModel, buildGalaxyModel, buildLegacyGalaxyModel } from '../features/galaxy/galaxyBuilder'
import useGalaxyArtifact from '../features/galaxy/useGalaxyArtifact'
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
import AtmosphereBackground from '../components/premium/AtmosphereBackground'
import AuraCard from '../components/premium/AuraCard'
import HaloButton from '../components/premium/HaloButton'
import ShimmerDivider from '../components/premium/ShimmerDivider'
import NebulaLoader from '../components/premium/NebulaLoader'
import useAdaptiveExperience from '../hooks/useAdaptiveExperience'

const DEMO_NODES = [
  { _id: 'demo-1', title: 'Only Shallow', artist: 'My Bloody Valentine', genres: ['shoegaze'], popularity: 80, sonic_color: 'hsl(253, 88%, 72%)', map_coords_3d: { x: -2, y: 4, z: -1 } },
  { _id: 'demo-2', title: 'Cherry-Coloured Funk', artist: 'Cocteau Twins', genres: ['dream pop'], popularity: 68, sonic_color: 'hsl(272, 72%, 74%)', map_coords_3d: { x: 3, y: 2, z: 1 } },
  { _id: 'demo-3', title: 'Fade Into You', artist: 'Mazzy Star', genres: ['dream pop', 'folk'], popularity: 85, sonic_color: 'hsl(220, 70%, 78%)', map_coords_3d: { x: -1, y: -3, z: -2 } },
  { _id: 'demo-4', title: 'Karma Police', artist: 'Radiohead', genres: ['alternative rock'], popularity: 92, sonic_color: 'hsl(318, 52%, 70%)', map_coords_3d: { x: -4, y: 1, z: -2 } },
]

function ClusterOverlay({ cluster, region }) {
  const item = cluster || region
  if (!item) return null

  return (
    <div className="absolute right-5 top-5 max-w-xs rounded-[24px] border border-white/10 bg-[#090c1f]/74 px-4 py-3 text-xs text-gray-300 shadow-[0_18px_60px_rgba(10,8,30,0.48)] backdrop-blur-xl">
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
  const { artifact: generatedGalaxy, loading: galaxyLoading, error: galaxyError, jobStatus, artifactMeta } = useGalaxyArtifact(musicProfile)
  const cinemaMode = useStore((state) => state.cinemaMode)
  const setCinemaMode = useStore((state) => state.setCinemaMode)
  const { signal: liveSignal, hasLiveSignal } = useLiveTasteSignal({ enabled: Boolean(musicProfile), pollMs: 12000 })
  const adaptive = useAdaptiveExperience()

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

  const resolveFocusPosition = useCallback((ids = []) => {
    if (!model) return null
    const targets = ids.map((id) => model.nodes.find((node) => node.id === id)).filter(Boolean)
    if (!targets.length) return null

    const total = targets.reduce((accumulator, node) => ({
      x: accumulator.x + (node.position?.x || 0),
      y: accumulator.y + (node.position?.y || 0),
      z: accumulator.z + (node.position?.z || 0),
    }), { x: 0, y: 0, z: 0 })

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

      if (generatedGalaxy) {
        setModel(generatedGalaxy)
        setIsDemo(false)
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
  }, [generatedGalaxy, musicProfile, profileLoading])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => () => resetGalaxyInteraction(), [resetGalaxyInteraction])
  useEffect(() => { setExperienceHoveredObject(hoveredObject) }, [hoveredObject, setExperienceHoveredObject])
  useEffect(() => { setExperienceSelectedObject(focusedObject) }, [focusedObject, setExperienceSelectedObject])

  useEffect(() => {
    setIsCoarsePointer(adaptive.isCoarsePointer)
  }, [adaptive.isCoarsePointer])

  const activeModel = useMemo(() => buildGalaxyModeModel(model, galaxyMode), [galaxyMode, model])

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
    const sessionIntensity = Math.max(0, Math.min(1, liveSignal?.sessionIntensity || 0))
    const novelty = Math.max(0, Math.min(1, liveSignal?.noveltyScore || 0))
    const modeMotion = {
      universal: { driftStrength: 0.18, oscillationStrength: 0.28, shimmerStrength: 0.2 },
      genre: { driftStrength: 0.2, oscillationStrength: 0.22, shimmerStrength: 0.16 },
      artist: { driftStrength: 0.16, oscillationStrength: 0.24, shimmerStrength: 0.18 },
      song: { driftStrength: 0.24, oscillationStrength: 0.4, shimmerStrength: 0.28 },
    }
    const base = modeMotion[galaxyMode] || modeMotion.universal
    setMotionState({
      driftStrength: base.driftStrength + sessionIntensity * 0.05,
      oscillationStrength: base.oscillationStrength + novelty * 0.06,
      shimmerStrength: base.shimmerStrength + sessionIntensity * 0.05,
    })
  }, [galaxyMode, liveSignal?.noveltyScore, liveSignal?.sessionIntensity, setMotionState])

  const focusedEntity = useMemo(() => resolveInteractionEntity(activeModel, musicProfile, focusedObject), [activeModel, focusedObject, musicProfile])
  const hoveredEntity = useMemo(() => resolveInteractionEntity(activeModel, musicProfile, hoveredObject), [activeModel, hoveredObject, musicProfile])

  useEffect(() => {
    if (!activeModel || !focusedObject?.id) return
    const resolved = resolveInteractionEntity(activeModel, musicProfile, focusedObject)
    if (!(resolved.node || resolved.cluster || resolved.region || resolved.edge)) {
      clearFocusedObject()
    }
  }, [activeModel, clearFocusedObject, focusedObject, musicProfile])

  const handleSelectCluster = useCallback((clusterId) => {
    if (!activeModel) return
    const cluster = activeModel.clusters?.find((entry) => entry.id === clusterId)
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
    const region = activeModel.regions?.find((entry) => entry.id === regionId)
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
      const node = activeModel?.nodes?.find((entry) => entry.id === ids[0])
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
    if (regionMatch) handleSelectRegion(regionMatch.id)
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

    if (changed) setSearchParams(next, { replace: true })
  }, [galaxyMode, searchParams, searchQuery, setSearchParams])

  const activeViewMode = constellationMode ? 'constellation' : viewMode
  const selectedResonance = useMemo(() => mapGalaxySelectionToResonance({
    node: focusedEntity.node,
    cluster: focusedEntity.cluster,
    region: focusedEntity.region,
    edge: focusedEntity.edge,
    model: activeModel,
    mode: 'focused',
  }), [activeModel, focusedEntity.cluster, focusedEntity.edge, focusedEntity.node, focusedEntity.region])

  const liveResonance = useMemo(() => {
    if (selectedResonance) return selectedResonance
    return mapGalaxySelectionToResonance({
      node: hoveredEntity.node,
      cluster: hoveredEntity.cluster,
      region: hoveredEntity.region,
      edge: hoveredEntity.edge,
      model: activeModel,
      mode: 'live',
    })
  }, [activeModel, hoveredEntity.cluster, hoveredEntity.edge, hoveredEntity.node, hoveredEntity.region, selectedResonance])

  const resonanceHint = useMemo(() => {
    if (selectedResonance?.label) return `The Soul Orb is holding ${selectedResonance.label.toLowerCase()} close.`
    if (liveResonance?.label) return `The Soul Orb is listening to ${liveResonance.label.toLowerCase()} in real time.`
    return 'The Soul Orb is resting inside your wider listening weather.'
  }, [liveResonance, selectedResonance])

  const subtitle = useMemo(() => {
    if (loading || galaxyLoading) return 'computing clusters, spacing stars, and plotting meaning...'
    if (isDemo) return 'a borrowed sky for now -- connect a music source to see your own'
    if (!activeModel) return 'the sky is still quiet'
    const density = activeModel.metadata?.modeDensity || activeModel.metadata?.density
    const layoutVersion = artifactMeta?.metadata?.layout || activeModel.metadata?.layoutVersion || 'galaxy-layout'
    return `${galaxyMode} mode • ${density?.nodes || activeModel.nodes.length} visible bodies • ${density?.edges || activeModel.edges?.length || 0} links • ${layoutVersion}`
  }, [activeModel, artifactMeta, galaxyLoading, galaxyMode, isDemo, loading])

  const trustBanner = useMemo(() => {
    if (!activeModel) return null
    if (hasLiveSignal) return `${liveSignal.eventCount} live listening events are nudging drift, shimmer, and focus in this session.`
    if (isDemo) return 'this is only a borrowed sky -- your own map arrives once your listening is connected.'
    if (galaxyError) return 'the next-gen galaxy service slipped, so the map fell back gracefully instead of going blank.'
    if (jobStatus?.job_id) return 'the visible galaxy is live now, and a deeper recompute is already queued in the background.'
    if (!['profile', 'nextgen-galaxy'].includes(activeModel.metadata?.source)) return 'some structures are still arriving from an older local model.'
    if (activeModel.metadata?.profileTier === 'partial') return 'this galaxy is still forming. regions and bridges stay sparse on purpose.'
    if ((activeModel.metadata?.confidence?.galaxy?.score || 0) < 0.5) return 'the pattern is real, but still faint in places.'
    return null
  }, [activeModel, galaxyError, hasLiveSignal, isDemo, jobStatus, liveSignal])

  const detailBanner = useMemo(() => {
    if (!activeModel || isDemo) return null
    const density = activeModel.metadata?.modeDensity || activeModel.metadata?.density
    if (!density) return null
    return `${density.anchors || density.clusters || 0} anchors • ${density.artistStars || density.nodes || 0} visible bodies • ${density.trackSatellites || 0} satellites • ${density.regions || 0} nebulae`
  }, [activeModel, isDemo])

  const controlProps = {
    isDemo,
    loading: loading || galaxyLoading,
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
  const sparseMode = tier === 'sparse' || Boolean(musicProfile && !readiness?.galaxy)
  const showBootPanel = (loading || galaxyLoading) && !activeModel && !cinemaMode

  const scene = (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(139,124,255,0.16),transparent_18%),radial-gradient(circle_at_18%_24%,rgba(185,148,255,0.18),transparent_28%),radial-gradient(circle_at_79%_24%,rgba(159,188,255,0.14),transparent_25%),radial-gradient(circle_at_72%_76%,rgba(208,179,255,0.10),transparent_24%),radial-gradient(circle_at_54%_82%,rgba(90,70,214,0.16),transparent_24%),linear-gradient(180deg,#050611_0%,#070714_48%,#03040a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.02)_0%,transparent_18%,transparent_82%,rgba(255,255,255,0.02)_100%)] opacity-70" />
      <GalaxyScene
        model={activeModel}
        sparseMode={sparseMode}
        lowPower={adaptive.lowPowerMode}
        reducedMotion={adaptive.prefersReducedMotion}
        webglEnabled={adaptive.webglSupported}
      />
      {isCoarsePointer && !(loading || galaxyLoading) ? (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[#090d1f]/72 px-4 py-2 text-[11px] text-gray-200 shadow-[0_18px_40px_rgba(3,4,15,0.35)] backdrop-blur-xl">
          Touch a star, nebula, bridge, or the core to see what it reveals. Touch it again to let it go.
        </div>
      ) : null}
      {constellationMode && !constellationOrigin && !(loading || galaxyLoading) ? (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-purple-500/30 bg-purple-500/18 px-3 py-1.5 text-xs text-purple-200 backdrop-blur">
          Touch a voice in the field to let its nearby constellation appear
        </div>
      ) : null}
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
        {loading || galaxyLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <NebulaLoader compact label="Opening cinema mode" detail="The universe is settling into a wider frame." />
          </div>
        ) : scene}
        <div className="absolute left-3 right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 sm:left-auto sm:right-4 sm:top-4">
          <GalaxyControls {...controlProps} onToggleCinema={() => setCinemaMode(false)} />
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
      <div className="relative mb-6 overflow-hidden rounded-[36px] noire-panel p-6 lg:p-8">
        <AtmosphereBackground variant="galaxy" intensity="rich" anchored />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="premium-kicker mb-3">Emotional universe</p>
            <h1 className="premium-hero-title">Galaxy</h1>
            <p className="premium-body mt-4">
              A map of your listening world rendered as distance, gravity, clusters, and memory instead of a pile of tracks.
            </p>
            <ShimmerDivider className="my-5 max-w-xl" />
            <p className="text-sm text-slate-300">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <HaloButton to="/discover" variant="secondary">Return to drift</HaloButton>
            <HaloButton to="/auralith?mode=analyze&prompt=read%20my%20galaxy" variant="primary">Ask what it means</HaloButton>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <GalaxyControls {...controlProps} onToggleCinema={() => setCinemaMode(true)} />
      </div>

      <div className="relative h-[62dvh] min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-[#040610] shadow-[0_30px_120px_rgba(2,4,12,0.6)] sm:h-[680px]">
        <AtmosphereBackground variant="galaxy" intensity="medium" anchored />
        {(loading || galaxyLoading) ? (
          <div className="absolute inset-0 p-6">
            <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1.35fr)_320px]">
              <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_50%_42%,rgba(139,124,255,0.12),transparent_16%),linear-gradient(180deg,rgba(10,11,22,0.82),rgba(5,6,15,0.92))] p-6">
                <NebulaLoader
                  label="Assembling your taste galaxy"
                  detail="Anchors, bridges, and nebula regions are resolving in layers so the route stays alive while the deeper structure settles."
                />
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="skeleton h-28" />
                  <div className="skeleton h-28" />
                  <div className="skeleton h-28" />
                  <div className="skeleton h-28" />
                </div>
              </div>
              <div className="space-y-4">
                <AuraCard className="p-4" accent="silver">
                  <p className="section-label mb-2">Preview metrics</p>
                  <div className="space-y-3">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-4 w-4/5" />
                  </div>
                </AuraCard>
                <AuraCard className="p-4" accent="lavender">
                  <p className="section-label mb-2">Route posture</p>
                  <p className="text-sm text-slate-400">The shell stays visible while clustering, density, and deeper meaning finish behind the glass.</p>
                </AuraCard>
              </div>
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
        {trustBanner && !(loading || galaxyLoading) ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 backdrop-blur">
            {trustBanner}
          </div>
        ) : null}
        {detailBanner && !(loading || galaxyLoading) && !trustBanner ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] text-gray-200 backdrop-blur">
            {detailBanner}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <SoulResonancePanel profile={musicProfile} model={activeModel} />
        <div>
          {liveSignal?.recentEvents?.[0]?.title ? (
            <AuraCard className="mb-3 px-4 py-3 text-sm text-cyan-100" accent="cyan">
              Now shaping your map: {liveSignal.recentEvents[0].title} by {liveSignal.recentEvents[0].artist}
            </AuraCard>
          ) : null}
          <AuraCard className="mb-3 px-4 py-3 text-sm text-gray-300" accent="silver">
            {resonanceHint}
          </AuraCard>
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
