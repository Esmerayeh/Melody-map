# Melody Map - System Architecture

## System Overview

Melody Map is a full-stack AI-powered music discovery platform that uses machine learning to create an interactive visual map of music based on audio features and similarity.

## Architecture Layers

### 1. Frontend Layer (React + Tailwind + D3.js)

**Components:**
- `App.jsx` - Main application router and authentication wrapper
- `Navbar.jsx` - Navigation component
- `Login.jsx` - Authentication page
- `MusicMap.jsx` - Interactive D3.js visualization of music universe
- `Discover.jsx` - Search and discovery interface
- `Playlists.jsx` - AI playlist generation interface
- `Analytics.jsx` - User analytics dashboard with charts

**Key Technologies:**
- React 18 for UI components
- React Router for navigation
- D3.js for interactive map visualization
- Tailwind CSS for styling
- Axios for API communication
- Recharts for analytics visualizations

### 2. Backend Layer (Flask REST API)

**API Endpoints:**

Authentication:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

Music Map:
- `POST /api/map/generate` - Generate music map with ML clustering
- `GET /api/map/data` - Retrieve map data with coordinates

Songs:
- `GET /api/songs/search?q={query}` - Search songs and artists
- `GET /api/songs/{song_id}/similar` - Find similar songs

Playlists:
- `POST /api/playlists/generate` - Generate AI playlist by mood
- `GET /api/recommendations/{user_id}` - Get personalized recommendations

**Services:**
- `spotify_service.py` - Spotify API integration for track features
- Authentication with JWT tokens
- Password hashing with bcrypt

### 3. Machine Learning Layer

**similarity_engine.py:**
- Feature extraction from audio characteristics
- StandardScaler normalization
- Cosine similarity computation
- K-Means clustering (10 clusters)
- PCA dimensionality reduction for 2D map
- t-SNE alternative for visualization
- Graph network construction with NetworkX

**recommendation_engine.py:**
- User profile building from interactions
- Content-based filtering using audio features
- Collaborative filtering
- Hybrid recommendation system
- Mood-based playlist generation

**Audio Features Used:**
- Tempo (BPM)
- Energy (0-1)
- Danceability (0-1)
- Valence/Positivity (0-1)
- Acousticness (0-1)
- Instrumentalness (0-1)
- Loudness (dB)
- Speechiness (0-1)

### 4. Database Layer (MongoDB)

**Collections:**

`users`:
- User credentials and profile
- Taste profile with audio preferences
- Playlist references

`songs`:
- Track metadata
- Audio features
- Cluster assignment
- 2D map coordinates
- Spotify integration data

`artists`:
- Artist information
- Genre tags
- Similarity relationships
- Map coordinates

`playlists`:
- User-created and AI-generated playlists
- Song references
- Mood tags

`interactions`:
- User-song interactions (like, play, skip)
- Timestamp tracking
- Used for collaborative filtering

## Data Flow

### Music Map Generation:
1. Fetch songs from database
2. Extract audio features into matrix
3. Normalize features with StandardScaler
4. Apply K-Means clustering
5. Reduce to 2D with PCA
6. Store cluster_id and coordinates
7. Render with D3.js on frontend

### Recommendation Flow:
1. Collect user interactions
2. Build user taste profile (average features)
3. Compute similarity with all songs
4. Rank by similarity score
5. Apply collaborative filtering
6. Combine scores (hybrid approach)
7. Return top recommendations

### Playlist Generation:
1. User selects mood
2. Map mood to audio feature ranges
3. Filter songs matching criteria
4. Rank by relevance
5. Return playlist

## Scalability Considerations

- MongoDB for horizontal scaling
- Separate ML service for compute-intensive tasks
- Caching for frequently accessed data
- Batch processing for map generation
- API rate limiting
- CDN for static assets

## Security

- JWT token authentication
- Bcrypt password hashing
- CORS configuration
- Environment variable management
- Input validation
- SQL injection prevention (NoSQL)

## Deployment Architecture

```
[Frontend - Vercel/Netlify]
         ↓
[Backend API - Heroku/Railway]
         ↓
[MongoDB Atlas - Cloud Database]
         ↓
[Spotify API - External Service]
```

## Future Enhancements

- Real-time collaborative playlists
- Social features (follow users, share playlists)
- Audio playback integration
- Mobile app (React Native)
- Advanced NLP for mood detection
- Graph neural networks for recommendations
- WebGL 3D visualization with Three.js
