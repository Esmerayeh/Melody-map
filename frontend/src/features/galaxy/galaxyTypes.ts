export type GalaxyNodeType = 'cluster' | 'artist' | 'track'

export type GalaxyNodeRecord = {
  id: string
  type: GalaxyNodeType
  label: string
  position: { x: number; y: number; z: number }
  size: number
  color: string
  cluster_id?: string | null
  region_label?: string | null
  image?: string | null
  metrics?: Record<string, number | string | boolean | null>
  explanation: string
}

export type GalaxyEdgeRecord = {
  id: string
  source: string
  target: string
  type: string
  weight: number
  confidence: number
  explanation: string
}

export type GalaxyClusterRecord = {
  id: string
  label: string
  centroid: { x: number; y: number; z: number }
  color: string
  members: string[]
  dominant_genres?: string[]
  confidence: number
  explanation: string
}

export type GalaxyRegionRecord = {
  id: string
  label: string
  title: string
  centroid: { x: number; y: number; z: number }
  color: string
  coverage: number
  members: string[]
  explanation: string
}

export type GalaxyArtifactResponse = {
  artifact_id: string
  pipeline_version: string
  embedding_version: string
  feature_schema_version: string
  source_window: string
  node_count: number
  edge_count: number
  cluster_count: number
  confidence: number
  nodes: GalaxyNodeRecord[]
  edges: GalaxyEdgeRecord[]
  clusters: GalaxyClusterRecord[]
  regions: GalaxyRegionRecord[]
  metadata?: Record<string, unknown>
}
