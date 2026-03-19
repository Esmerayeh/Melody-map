# API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}

Response: 201 Created
{
  "token": "jwt_token",
  "user_id": "user_id"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}

Response: 200 OK
{
  "token": "jwt_token",
  "user_id": "user_id"
}
```

## Music Map

### Generate Map
Generates music map with ML clustering and 2D coordinates.

```http
POST /api/map/generate
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Map generated",
  "total_songs": 500
}
```

### Get Map Data
Retrieves all songs with map coordinates.

```http
GET /api/map/data
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "_id": "song_id",
    "title": "Song Title",
    "artist": "Artist Name",
    "cluster_id": 3,
    "map_coordinates": {
      "x": 0.45,
      "y": -0.23
    },
    "audio_features": {
      "energy": 0.75,
      "valence": 0.60,
      ...
    },
    "album_art": "url"
  }
]
```

## Songs

### Search Songs
Search for songs by title or artist.

```http
GET /api/songs/search?q={query}
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "_id": "song_id",
    "title": "Song Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "audio_features": {...},
    "album_art": "url"
  }
]
```

### Get Similar Songs
Find songs similar to a specific song.

```http
GET /api/songs/{song_id}/similar
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "_id": "similar_song_id",
    "title": "Similar Song",
    "artist": "Artist",
    "similarity_score": 0.89
  }
]
```

## Playlists

### Generate AI Playlist
Generate playlist based on mood.

```http
POST /api/playlists/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "mood": "dreamy"
}

Response: 201 Created
{
  "playlist_id": "playlist_id",
  "songs": [
    {
      "_id": "song_id",
      "title": "Song Title",
      "artist": "Artist Name",
      "audio_features": {...}
    }
  ]
}
```

**Available Moods:**
- `happy` - High valence, high energy
- `sad` - Low valence, low energy
- `energetic` - High energy, high danceability
- `calm` - Low energy, high acousticness
- `dreamy` - Medium valence, medium-high acousticness
- `melancholic` - Low valence, medium acousticness
- `nostalgic` - Medium valence, high acousticness

### Get User Playlists
```http
GET /api/playlists/user/{user_id}
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "_id": "playlist_id",
    "name": "Playlist Name",
    "description": "Description",
    "songs": ["song_id_1", "song_id_2"],
    "mood": "dreamy",
    "created_at": "2024-01-01T00:00:00Z",
    "generated_by_ai": true
  }
]
```

## Recommendations

### Get Personalized Recommendations
Get song recommendations based on user's listening history.

```http
GET /api/recommendations/{user_id}
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "song_id": "song_id",
    "score": 0.92,
    "song": {
      "_id": "song_id",
      "title": "Recommended Song",
      "artist": "Artist",
      "audio_features": {...}
    }
  }
]
```

## User Interactions

### Record Interaction
Track user interactions with songs.

```http
POST /api/interactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": "user_id",
  "song_id": "song_id",
  "interaction_type": "like"
}

Response: 201 Created
{
  "interaction_id": "interaction_id"
}
```

**Interaction Types:**
- `like` - User liked the song
- `play` - User played the song
- `skip` - User skipped the song
- `save` - User saved to library

### Get User Interactions
```http
GET /api/interactions/user/{user_id}
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "_id": "interaction_id",
    "user_id": "user_id",
    "song_id": "song_id",
    "interaction_type": "like",
    "timestamp": "2024-01-01T00:00:00Z"
  }
]
```

## Analytics

### Get User Statistics
```http
GET /api/analytics/user/{user_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "total_songs": 1247,
  "total_playlists": 23,
  "total_artists": 342,
  "genre_distribution": {
    "indie rock": 35,
    "shoegaze": 25,
    "dream pop": 20
  },
  "cluster_distribution": {
    "0": 45,
    "1": 38,
    "2": 52
  },
  "audio_preferences": {
    "energy": 0.65,
    "valence": 0.55,
    "danceability": 0.48
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid credentials"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

- 100 requests per minute per user
- 1000 requests per hour per user

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer {jwt_token}
```

Token expires after 24 hours.

## Pagination

For endpoints returning large datasets, use pagination:

```http
GET /api/songs?page=1&limit=20
```

Default: `page=1`, `limit=20`
Max limit: `100`

## Filtering

Songs can be filtered by audio features:

```http
GET /api/songs?energy_min=0.7&valence_min=0.6
```

Available filters:
- `energy_min`, `energy_max`
- `valence_min`, `valence_max`
- `danceability_min`, `danceability_max`
- `tempo_min`, `tempo_max`
- `cluster_id`

## Sorting

Results can be sorted:

```http
GET /api/songs?sort_by=popularity&order=desc
```

Sort options:
- `popularity`
- `title`
- `artist`
- `created_at`

Order: `asc` or `desc`
