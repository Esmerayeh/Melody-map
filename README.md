# Melody Map

An AI-powered music discovery platform that visualises your listening history as an interactive 3D galaxy, generates intelligent playlists, and surfaces personalised recommendations — powered by Spotify and Last.fm.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  React + Vite  ·  Zustand  ·  TanStack Query  ·  Three.js/R3F  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / REST
┌────────────────────────────▼────────────────────────────────────┐
│                      Flask API  (port 5000)                      │
│  JWT Auth  ·  Rate Limiting  ·  Structured Logging  ·  CORS     │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Spotify Auth │  │  Last.fm Auth│  │  Music Data Proxies  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ML Pipeline                                  │   │
│  │  MusicSimilarityEngine  ·  RecommendationEngine          │   │
│  │  KMeans Clustering  ·  PCA/3D Reduction  ·  KNN          │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │         MongoDB              │
              │  users · songs · playlists   │
              │  interactions · artists      │
              └─────────────────────────────┘
```

---

## Features

| Feature | Description |
|---|---|
| Music Galaxy | Interactive 3D force graph (Three.js / React Three Fiber) — each star is a song, clustered by audio similarity |
| Dual Provider | Connect Spotify **or** Last.fm — unified `musicService` abstraction |
| ML Recommendations | Hybrid content-based + collaborative filtering + KNN |
| AI Playlist Generator | Mood-based playlist generation with audio feature scoring |
| Analytics Dashboard | Live genre distribution, top artists, discovery trends (Recharts) |
| Discover | Debounced search, top tracks, top artists, AI recommendations |
| JWT Auth | Secure registration/login with 30-day tokens |
| Rate Limiting | Per-IP sliding window on all sensitive endpoints |
| Structured Logging | JSON logs with request timing on every route |
| Docker | Full `docker-compose` setup (backend + frontend + MongoDB) |
| CI/CD | GitHub Actions — test → build → Docker image |

---

## Tech Stack

**Frontend**
- React 18 + Vite
- React Three Fiber + Three.js (3D galaxy)
- TanStack Query (server state)
- Zustand (client state)
- Recharts (analytics)
- Tailwind CSS

**Backend**
- Python 3.11 + Flask 3
- PyMongo + MongoDB
- scikit-learn (KMeans, PCA, KNN, cosine similarity)
- PyJWT + bcrypt
- Gunicorn (production)

**Data Sources**
- Spotify Web API (OAuth 2.0, audio features, top tracks/artists)
- Last.fm API (Web Auth, scrobble history, similar artists)

---

## Quick Start (Development)

### Prerequisites
- Node 20+, Python 3.11+, MongoDB running locally

### Backend
```bash
cd "melody map/backend"
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # fill in your API keys
python app.py
```

### Frontend
```bash
cd "melody map/frontend"
npm install
npm run dev
```

Open `http://localhost:3000`

---

## Docker (Production)

```bash
cd "melody map"
docker-compose up --build
```

Frontend → `http://localhost`  
Backend  → `http://localhost:5000`

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SECRET_KEY` | JWT signing secret |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | `http://localhost:5000/auth/spotify/callback` |
| `LASTFM_API_KEY` | Last.fm API key |
| `LASTFM_API_SECRET` | Last.fm shared secret |
| `FRONTEND_URL` | `http://localhost:3000` |

---

## ML Pipeline

1. **Feature extraction** — 8 audio features per track (energy, valence, danceability, tempo, acousticness, instrumentalness, loudness, speechiness)
2. **Normalisation** — StandardScaler
3. **Clustering** — KMeans (k=10) → cluster_id per song
4. **Dimensionality reduction** — PCA → 2D map coordinates + 3D galaxy coordinates (sphere projection)
5. **Similarity** — cosine similarity matrix + KNN (brute-force, cosine metric)
6. **Recommendations** — hybrid: 65% content-based (cosine on user profile) + 35% collaborative filtering

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/health` | Health check |
| GET | `/api/map/data` | Get song map data |
| POST | `/api/map/generate` | Run ML pipeline |
| GET | `/api/songs/search?q=` | Search songs |
| GET | `/api/songs/:id/similar` | Similar songs |
| POST | `/api/playlists/generate` | Generate mood playlist |
| GET | `/api/recommendations/:userId` | Get recommendations |
| POST | `/api/interactions` | Record interaction |
| GET | `/auth/spotify/login` | Spotify OAuth |
| GET | `/auth/lastfm/login` | Last.fm OAuth |
| GET | `/api/spotify/top-tracks` | Spotify top tracks |
| GET | `/api/lastfm/top-tracks` | Last.fm top tracks |

---

## Testing

```bash
# Backend unit tests
cd "melody map/backend"
pytest tests/ -v

# Frontend build check
cd "melody map/frontend"
npm run build
```

---

## Project Structure

```
melody map/
├── backend/
│   ├── app.py                  # Flask app, routes, middleware wiring
│   ├── config.py               # Environment config
│   ├── middleware/
│   │   ├── auth.py             # JWT decorators
│   │   └── rate_limit.py       # Sliding window rate limiter
│   ├── ml/
│   │   ├── similarity_engine.py  # KMeans, PCA, cosine similarity
│   │   └── recommendation_engine.py  # Hybrid recommender + KNN
│   ├── routes/
│   │   ├── spotify_auth.py     # Spotify OAuth flow
│   │   ├── spotify_data.py     # Spotify data proxy
│   │   ├── lastfm_auth.py      # Last.fm Web Auth flow
│   │   └── lastfm_data.py      # Last.fm data proxy
│   ├── utils/logger.py         # Structured JSON logger
│   ├── tests/                  # Pytest unit tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/              # MusicMap, Discover, Playlists, Analytics, Login
│   │   ├── components/         # Navbar, MusicSourceCard, PageLoader
│   │   ├── hooks/              # useMusicData, useDebounce
│   │   ├── services/           # api.js, musicService.js
│   │   └── store/              # Zustand store
│   └── Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```
