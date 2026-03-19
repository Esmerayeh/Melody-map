# MongoDB Database Schema

## Collections

### users
```javascript
{
  _id: ObjectId,
  username: String,
  email: String (unique, indexed),
  password_hash: String,
  created_at: DateTime,
  taste_profile: {
    favorite_genres: [String],
    top_artists: [String],
    audio_preferences: {
      energy: Float,
      valence: Float,
      danceability: Float,
      acousticness: Float
    }
  },
  playlists: [ObjectId] // References to playlists collection
}
```

### songs
```javascript
{
  _id: ObjectId,
  spotify_id: String (unique, indexed),
  title: String (indexed),
  artist: String (indexed),
  album: String,
  duration_ms: Integer,
  audio_features: {
    tempo: Float,
    energy: Float,
    danceability: Float,
    valence: Float,
    acousticness: Float,
    instrumentalness: Float,
    loudness: Float,
    speechiness: Float,
    liveness: Float,
    key: Integer,
    mode: Integer,
    time_signature: Integer
  },
  cluster_id: Integer (indexed),
  map_coordinates: {
    x: Float,
    y: Float
  },
  genres: [String],
  popularity: Integer,
  preview_url: String,
  album_art: String
}
```

### artists
```javascript
{
  _id: ObjectId,
  spotify_id: String (unique, indexed),
  name: String (indexed),
  genres: [String],
  popularity: Integer,
  followers: Integer,
  image_url: String,
  similar_artists: [ObjectId], // References to other artists
  map_coordinates: {
    x: Float,
    y: Float
  }
}
```

### playlists
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (indexed), // Reference to users collection
  name: String,
  description: String,
  songs: [ObjectId], // References to songs collection
  mood: String,
  created_at: DateTime,
  updated_at: DateTime,
  is_public: Boolean,
  generated_by_ai: Boolean
}
```

### interactions
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (indexed),
  song_id: ObjectId (indexed),
  interaction_type: String, // 'like', 'play', 'skip', 'save'
  timestamp: DateTime
}
```

## Indexes

### users
- `email` (unique)

### songs
- `spotify_id` (unique)
- `title` (text)
- `artist` (text)
- `cluster_id`
- Compound: `{title: 1, artist: 1}`

### artists
- `spotify_id` (unique)
- `name` (text)

### playlists
- `user_id`
- Compound: `{user_id: 1, created_at: -1}`

### interactions
- `user_id`
- `song_id`
- Compound: `{user_id: 1, timestamp: -1}`
- Compound: `{song_id: 1, interaction_type: 1}`

## Relationships

```
users (1) ----< (N) playlists
users (1) ----< (N) interactions
songs (1) ----< (N) interactions
playlists (N) ----< (N) songs
artists (N) ----< (N) artists (similar_artists)
```

## Sample Queries

### Find similar songs in same cluster
```javascript
db.songs.find({
  cluster_id: 5,
  _id: { $ne: ObjectId("song_id") }
}).limit(10)
```

### Get user's liked songs
```javascript
db.interactions.aggregate([
  { $match: { user_id: ObjectId("user_id"), interaction_type: "like" } },
  { $lookup: {
      from: "songs",
      localField: "song_id",
      foreignField: "_id",
      as: "song_details"
  }}
])
```

### Find songs by mood (dreamy)
```javascript
db.songs.find({
  "audio_features.valence": { $gte: 0.4, $lte: 0.7 },
  "audio_features.acousticness": { $gte: 0.4, $lte: 0.8 },
  "audio_features.energy": { $gte: 0.2, $lte: 0.6 }
})
```

### Get cluster statistics
```javascript
db.songs.aggregate([
  { $group: {
      _id: "$cluster_id",
      count: { $sum: 1 },
      avg_energy: { $avg: "$audio_features.energy" },
      avg_valence: { $avg: "$audio_features.valence" }
  }}
])
```
