# Architecture

## Overview

Melody Map is a full-stack music identity platform. The frontend is a React SPA deployed on Vercel. The backend is a Flask API deployed on Render. They communicate over HTTPS — the backend is never directly visible to the user after authentication.

```
User Browser
    |
    +-- https://melodymap.site  (Vercel -- React SPA)
    |       |
    |       +-- API calls --> https://melody-map-wgv2.onrender.com  (Render -- Flask)
    |                                   |
    |                          +--------+---------+
    |                     MongoDB Atlas      Spotify / Last.fm / Pinterest / Unsplash APIs
    |
    +-- OAuth flows:
          Spotify: browser -> /auth/spotify/login -> Spotify -> /auth/spotify/callback -> frontend
          Last.fm: browser -> /auth/lastfm/login  -> Last.fm  -> /auth/lastfm/callback  -> frontend
```

---

## Frontend

**Stack:** React 18, Vite, Tailwind CSS, Framer Motion, React Three Fiber, Zustand, TanStack Query, Axios

### State Management

All global state lives in a single Zustand store (`useStore.js`). The central data hook `useMusicProfile.js` fetches `/api/music-profile` once, normalizes the response, computes personality archetypes and MBTI via `personalityEngine.js`, then writes everything to the store. Every page reads from the store -- no duplicate API calls.

```
useMusicProfile
    |
    +-- GET /api/music-profile  (once, cached in Zustand)
    +-- normalizeProfile()      (guarantees consistent field names)
    +-- computePersonality()    (6 archetypes, top-3 with % scores)
    +-- computeMBTI()           (4-axis derivation from audio features)
    +-- setMusicProfile()       -> Zustand store
```

### Routing

React Router v6 with lazy-loaded pages and AnimatePresence for spring-physics page transitions. All routes are protected except `/login`, `/spotify-success`, and `/lastfm-success`. A `vercel.json` SPA rewrite rule ensures all paths serve `index.html`.

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Identity overview, soul orb, top artists/tracks |
| `/galaxy` | MusicMap | 3D artist/genre visualization |
| `/discover` | Discover | Playlist concept generation |
| `/playlists` | Playlists | Spotify playlist management |
| `/analytics` | Analytics | Audio feature charts, metrics |
| `/soulmate` | MusicSoulmate | Compatibility scoring + constellation |
| `/aesthetic` | MusicAesthetic | Visual identity + image board |
| `/profile` | Profile | User settings |
| `/auralith` | Auralith | AI reasoning layer |

### Key Components

**MusicSoulOrb** -- A real-time 3D orb built with React Three Fiber. Its behavior is driven entirely by audio features: glow intensity from `energy`, pulse speed from `danceability`, surface distortion from `acousticness`, bloom brightness from `valence`. MBTI type maps to one of 11 motion presets that change rotation speed, distortion amplitude, and bloom multiplier.

**IdentityReveal** -- Cinematic reveal of the user's music identity: personality archetype, MBTI type, emotional profile, and a dynamically generated description.

**SoulmateMap** -- Constellation graph visualization of two users' shared and exclusive artists, built from the `graph` object returned by `/api/soulmate/compare`.

### Services Layer

`musicService.js` abstracts Spotify vs Last.fm so pages don't need to know which provider is active. It reads `localStorage.getItem('music_provider')` and routes calls to the appropriate API instance.

`api.js` defines Axios instances with request interceptors that automatically inject `X-Spotify-Token` or `X-Lastfm-Session` / `X-Lastfm-User` headers from localStorage.

`vibeTheme.js` dynamically updates CSS custom properties based on audio features, shifting the entire UI's color temperature as the profile loads.

---

## Backend

**Stack:** Python 3.9+, Flask 3.0, Flask-PyMongo, Flask-CORS, PyJWT, bcrypt, Gunicorn

### Application Structure

`app.py` is the entry point. It:
1. Imports all blueprints at the top (so import failures are visible immediately)
2. Lazy-loads ML engines in try/except blocks (so a scikit-learn failure does not kill routes)
3. Configures CORS to allow only `FRONTEND_URL`
4. Registers all blueprints
5. Defines core routes (auth, map, songs, playlists, recommendations, interactions)

### Blueprint Map

| Blueprint | Prefix | File |
|-----------|--------|------|
| `spotify_auth_bp` | (none) | `routes/spotify_auth.py` |
| `spotify_data_bp` | `/api` | `routes/spotify_data.py` |
| `lastfm_auth_bp` | (none) | `routes/lastfm_auth.py` |
| `lastfm_data_bp` | `/api` | `routes/lastfm_data.py` |
| `soulmate_bp` | `/api` | `routes/soulmate.py` |
| `aesthetic_bp` | (none -- routes define `/api/aesthetic/...` internally) | `routes/aesthetic.py` |
| `discover_bp` | (none -- routes define `/api/discover/...` internally) | `routes/discover.py` |
| `music_profile_bp` | (none -- route defines `/api/music-profile` internally) | `routes/music_profile.py` |
| `public_profile_bp` | (none -- route defines `/api/public-profile/...` internally) | `routes/public_profile.py` |
| `pinterest_bp` | (none -- route defines `/api/pinterest-aesthetic` internally) | `routes/pinterest_aesthetic.py` |
| `auralith_bp` | `/api` | `routes/auralith.py` |

### Config

`config.py` reads all environment variables via `python-dotenv`. The `_build_mongo_uri()` function re-encodes MongoDB credentials using `urllib.parse.quote_plus` to handle special characters in passwords (e.g. `@` becomes `%40`).

### Middleware

**`middleware/auth.py`** -- `@require_auth` and `@optional_auth` decorators. Validates JWT from `Authorization: Bearer` header, sets `g.user_id`.

**`middleware/rate_limit.py`** -- In-memory sliding window rate limiter. Applied per-route with `@rate_limit(max_requests=N, window_seconds=60)`.

---

## ML Layer

All ML modules live in `backend/ml/`. They are pure Python -- no Flask dependencies -- so they can be tested independently.

### music_profile_builder.py (services/)

The data aggregation pipeline. Called by `/api/music-profile`. Makes direct Spotify Web API calls to fetch top artists, top tracks, recently played, saved tracks, and audio features. Computes average audio features, genre frequency counts, aesthetic tags, galaxy nodes (3D coordinates positioned by audio features), and analytics metrics (mood, diversity score, nostalgia index, sonic brightness).

### aesthetic_engine.py

Converts a taste profile into visual identity data:
- `generate_aesthetic_name()` -- 2-3 word poetic label seeded by genre + energy + valence
- `generate_palette()` -- 5 hex colors from genre-specific palettes or audio feature ranges
- `generate_vibe_description()` -- sentence describing the emotional texture of the taste
- `generate_aesthetic_tags()` -- up to 18 visual search terms for Unsplash/Pinterest queries
- `classify_vibe()` -- maps energy/valence/tempo to one of 18 named vibe labels with accent hex colors
- `generate_poetic_persona()` -- full Music Identity Report with tagline and narrative paragraph
- `generate_shared_aesthetic()` -- combined aesthetic for soulmate pairs

### discover_engine.py

Generates personalized playlist concepts. Contains 10 PlaylistArchetype dataclasses. `_score_archetype()` weights energy/valence range match (70%) and genre overlap (30%). Top 3 archetypes are always included; remaining slots are randomly sampled for variety. `_harmonic_mood_vector()` cross-references genre + energy/valence bucket to produce a named aesthetic descriptor. Serendipity mode inverts the scoring.

### soulmate_engine.py

Computes taste compatibility using five weighted dimensions:

| Dimension | Weight | Method |
|-----------|--------|--------|
| Artist overlap | 40% | Jaccard similarity |
| Genre overlap | 25% | Jaccard similarity |
| Audio features | 20% | Cosine similarity (scikit-learn) |
| Track overlap | 10% | Jaccard similarity |
| Vibe proximity | 5% | Energy + valence distance |

`build_constellation_graph()` produces a node/link structure for the soulmate visualization.

### similarity_engine.py / recommendation_engine.py

Used by the internal map and recommendation routes. Handle feature extraction, StandardScaler normalization, K-Means clustering (10 clusters), PCA/3D dimensionality reduction, KNN similarity search, user profile building, content-based filtering, collaborative filtering, hybrid recommendations, and mood-based playlist generation.

These engines are lazy-loaded at startup -- if scikit-learn fails to import, all other routes still work; affected endpoints return 503.

---

## Database

MongoDB Atlas. Collections:

| Collection | Purpose |
|------------|---------|
| `users` | Email/password accounts, JWT auth |
| `taste_profiles` | Soulmate matching profiles (upserted per user) |
| `songs` | Song metadata + ML-generated coordinates |
| `playlists` | AI-generated playlists |
| `interactions` | User-song interactions (like, play, skip, save) |

---

## Data Flow

### Full profile load (Spotify user)

```
1. User visits app -> App.jsx rehydrates spotify_token from localStorage
2. useMusicProfile -> GET /api/music-profile (X-Spotify-Token header)
3. music_profile_builder.py -> Spotify Web API (top artists, tracks, audio features)
4. Returns normalized profile with galaxyNodes, aestheticTags, analyticsMetrics
5. normalizeProfile() -> computePersonality() + computeMBTI()
6. Zustand store updated -> all pages re-render with data
7. vibeTheme.js -> CSS custom properties updated -> UI color shifts
```

### Soulmate match flow

```
1. User syncs profile -> POST /api/soulmate/profile (stores in taste_profiles)
2. GET /api/soulmate/matches -> soulmate_engine.rank_matches() against all other profiles
3. User selects a match -> GET /api/soulmate/compare/<uid>
4. Returns score + breakdown + constellation graph
5. Frontend renders SoulmateMap with graph nodes/links
6. POST /api/aesthetic/shared -> generates combined aesthetic for the pair
```

### Discover flow

```
1. Frontend reads audioFeatures + genres from Zustand store
2. POST /api/discover/playlists with energy, valence, genres
3. discover_engine.generate_playlists() -> scores 10 archetypes -> returns concepts
4. Frontend receives seed_artists + seed_queries per concept
5. GET /api/spotify/recommendations with seed_artists -> real Spotify tracks
6. Playlist concepts rendered with real tracks
```

---

## Security

- JWT tokens signed with SECRET_KEY, 30-day expiry
- Passwords hashed with bcrypt
- CORS restricted to FRONTEND_URL only, with supports_credentials=True
- All sensitive config via environment variables -- never hardcoded
- MongoDB credentials re-encoded at startup to prevent URI injection
- Rate limiting on all public-facing endpoints
- Spotify tokens stored client-side in localStorage, never persisted server-side
- OAuth callbacks always redirect to FRONTEND_URL -- backend domain never shown to users
