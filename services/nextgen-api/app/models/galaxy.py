from typing import Literal

from pydantic import BaseModel, Field


NodeType = Literal["cluster", "artist", "track"]
EdgeType = Literal["cluster_bridge", "artist_cluster", "artist_similarity", "track_anchor"]


class AudioFeaturesPayload(BaseModel):
    energy: float | None = None
    valence: float | None = None
    danceability: float | None = None
    acousticness: float | None = None
    instrumentalness: float | None = None
    speechiness: float | None = None
    tempo: float | None = None


class ArtistInput(BaseModel):
    id: str | None = None
    name: str
    popularity: int | None = None
    genres: list[str] = Field(default_factory=list)
    image: str | None = None
    audio_features: AudioFeaturesPayload | None = None


class TrackInput(BaseModel):
    id: str | None = None
    title: str
    artist: str
    popularity: int | None = None
    album_art: str | None = None
    audio_features: AudioFeaturesPayload | None = None


class GenreInput(BaseModel):
    genre: str
    count: int = 1


class GalaxyProfileRequest(BaseModel):
    user_id: str = "session-user"
    source_window: str = "medium_term"
    topArtists: list[ArtistInput] = Field(default_factory=list)
    topTracks: list[TrackInput] = Field(default_factory=list)
    genres: list[GenreInput] = Field(default_factory=list)
    audioFeatures: AudioFeaturesPayload | None = None


class Vector3(BaseModel):
    x: float
    y: float
    z: float


class GalaxyNode(BaseModel):
    id: str
    type: NodeType
    label: str
    position: Vector3
    size: float
    color: str
    cluster_id: str | None = None
    region_label: str | None = None
    image: str | None = None
    metrics: dict = Field(default_factory=dict)
    explanation: str


class GalaxyEdge(BaseModel):
    id: str
    source: str
    target: str
    type: EdgeType
    weight: float
    confidence: float
    explanation: str


class GalaxyCluster(BaseModel):
    id: str
    label: str
    centroid: Vector3
    color: str
    members: list[str] = Field(default_factory=list)
    dominant_genres: list[str] = Field(default_factory=list)
    confidence: float
    explanation: str


class GalaxyRegion(BaseModel):
    id: str
    label: str
    title: str
    centroid: Vector3
    color: str
    coverage: float
    members: list[str] = Field(default_factory=list)
    explanation: str


class GalaxyArtifactPayload(BaseModel):
    artifact_id: str
    pipeline_version: str
    embedding_version: str
    feature_schema_version: str
    source_window: str
    node_count: int
    edge_count: int
    cluster_count: int
    confidence: float
    nodes: list[GalaxyNode]
    edges: list[GalaxyEdge]
    clusters: list[GalaxyCluster]
    regions: list[GalaxyRegion]
    metadata: dict = Field(default_factory=dict)


class GalaxyJobRequest(BaseModel):
    profile: GalaxyProfileRequest
    idempotency_key: str
    force_refresh: bool = False
