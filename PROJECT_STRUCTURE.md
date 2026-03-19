# Project Structure

```
melody-map/
├── README.md
├── API_DOCUMENTATION.md
├── ARCHITECTURE.md
├── DEPLOYMENT.md
├── GETTING_STARTED.md
├── ML_PIPELINE.md
├── PROJECT_STRUCTURE.md
├── DATABASE_SCHEMA.md
├── SETUP.sh
├── docker-compose.yml
│
├── backend/
│   ├── app.py                          # Flask app entry point, blueprint registration, core routes
│   ├── config.py                       # Environment config, MongoDB URI encoding
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env / .env.example
│   │
│   ├── routes/
│   │   ├── spotify_auth.py             # GET /auth/spotify/login, /callback, POST /auth/spotify/refresh
│   │   ├── spotify_data.py             # GET /api/spotify/me, top-tracks, top-artists, playlists, etc.
│   │   ├── lastfm_auth.py              # GET /auth/lastfm/login, /callback
│   │   ├── lastfm_data.py              # GET /api/lastfm/me, top-tracks, top-artists, recent-tracks, etc.
│   │   ├── music_profile.py            # GET /api/music-profile
│   │   ├── discover.py                 # POST/GET /api/discover/playlists
│   │   ├── soulmate.py                 # POST /api/soulmate/profile, GET /matches, /compare/<id>
│   │   ├── aesthetic.py                # POST /api/aesthetic, /vibe, /identity, /shared, etc.
│   │   ├── pinterest_aesthetic.py      # POST /api/pinterest-aesthetic
│   │   ├── public_profile.py           # GET /api/public-profile/<username_or_id>
│   │   └── auralith.py                 # POST /api/auralith/generate-playlist, analyze-taste, etc.
│   │
│   ├── ml/
│   │   ├── aesthetic_engine.py         # Visual identity (name, palette, vibe, persona, tags)
│   │   ├── discover_engine.py          # Playlist concepts (10 archetypes, HMV, serendipity)
│   │   ├── soulmate_engine.py          # Compatibility scoring + constellation graph
│   │   ├── similarity_engine.py        # K-Means, PCA, KNN similarity search
│   │   └── recommendation_engine.py    # Content-based + collaborative + hybrid recs
│   │
│   ├── services/
│   │   ├── music_profile_builder.py    # Spotify data aggregation pipeline
│   │   ├── auralith_engine.py          # AI reasoning engine
│   │   └── spotify_service.py          # Spotify API helpers
│   │
│   ├── middleware/
│   │   ├── auth.py                     # @require_auth, @optional_auth JWT decorators
│   │   └── rate_limit.py               # @rate_limit sliding window decorator
│   │
│   ├── models/
│   │   └── schemas.py
│   │
│   ├── utils/
│   │   └── logger.py                   # Structured JSON logger
│   │
│   ├── data/
│   │   ├── auralith_songs.json
│   │   └── sample_songs.json
│   │
│   └── tests/
│       ├── test_recommendation_engine.py
│       ├── test_similarity_engine.py
│       └── test_soulmate_engine.py
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json                     # SPA rewrite rule for React Router
    ├── .env
    │
    └── src/
        ├── main.jsx
        ├── App.jsx                     # Router, auth rehydration, vibe theme, AnimatePresence
        ├── index.css
        │
        ├── pages/
        │   ├── Dashboard.jsx           # / — identity overview, soul orb, top artists/tracks
        │   ├── MusicMap.jsx            # /galaxy — 3D artist/genre visualization
        │   ├── Discover.jsx            # /discover — playlist concept generation
        │   ├── Playlists.jsx           # /playlists — Spotify playlist management
        │   ├── Analytics.jsx           # /analytics — audio feature charts, metrics
        │   ├── MusicSoulmate.jsx       # /soulmate — compatibility scoring + constellation
        │   ├── MusicAesthetic.jsx      # /aesthetic — visual identity + image board
        │   ├── Auralith.jsx            # /auralith — AI reasoning layer
        │   ├── Profile.jsx             # /profile — account settings
        │   ├── Login.jsx               # /login — auth + OAuth connect buttons
        │   ├── SpotifySuccess.jsx      # /spotify-success — Spotify OAuth callback handler
        │   └── LastfmSuccess.jsx       # /lastfm-success — Last.fm OAuth callback handler
        │
        ├── components/
        │   ├── MusicSoulOrb.jsx        # Living 3D identity orb (R3F + Bloom)
        │   ├── IdentityReveal.jsx      # Cinematic personality + MBTI reveal
        │   ├── SoulmateMap.jsx         # Constellation graph visualization
        │   ├── MusicIdentityPanel.jsx  # Identity summary panel
        │   ├── CompatibilityCard.jsx   # Soulmate match card
        │   ├── MusicSourceCard.jsx     # Spotify/Last.fm connect card
        │   ├── SpotifyConnect.jsx      # Spotify connection flow
        │   ├── HeroScene.jsx           # Landing hero visual
        │   ├── VibeEmitter.jsx         # Ambient vibe particle effect
        │   ├── Sidebar.jsx             # Desktop navigation sidebar
        │   ├── TopBar.jsx              # Top navigation bar
        │   ├── BottomNav.jsx           # Mobile bottom navigation
        │   └── PageLoader.jsx          # Suspense fallback loader
        │
        ├── hooks/
        │   ├── useMusicProfile.js      # Central data hook — fetch, normalize, cache in Zustand
        │   ├── useMusicData.js
        │   └── useDebounce.js
        │
        ├── services/
        │   ├── api.js                  # Axios instances + request interceptors
        │   ├── musicService.js         # Spotify/Last.fm abstraction layer
        │   ├── musicAnalyzer.js        # Client-side audio feature utilities
        │   └── vibeTheme.js            # CSS custom property updates from audio features
        │
        ├── store/
        │   └── useStore.js             # Zustand global store
        │
        └── utils/
            ├── personalityEngine.js    # computePersonality, computeMBTI, computeAdvancedCompatibility
            └── musicMapper.js          # Data normalization utilities
```

---

## Key file relationships

**Data flow from API to UI:**
```
useMusicProfile.js
  -> api.js (injects X-Spotify-Token header automatically)
  -> GET /api/music-profile
  -> music_profile_builder.py (Spotify data aggregation)
  -> normalizeProfile() -> computePersonality() + computeMBTI()
  -> useStore.js (Zustand)
  -> Dashboard, Analytics, MusicSoulOrb, etc. (read from store)
```

**OAuth flow:**
```
Login.jsx
  -> window.location.href = VITE_API_URL + /auth/spotify/login
  -> spotify_auth.py -> Spotify -> /auth/spotify/callback
  -> redirect to FRONTEND_URL/spotify-success?token=...
  -> SpotifySuccess.jsx (stores token, sets Zustand state)
  -> navigate("/")
```

**Soulmate flow:**
```
MusicSoulmate.jsx
  -> POST /api/soulmate/profile
  -> GET /api/soulmate/matches
  -> GET /api/soulmate/compare/<uid>  (score + breakdown + graph)
  -> SoulmateMap.jsx (renders constellation)
  -> POST /api/aesthetic/shared (combined aesthetic)
```

**Discover flow:**
```
Discover.jsx
  -> reads audioFeatures + genres from Zustand
  -> POST /api/discover/playlists
  -> discover_engine (scores 10 archetypes, returns seed_artists + seed_queries)
  -> GET /api/spotify/recommendations?seed_artists=... (real tracks)
```

---

## Config files

| File | Purpose |
|------|---------|
| `backend/config.py` | All env vars, MongoDB URI encoding |
| `backend/.env` | Local secrets (never committed) |
| `backend/.env.example` | Template for contributors |
| `frontend/vite.config.js` | Vite build config |
| `frontend/tailwind.config.js` | Tailwind theme |
| `frontend/vercel.json` | SPA rewrite rule |
| `frontend/.env` | VITE_API_URL |
| `docker-compose.yml` | Local full-stack with containerized MongoDB |
