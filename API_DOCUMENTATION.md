# API Documentation

Base URLs:
- Production: `https://melody-map-wgv2.onrender.com`
- Local dev: `http://127.0.0.1:5000`

All protected endpoints require a JWT token:
```
Authorization: Bearer <jwt_token>
```

Spotify data endpoints require a Spotify access token:
```
X-Spotify-Token: <spotify_access_token>
```

Last.fm data endpoints require session headers:
```
X-Lastfm-Session: <session_key>
X-Lastfm-User: <username>
```

---

## Health

### GET /api/health
Returns backend + database status.

```json
{
  "status": "ok",
  "db": "connected",
  "ts": "2025-01-01T00:00:00.000000"
}
```

Returns `503` with `"status": "degraded"` if MongoDB is unreachable.

---

## Auth (Email/Password)

### POST /api/auth/register
Rate limited: 10 req/min.

```json
// Request
{ "username": "alice", "email": "alice@example.com", "password": "secret123" }

// Response 201
{ "token": "<jwt>", "user_id": "<id>" }
```

### POST /api/auth/login
Rate limited: 20 req/min.

```json
// Request
{ "email": "alice@example.com", "password": "secret123" }

// Response 200
{ "token": "<jwt>", "user_id": "<id>" }
```

JWT tokens expire after 30 days.

---

## Spotify OAuth

### GET /auth/spotify/login
Redirects the browser to Spotify's authorization page. No body required.

### GET /auth/spotify/callback
Handles Spotify's redirect after user grants permission. Exchanges the authorization code for tokens, then redirects to:
```
{FRONTEND_URL}/spotify-success?token=<access_token>&refresh_token=<refresh_token>&expires_in=3600
```

On error:
```
{FRONTEND_URL}/spotify-success?error=<reason>
```

### POST /auth/spotify/refresh
Refresh an expired Spotify access token.

```json
// Request
{ "refresh_token": "<refresh_token>" }

// Response 200
{ "access_token": "<new_token>", "expires_in": 3600 }
```

---

## Last.fm OAuth

### GET /auth/lastfm/login
Redirects the browser to Last.fm's authorization page.

### GET /auth/lastfm/callback
Handles Last.fm's redirect. Exchanges the token for a session key, then redirects to:
```
{FRONTEND_URL}/lastfm-success?session=<session_key>&username=<username>
```

On error:
```
{FRONTEND_URL}/lastfm-success?error=<reason>
```

---

## Spotify Data Proxy

All routes under `/api/spotify/*` proxy requests to the Spotify Web API. Require `X-Spotify-Token` header.

### GET /api/spotify/me
Returns the authenticated user's Spotify profile.

```json
{
  "id": "spotify_user_id",
  "name": "Alice",
  "email": "alice@example.com",
  "image": "https://...",
  "country": "US",
  "product": "premium",
  "followers": 42
}
```

### GET /api/spotify/top-tracks
Query params: `time_range` (short_term | medium_term | long_term, default: medium_term), `limit` (1–50, default: 20).

Returns array of track objects:
```json
[{
  "id": "track_id",
  "title": "Track Name",
  "artist": "Primary Artist",
  "artists": ["Artist A", "Artist B"],
  "album": "Album Name",
  "album_art": "https://...",
  "preview_url": "https://...",
  "popularity": 78,
  "duration_ms": 210000,
  "spotify_url": "https://open.spotify.com/track/..."
}]
```

### GET /api/spotify/top-artists
Query params: `time_range`, `limit` (1–50, default: 20).

```json
[{
  "id": "artist_id",
  "name": "Artist Name",
  "genres": ["indie rock", "shoegaze"],
  "popularity": 65,
  "followers": 120000,
  "image": "https://...",
  "spotify_url": "https://open.spotify.com/artist/..."
}]
```

### GET /api/spotify/playlists
Query params: `limit` (1–50, default: 20).

```json
[{
  "id": "playlist_id",
  "name": "My Playlist",
  "description": "...",
  "tracks": 34,
  "image": "https://...",
  "public": true,
  "spotify_url": "https://..."
}]
```

### POST /api/spotify/audio-features
```json
// Request
{ "track_ids": ["id1", "id2", "id3"] }

// Response
[{
  "id": "track_id",
  "tempo": 128.4,
  "energy": 0.72,
  "danceability": 0.65,
  "valence": 0.48,
  "acousticness": 0.12,
  "instrumentalness": 0.03,
  "loudness": -5.4,
  "speechiness": 0.04
}]
```

### GET /api/spotify/recently-played
Query params: `limit` (1–50, default: 50). Returns deduplicated recently played tracks.

### GET /api/spotify/saved-tracks
Query params: `limit` (1–50, default: 50). Returns user's liked/saved tracks.

### GET /api/spotify/recommendations
Query params: `seed_artists[]`, `seed_tracks[]`, `seed_genres[]`, `limit` (default: 25), plus optional audio feature targets (`target_energy`, `target_valence`, `min_energy`, `max_energy`, etc.).

At least one seed is required. Total seeds must not exceed 5.

### GET /api/spotify/search
Query params: `q` (search query), `limit` (1–50, default: 10).

```json
{
  "tracks": {
    "items": [{
      "id": "track_id",
      "name": "Track Name",
      "artists": [{ "name": "Artist", "id": "artist_id" }],
      "album": { "name": "Album", "images": [...], "release_date": "2023-01-01" },
      "popularity": 72,
      "preview_url": "https://...",
      "external_urls": { "spotify": "https://..." },
      "duration_ms": 210000
    }]
  }
}
```

---

## Last.fm Data Proxy

All routes under `/api/lastfm/*` proxy requests to the Last.fm API. Require `X-Lastfm-Session` and `X-Lastfm-User` headers.

### GET /api/lastfm/me
Returns Last.fm user profile.

```json
{
  "id": "username",
  "name": "Real Name",
  "username": "username",
  "image": "https://...",
  "country": "US",
  "playcount": "12345",
  "registered": "2018-01-01 00:00",
  "provider": "lastfm"
}
```

### GET /api/lastfm/top-tracks
Query params: `period` (overall | 7day | 1month | 3month | 6month | 12month, default: overall), `limit` (1–50, default: 20).

### GET /api/lastfm/top-artists
Query params: `period`, `limit`.

### GET /api/lastfm/recent-tracks
Query params: `limit` (1–50, default: 20). Includes `now_playing: true` for the currently scrobbling track.

### GET /api/lastfm/similar-artists
Query params: `artist` (required). Returns up to 10 similar artists with match scores.

### GET /api/lastfm/artist-tags
Query params: `artist` (required). Returns top 5 genre tags for the artist.

---

## Music Profile

### GET /api/music-profile
Builds a complete music profile from the user's Spotify data. Requires `X-Spotify-Token` header.

Rate limited: 30 req/min.

Query params:
- `time_range`: short_term | medium_term | long_term (default: medium_term)
- `limit`: 1–50 (default: 50)

Response:
```json
{
  "userProfile": {
    "id": "spotify_id",
    "name": "Alice",
    "email": "alice@example.com",
    "image": "https://...",
    "country": "US",
    "product": "premium",
    "followers": 42
  },
  "topArtists": [...],
  "topTracks": [...],
  "recentlyPlayed": [...],
  "audioFeatures": {
    "energy": 0.62,
    "valence": 0.48,
    "danceability": 0.55,
    "acousticness": 0.31,
    "tempo": 118.4,
    "speechiness": 0.06,
    "instrumentalness": 0.08,
    "loudness": -6.2
  },
  "audioFeaturesList": [...],
  "galaxyNodes": [...],
  "aestheticTags": ["neon fog", "rainy window", "vintage film"],
  "analyticsMetrics": {
    "mood": "melancholic",
    "energyScore": 62,
    "valenceScore": 48,
    "danceabilityScore": 55,
    "acousticnessScore": 31,
    "tempoAvg": 118,
    "speechinessScore": 6,
    "instrumentalScore": 8,
    "nostalgiaIndex": 34,
    "diversityScore": 71,
    "sonicBrightness": 52
  },
  "genres": [
    { "genre": "indie rock", "count": 8 },
    { "genre": "shoegaze", "count": 5 }
  ],
  "timeRange": "medium_term"
}
```

---

## Discover

### POST /api/discover/playlists
### GET /api/discover/playlists

Generates personalized playlist concepts from a taste profile. No real tracks — returns seeds for Spotify resolution.

Rate limited: 30 req/min.

```json
// POST body (or GET query params)
{
  "genres": ["shoegaze", "dream pop", "lo-fi"],
  "energy": 0.35,
  "valence": 0.42,
  "n": 6,
  "seed": 0,
  "serendipity": false
}
```

`serendipity: true` activates anti-algorithm mode — selects archetypes from the outer edges of your taste embedding.

Response:
```json
[{
  "id": "nocturnal_drift_0",
  "title": "Nocturnal Drift — Quiet Hours",
  "description": "Late-night frequencies for the restless mind...",
  "why_it_fits": "Your taste gravitates toward the atmospheric...",
  "mood_tags": ["dreamy", "melancholic", "introspective", "nocturnal"],
  "aesthetic_tags": ["neon fog", "blurred lights", "rainy window"],
  "era_tags": ["90s", "2000s", "2010s"],
  "color": "#3a0ca3",
  "seed_artists": ["Beach House", "Grouper", "Mazzy Star"],
  "seed_queries": ["dreamy shoegaze", "lo-fi ambient night"],
  "seed_genres": ["shoegaze", "dream pop", "lo-fi"],
  "harmonic_mood_vector": {
    "name": "Liminal Space Nostalgia",
    "energy": 0.35,
    "valence": 0.42,
    "energy_label": "low energy",
    "valence_label": "low valence"
  }
}]
```

---

## Aesthetic

### POST /api/aesthetic
### GET /api/aesthetic

Generates a full visual aesthetic profile from music taste data.

Rate limited: 20 req/min.

```json
// Request
{
  "genres": ["shoegaze", "dream pop"],
  "energy": 0.35,
  "valence": 0.42,
  "tempo": 95,
  "danceability": 0.4,
  "top_artists": ["Beach House", "Grouper"],
  "personality_traits": ["dreamy", "melancholic"]
}
```

Response:
```json
{
  "aesthetic_name": "Midnight Dreamscape",
  "palette": ["#1a1a2e", "#3a0ca3", "#7209b7", "#560bad", "#480ca8"],
  "tags": ["neon fog", "blurred lights", "hazy bokeh", "rainy window", ...],
  "vibe_description": "Your music taste feels serene, melancholic, and deeply atmospheric, washed in reverb and haze.",
  "personality": {
    "id": "nocturnal_dreamer",
    "name": "Nocturnal Dreamer",
    "description": "You gravitate toward atmospheric soundscapes...",
    "traits": ["introspective", "atmospheric", "nocturnal"]
  },
  "images": [{
    "id": "photo_id",
    "url": "https://images.unsplash.com/...",
    "thumb": "https://...",
    "description": "neon fog",
    "photographer": "Photographer Name",
    "photographer_url": "https://unsplash.com/@...",
    "unsplash_url": "https://unsplash.com/photos/...",
    "tag": "neon fog",
    "width": 3000,
    "height": 4000
  }]
}
```

Falls back to Picsum placeholders if `UNSPLASH_ACCESS_KEY` is not configured.

### POST /api/aesthetic/regenerate
Same body as `/api/aesthetic`, plus `seed_offset: <int>` to get a different aesthetic name variation.

### POST /api/aesthetic/personality
Returns only the music personality profile.

```json
// Request
{ "genres": ["jazz", "soul"], "energy": 0.45, "valence": 0.6, "tempo": 90 }

// Response
{
  "id": "velvet_romantic",
  "name": "Velvet Romantic",
  "description": "Warm, soulful, and deeply emotional...",
  "traits": ["emotional", "warm", "soulful"]
}
```

### POST /api/aesthetic/shared
Generates a combined aesthetic for two matched users (soulmate pairs).

```json
// Request
{
  "tags_a": ["neon fog", "rainy window"],
  "tags_b": ["neon fog", "vintage film"],
  "shared_genres": ["shoegaze", "dream pop"],
  "shared_artists": ["Beach House"]
}

// Response
{
  "shared_aesthetic_name": "Velvet Echo Resonance",
  "shared_tags": ["neon fog", "rainy window", "vintage film"],
  "shared_vibe": "Together you inhabit a world of shoegaze, dream pop — a shared frequency only you two can hear.",
  "images": [...]
}
```

### POST /api/aesthetic/vibe
Maps audio features to a hyper-specific poetic vibe label.

```json
// Request
{ "energy": 0.35, "valence": 0.42, "tempo": 95, "genres": ["shoegaze"] }

// Response
{
  "label": "Rainy Window Solitude",
  "hex": "#90e0ef",
  "description": "Quiet introspection — the sound of watching rain from a warm room.",
  "energy": 0.35,
  "valence": 0.42,
  "tempo": 95.0
}
```

### POST /api/aesthetic/identity
Generates a full Music Identity Report with poetic persona.

```json
// Request
{ "genres": ["ambient", "post-rock"], "energy": 0.3, "valence": 0.4, "tempo": 85 }

// Response
{
  "id": "cosmic_drifter",
  "name": "The Cosmic Drifter",
  "tagline": "You listen to music the way astronomers look at stars.",
  "report": "Vast, patient, and endlessly curious...",
  "keywords": ["expansive", "meditative", "curious", "vast"],
  "vibe": {
    "label": "Void Frequency Meditation",
    "hex": "#0a0a2e",
    "description": "Vast, still, and quietly overwhelming...",
    "energy": 0.3,
    "valence": 0.4,
    "tempo": 85.0
  }
}
```

### POST /api/aesthetic/palette-from-features
Extracts a named color palette from average audio features.

```json
// Request
{ "average_valence": 0.42, "average_energy": 0.35, "genres": ["shoegaze"] }

// Response
{
  "name": "Midnight Velvet",
  "palette": ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560"],
  "unsplash_query": "dark moody aesthetic night",
  "description": "...",
  "energy": 0.35,
  "valence": 0.42,
  "genre_override": null,
  "images": [...]
}
```

---

## Pinterest Aesthetic

### POST /api/pinterest-aesthetic
Generates Pinterest search queries from genres and personality archetypes, fetches pins, and returns up to 20 results.

Rate limited: 20 req/min.

```json
// Request
{
  "genres": ["shoegaze", "dream pop"],
  "archetypes": ["dreamy", "melancholic"]
}

// Response
{
  "pins": [{
    "id": "pin_id",
    "title": "dreamy aesthetic",
    "description": "...",
    "image": "https://...",
    "thumb": "https://...",
    "link": "https://www.pinterest.com/pin/...",
    "query": "dreamy aesthetic"
  }],
  "queries": ["shoegaze aesthetic", "dreamy aesthetic", ...],
  "source": "pinterest"
}
```

`source` will be `"pinterest"`, `"unsplash"`, or `"placeholder"` depending on which API keys are configured.

---

## Soulmate

All routes require JWT auth.

### POST /api/soulmate/profile
Upsert the current user's taste profile for soulmate matching.

Rate limited: 20 req/min.

```json
// Request
{
  "top_artists": ["Beach House", "Grouper", "Mazzy Star"],
  "top_tracks": ["Space Song", "Vessel"],
  "genres": ["dream pop", "shoegaze", "ambient"],
  "audio_features": { "energy": 0.35, "valence": 0.42, "danceability": 0.4 },
  "username": "alice",
  "avatar": "https://..."
}

// Response 200
{ "ok": true, "username": "alice" }
```

### GET /api/soulmate/matches
Returns top-5 compatible users ranked by match score.

Rate limited: 30 req/min.

```json
[{
  "user_id": "user_id",
  "username": "bob",
  "avatar": "https://...",
  "match_score": 74,
  "shared_artists": ["Beach House", "Grouper"],
  "shared_genres": ["dream pop", "shoegaze"],
  "breakdown": {
    "artists": 60,
    "genres": 80,
    "audio": 72,
    "tracks": 20,
    "vibe": 85
  }
}]
```

Returns `404` if the current user hasn't synced a profile yet.

### GET /api/soulmate/compare/\<user_id\>
Full compatibility report between the current user and another user.

Rate limited: 30 req/min.

```json
{
  "match_score": 74,
  "shared_artists": ["Beach House"],
  "shared_tracks": [],
  "shared_genres": ["dream pop", "shoegaze"],
  "breakdown": {
    "artists": 60,
    "genres": 80,
    "audio": 72,
    "tracks": 0,
    "vibe": 85
  },
  "user_a": { "user_id": "...", "username": "alice", "avatar": "https://..." },
  "user_b": { "user_id": "...", "username": "bob",   "avatar": "https://..." },
  "graph": {
    "nodes": [
      { "id": "beach house", "label": "Beach House", "type": "shared", "image": null },
      { "id": "a_grouper",   "label": "Grouper",     "type": "user_a", "image": null }
    ],
    "links": [
      { "source": "a_grouper", "target": "beach house", "strength": 0.3 }
    ]
  }
}
```

### GET /api/soulmate/profile/me
Returns the current user's stored taste profile.

---

## Public Profile

### GET /api/public-profile/\<username_or_id\>
Returns a public taste profile by username or user ID. No authentication required.

Rate limited: 60 req/min.

```json
{
  "username": "alice",
  "avatar": "https://...",
  "topArtists": [{ "name": "Beach House", "genres": ["dream pop"], "popularity": 65 }],
  "topTracks": [{ "title": "Space Song", "artist": "Beach House" }],
  "genres": [{ "genre": "dream pop", "count": 5 }],
  "audioFeatures": { "energy": 0.35, "valence": 0.42 }
}
```

---

## Auralith (AI Layer)

All routes are under `/api/auralith/`. No auth required at the route level.

### POST /api/auralith/generate-playlist
Generate a playlist from a natural language prompt.

```json
// Request
{
  "prompt": "songs for a rainy night drive",
  "profile": { "genres": ["shoegaze"], "energy": 0.35 },
  "limit": 8
}
```

### POST /api/auralith/analyze-taste
Analyze a set of seed tracks/artists and return taste insights.

```json
// Request
{
  "seeds": ["Beach House", "Grouper", "Mazzy Star"],
  "profile": { "genres": ["dream pop"] }
}
```

### POST /api/auralith/explain-song
Get an AI explanation of why a song fits a user's taste.

```json
// Request
{
  "prompt": "Space Song by Beach House",
  "profile": { "genres": ["dream pop"], "energy": 0.35 }
}
```

### POST /api/auralith/critique-playlist
Get an AI critique of a playlist relative to the user's taste.

```json
// Request
{
  "songs": ["Space Song", "Vessel", "Myth"],
  "profile": { "genres": ["dream pop"] }
}
```

### POST /api/auralith/concept-playlist
Generate a concept-driven playlist from a creative prompt.

```json
// Request
{
  "prompt": "a playlist that sounds like 3am in a city that doesn't exist",
  "profile": { "genres": ["ambient", "shoegaze"] },
  "limit": 8
}
```

---

## Internal Routes (app.py)

These routes are defined directly in `app.py`, not in blueprints.

### POST /api/map/generate
Requires JWT auth. Runs ML clustering + PCA on all songs in the database and stores 2D/3D coordinates. Returns `503` if ML engines failed to load.

### GET /api/map/data
Returns all songs that have `map_coordinates` set.

### GET /api/songs/search?q=\<query\>
Rate limited: 30 req/min. Searches songs by title, artist, or album.

### GET /api/songs/\<song_id\>/similar
Returns similar songs using KNN. Returns `503` if ML engine unavailable.

### POST /api/playlists/generate
Rate limited: 20 req/min. Requires `{ "mood": "dreamy" }`. Returns `503` if ML engine unavailable.

### GET /api/playlists/\<playlist_id\>
Returns a stored playlist by ID.

### GET /api/recommendations/\<user_id\>
Rate limited: 30 req/min. Returns hybrid content-based + collaborative recommendations.

### POST /api/interactions
Requires JWT auth. Records a user-song interaction.

```json
// Request
{ "song_id": "song_id", "interaction_type": "like" }
// interaction_type: like | play | skip | save
```

---

## Error Responses

All errors follow this shape:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / missing fields |
| 401 | Missing or invalid auth token |
| 404 | Resource not found |
| 405 | Method not allowed |
| 409 | Conflict (e.g. email already registered) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | ML engine or database unavailable |

---

## Rate Limits

Rate limits are enforced per IP address using an in-memory sliding window.

| Endpoint group | Limit |
|----------------|-------|
| `/api/auth/register` | 10 req/min |
| `/api/auth/login` | 20 req/min |
| `/api/music-profile` | 30 req/min |
| `/api/discover/playlists` | 30 req/min |
| `/api/aesthetic` | 20 req/min |
| `/api/aesthetic/vibe` | 60 req/min |
| `/api/soulmate/*` | 20–30 req/min |
| `/api/public-profile/*` | 60 req/min |
| `/api/pinterest-aesthetic` | 20 req/min |
| `/api/songs/search` | 30 req/min |
| `/api/playlists/generate` | 20 req/min |
| `/api/recommendations/*` | 30 req/min |
