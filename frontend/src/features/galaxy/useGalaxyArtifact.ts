import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { buildGalaxyArtifact, enqueueGalaxyBuild } from './galaxyApi'
import { queryKeys } from '../../lib/queryKeys'

// Bump BUILD_LOGIC_VERSION whenever the request payload or build semantics change
// (e.g. the rank-based popularity fallback). It's part of the idempotency seed, so
// bumping it busts the server-cached artifact once and forces a fresh rebuild —
// otherwise an unchanged profile keeps serving the stale pre-change build.
const BUILD_LOGIC_VERSION = 'v2-rank-popularity'

function buildIdempotencyKey(profile: any) {
  const seed = [
    BUILD_LOGIC_VERSION,
    profile?.generatedAt || profile?.syncedAt || 'unknown',
    profile?.timeRange || 'medium_term',
    profile?.topArtists?.length || 0,
    profile?.topTracks?.length || 0,
  ].join(':')
  return `galaxy-${btoa(unescape(encodeURIComponent(seed))).replace(/=+$/g, '').slice(0, 24)}`
}

function mapRequestProfile(profile: any) {
  return {
    user_id: profile?.userProfile?.id || profile?.userProfile?.username || 'session-user',
    source_window: profile?.timeRange || 'medium_term',
    audioFeatures: profile?.audioFeatures || {},
    genres: (profile?.genres || []).map((genre: any) => ({
      genre: typeof genre === 'string' ? genre : genre.genre,
      count: typeof genre === 'string' ? 1 : genre.count || 1,
    })),
    topArtists: (profile?.topArtists || []).map((artist: any, index: number, list: any[]) => ({
      id: artist.id || null,
      name: artist.name,
      // Spotify deprecated `popularity` on /me/top/artists (it returns null now),
      // which left Centrality/significance/star-size/anchor-roles flat at the 50
      // default. Fall back to RANK — position in your top list (#1 = most
      // central, fading down). Real data we already have, not an invented value.
      // Genuine popularity is still used if Spotify ever returns it again.
      popularity: typeof artist.popularity === 'number'
        ? artist.popularity
        : Math.round((1 - index / Math.max(list.length, 1)) * 100),
      genres: artist.genres || [],
      image: artist.image || null,
      audio_features: artist.audioFeatures || profile?.audioFeatures || {},
    })),
    topTracks: (profile?.topTracks || []).map((track: any) => ({
      id: track.id || null,
      title: track.title,
      artist: track.artist,
      popularity: track.popularity ?? 50,
      album_art: track.album_art || null,
      audio_features: track.audio_features || profile?.audioFeatures || {},
    })),
  }
}

function deriveCore(nodes: any[]) {
  const artistNodes = nodes.filter((node) => node.type === 'artist')
  const anchors = artistNodes
    .slice()
    .sort((left, right) => (Number(right.metrics?.significance || 0) - Number(left.metrics?.significance || 0)))
    .slice(0, 5)
  if (!anchors.length) {
    return {
      label: 'Taste Core',
      position: { x: 0, y: 0, z: 0 },
      color: '#e0a35c',
      supportingArtists: [],
      strength: 0.2,
    }
  }

  return {
    label: 'Taste Core',
    position: {
      x: anchors.reduce((sum, node) => sum + (node.position?.x || 0), 0) / anchors.length,
      y: anchors.reduce((sum, node) => sum + (node.position?.y || 0), 0) / anchors.length,
      z: anchors.reduce((sum, node) => sum + (node.position?.z || 0), 0) / anchors.length,
    },
    color: anchors[0].color || '#e0a35c',
    supportingArtists: anchors.map((node) => node.id),
    strength: anchors.reduce((sum, node) => sum + Number(node.metrics?.significance || 0), 0) / anchors.length,
  }
}

function normalizeArtifact(artifact: any) {
  const nodes = (artifact?.nodes || []).map((node: any) => ({
    ...node,
    clusterId: node.cluster_id || null,
    regionLabel: node.region_label || null,
    role: node.type === 'cluster' ? 'cluster-core' : node.type === 'track' ? 'satellite' : 'star',
    detailLevel: node.type === 'track' ? 'micro' : node.type === 'artist' ? 'mid' : 'macro',
    // Schema bridge — the GalaxyInspector reads client-model keys, but the server
    // artifact names things differently. Map ONLY where the concept is identical:
    //   • centrality ← significance: the client model defines them as the SAME
    //     value (galaxyScoring.js: `centrality = significance`), so this is a
    //     rename, not an invention.
    // We deliberately do NOT fabricate `confidence` (server has no per-node
    // confidence; the artifact's top-level confidence is galaxy-wide) or
    // `bridgeScore` (server computes no bridge metric). Leaving them undefined so
    // the panel can hide those rows instead of showing a fake 0%.
    metrics: node.metrics
      ? { ...node.metrics, centrality: node.metrics.centrality ?? node.metrics.significance }
      : node.metrics,
  }))

  const clusters = (artifact?.clusters || []).map((cluster: any) => ({
    ...cluster,
    centroid: cluster.centroid,
    dominantGenres: cluster.dominant_genres || [],
    size: cluster.members?.length || 0,
    metrics: {
      significance: cluster.confidence,
    },
    regionLabel: null,
  }))

  const regions = artifact?.regions || []
  const core = deriveCore(nodes)

  return {
    nodes,
    edges: artifact?.edges || [],
    clusters,
    regions,
    metadata: {
      source: 'nextgen-galaxy',
      generatedAt: artifact?.metadata?.generated_at || new Date().toISOString(),
      galaxyDataVersion: artifact?.pipeline_version,
      layoutVersion: artifact?.metadata?.layout || 'deterministic-kmeans-force-v1',
      profileTier: artifact?.confidence >= 0.8 ? 'rich' : artifact?.confidence >= 0.58 ? 'medium' : 'partial',
      confidence: {
        galaxy: { score: artifact?.confidence || 0, label: artifact?.confidence >= 0.8 ? 'high' : artifact?.confidence >= 0.58 ? 'medium' : 'low' },
      },
      density: {
        artistStars: nodes.filter((node: any) => node.type === 'artist').length,
        trackSatellites: nodes.filter((node: any) => node.type === 'track').length,
        anchors: clusters.length,
        edges: artifact?.edges?.length || 0,
        regions: regions.length,
      },
      modeDensity: {
        nodes: nodes.length,
        edges: artifact?.edges?.length || 0,
        regions: regions.length,
        clusters: clusters.length,
      },
      sparseMode: (artifact?.confidence || 0) < 0.5,
      core,
      meaning: artifact?.metadata?.meaning || {},
      focusPresets: {
        coreTaste: core.supportingArtists || [],
        bridgeArtists: nodes.filter((node: any) => node.type === 'artist').slice(0, 8).map((node: any) => node.id),
        discoveryFrontier: nodes.filter((node: any) => node.type === 'track').slice(0, 8).map((node: any) => node.id),
        strangeEdge: nodes.filter((node: any) => node.type === 'track').slice(8, 16).map((node: any) => node.id),
      },
      viewModes: ['identity', 'constellation', 'mood', 'discovery', 'genre'],
    },
  }
}

export default function useGalaxyArtifact(profile: any) {
  const submittedRef = useRef<string | null>(null)
  const payload = useMemo(() => (profile ? mapRequestProfile(profile) : null), [profile])
  const idempotencyKey = useMemo(() => (profile ? buildIdempotencyKey(profile) : null), [profile])

  const query = useQuery({
    queryKey: [...queryKeys.musicProfile('galaxy', profile?.timeRange || 'medium_term'), idempotencyKey],
    enabled: Boolean(payload && idempotencyKey),
    staleTime: 120_000,
    retry: 0,                           // don't retry 404s from absent endpoint
    queryFn: async () => {
      const result = await buildGalaxyArtifact(payload!, idempotencyKey!)
      return result ?? null              // null = endpoint absent, fall back to client builder
    },
  })

  const jobMutation = useMutation({
    mutationFn: async () => {
      const result = await enqueueGalaxyBuild(payload!, idempotencyKey!)
      return result ?? null              // null = endpoint absent, not an error
    },
  })

  useEffect(() => {
    if (!payload || !idempotencyKey || submittedRef.current === idempotencyKey) return
    submittedRef.current = idempotencyKey
    jobMutation.mutate()
  }, [idempotencyKey, jobMutation, payload])

  // Memoize the normalized artifact. normalizeArtifact() builds a brand-new
  // object graph every call, so computing it inline in the return made
  // `artifact` a fresh reference on every render — which churned MusicMap's
  // loadData dependency (generatedGalaxy) → setModel → re-render → infinite
  // loop ("Maximum update depth exceeded"). Recompute only when query.data changes.
  const artifact = useMemo(() => (query.data ? normalizeArtifact(query.data) : null), [query.data])

  return {
    artifact,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    jobStatus: jobMutation.data || null,
    artifactMeta: query.data || null,
  }
}
