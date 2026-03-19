# Melody Map

**Your music, understood. Not just played.**

Melody Map is an AI-powered music identity engine that transforms your listening history into a living portrait of who you are. It doesn't just recommend songs — it builds a psychological and aesthetic model of your taste, then renders it visually, emotionally, and analytically.

Connect Spotify or Last.fm. Watch your identity emerge.

---

## What is Melody Map

Most music apps tell you what to listen to next. Melody Map tells you *who you are* through what you've already listened to.

It computes your music personality across six archetypes, derives your Music MBTI from listening behavior, maps your artists into a 3D galaxy, generates a living soul orb that breathes with your audio features, finds your music soulmate through weighted compatibility scoring, and builds a visual aesthetic board from your genre fingerprint.

The result is a system that feels less like a dashboard and more like a mirror.

---

## Core Features

### Music Identity System

The personality engine (`personalityEngine.js`) scores your listening data against six archetypes — Dreamy, Nostalgic, Chaotic, Romantic, Melancholic, and Cosmic — using weighted audio feature formulas. Each archetype has a distinct scoring function built from `energy`, `valence`, `acousticness`, `instrumentalness`, and `tempo`.

On top of that, a Music MBTI is computed across four axes:
- **I/E** — acousticness + inverse danceability → introversion signal
- **N/S** — genre diversity across your top artists → intuition vs sensing
- **T/F** — instrumentalness + inverse valence → thinking vs feeling
- **J/P** — popularity spread across your artist list → judging vs perceiving

This produces one of 16 types, each with a named identity (e.g. INFP = "The Dream Listener", ENTP = "The Genre Disruptor").

All computation runs once in `useMusicProfile.js` and is cached in Zustand — no duplicate work across pages.

### Identity Reveal

The `IdentityReveal` component delivers a cinematic reveal of your music identity — personality archetype, MBTI type, emotional profile, and a dynamically generated description. It's designed to feel like a moment, not a data dump.

### Music Galaxy

The `/galaxy` route renders your top artists and genres as a 3D node graph using React Three Fiber. Artists are positioned in 3D space based on their audio feature coordinates — energy on Y, valence on X, danceability on Z — and clustered by genre. Node size scales with artist popularity. Genre nodes orbit at calculated radii; artist nodes cluster around their primary genre.

The galaxy data is built server-side in `music_profile_builder.py` via `_build_galaxy_nodes()`.

### Living Soul Orb

`MusicSoulOrb.jsx` is a real-time 3D orb that behaves according to your audio features:

- Primary color ← top personality archetype color
- Secondary color ← second archetype color
- Glow intensity ← `energy`
- Pulse speed ← `danceability`
- Surface distortion softness ← `acousticness`
- Bloom brightness ← `valence`

MBTI type maps to a motion preset — INFP pulses slowly and softly, ENFP blazes fast and bright, INTJ rotates with tight precision. The orb also generates an artistic label like "Soft chaos in minor key" or "Electric fracture at full volume" from your archetype + MBTI combination.

Built with `@react-three/fiber`, `MeshDistortMaterial`, and `@react-three/postprocessing` Bloom.

### Discover Engine

The backend `DiscoverEngine` (`discover_engine.py`) generates personalized playlist concepts from your taste profile. It scores 10 playlist archetypes (Nocturnal Drift, Golden Nostalgia, Neon Kinetic, Velvet Soul, Cosmic Expanse, Urban Pulse, Ethereal Bloom, Storm & Shadow, Global Reverie, Vaporwave Reverie) against your energy/valence/genre profile.

Each playlist concept includes a title, description, "why it fits you" message, mood tags, aesthetic tags, era tags, seed artists, and Spotify search queries. The frontend resolves real tracks via the Spotify API.

A **Harmonic Mood Vector** is computed for each session — a named aesthetic descriptor like "Liminal Space Nostalgia" or "Neon Petrichor Highway" derived from genre + audio feature cross-referencing.

**Serendipity mode** inverts the algorithm — it selects archetypes from the outer edges of your taste embedding, surfacing music you didn't know you loved.

### Soulmate System

`SoulmateEngine` (`soulmate_engine.py`) computes taste compatibility between two users using a weighted scoring model:

| Dimension | Weight | Method |
|-----------|--------|--------|
| Artist overlap | 40% | Jaccard similarity |
| Genre overlap | 25% | Jaccard similarity |
| Audio features | 20% | Cosine similarity |
| Track overlap | 10% | Jaccard similarity |
| Vibe proximity | 5% | Energy + valence distance |

Final score is 0–100. The engine also builds a **constellation graph** — a node/link structure mapping shared and exclusive artists between two profiles, used to render the soulmate visualization.

The frontend `computeAdvancedCompatibility()` in `personalityEngine.js` runs a parallel client-side version with genre (35%), artist (35%), and audio (30%) weights, plus sub-scores for mood alignment, discovery match, and listening era match.

### Aesthetic Engine

`aesthetic_engine.py` converts your music taste into a full visual aesthetic profile:

- **Aesthetic name** — a 2–3 word poetic label (e.g. "Midnight Cassette", "Neon Dreamscape") seeded by your genre + energy + valence
- **Color palette** — 5 hex colors derived from genre-specific palettes or audio feature ranges
- **Vibe description** — a sentence like "Your music taste feels electric, melancholic, and deeply atmospheric, washed in reverb and haze"
- **Aesthetic tags** — up to 18 visual search terms (e.g. "neon fog", "rainy window", "vintage film photography") used to query the Pinterest API
- **Hyper-specific vibe classifier** — maps energy/valence/tempo to 18 named vibe labels with accent colors (e.g. "Rainy Window Solitude #90e0ef", "Neon Euphoria Rush #ff6ec7")
- **Poetic persona** — a full Music Identity Report with tagline and narrative paragraph
- **Shared aesthetic** — for soulmate pairs, generates a combined aesthetic name and vibe description

### Auralith

Auralith is the AI reasoning layer within Melody Map. It lives at `/auralith` and is registered as a blueprint (`routes/auralith.py`) under the `/api` prefix. It processes your music taste data to generate deeper insights, narrative identity reports, and AI-driven responses about your listening patterns — going beyond what the rule-based engines can express.

---

## Architecture

```
User
 │
 ├─ Spotify OAuth / Last.fm OAuth
 │         │
 │         ▼
 │   Flask Backend (Render)
 │   ├── routes/spotify_auth.py   — OAuth flow, token exchange
 │   ├── routes/lastfm_auth.py    — Last.fm session auth
 │   ├── routes/music_profile.py  — /api/music-profile
 │   ├── routes/discover.py       — /api/discover
 │   ├── routes/soulmate.py       — /api/soulmate
 │   ├── routes/aesthetic.py      — /api/aesthetic
 │   ├── routes/pinterest_aesthetic.py — Pinterest API queries
 │   ├── routes/auralith.py       — /api/auralith (AI layer)
 │   ├── services/music_profile_builder.py — Spotify data aggregation
 │   ├── ml/aesthetic_engine.py   — Visual identity generation
 │   ├── ml/discover_engine.py    — Playlist concept generation
 │   ├── ml/soulmate_engine.py    — Compatibility scoring
 │   └── MongoDB (Atlas)          — Users, profiles, playlists
 │
 ▼
React Frontend (Vercel)
 ├── useMusicProfile.js    — Single fetch, normalize, cache in Zustand
 ├── personalityEngine.js  — MBTI + archetype computation (client-side)
 ├── MusicSoulOrb.jsx      — Living 3D identity orb (R3F)
 ├── MusicMap / Galaxy     — 3D artist/genre visualization
 ├── Discover              — Playlist concepts + Spotify resolution
 ├── MusicSoulmate         — Compatibility scoring + constellation
 ├── MusicAesthetic        — Visual identity + Pinterest board
 └── Auralith              — AI identity layer
```

**Data flow:** User authenticates → backend fetches Spotify data → `music_profile_builder.py` aggregates artists, tracks, audio features, genres, galaxy nodes, analytics → normalized profile cached in Zustand via `useMusicProfile` → all pages read from that single source → personality + MBTI computed once on the client → passed as props to visual components.

---

## Key Systems Deep Dive

**`useMusicProfile`** is the single source of truth for all music data. It fetches `/api/music-profile` once, normalizes the response to guarantee consistent field names, computes `personality` and `mbti` via `personalityEngine.js`, then stores everything in Zustand. Every page reads from the store — no duplicate API calls, no prop drilling.

**`personalityEngine.js`** is a pure-function module. `computePersonality(audioFeatures)` scores all six archetypes and returns the top 3 with normalized percentages. `computeMBTI(profile)` derives all four MBTI axes from audio features, genre diversity, artist popularity spread, and track data. `computeAdvancedCompatibility(profileA, profileB)` runs a full compatibility report with six sub-scores.

**Recommendation logic** in `DiscoverEngine` uses a scoring function that weights energy/valence range match (70%) and genre overlap (30%) to rank archetypes. The top 3 are always included; remaining slots are randomly sampled from the rest for variety. Serendipity mode inverts this — it anchors one familiar archetype and fills the rest from the lowest-scoring (most different) options.

**Compatibility scoring** in `SoulmateEngine` uses Jaccard similarity for set-based dimensions (artists, genres, tracks) and cosine similarity for the audio feature vector. The vibe dimension uses a simple energy + valence distance. All five scores are weighted and summed to produce a 0–100 match score.

**Aesthetic pipeline:** `music_profile_builder.py` builds `aestheticTags` from genre→tag mappings and audio feature ranges. The frontend sends these to `aesthetic_engine.py` which generates the aesthetic name, palette, vibe description, and Pinterest search queries. The `classify_vibe()` function maps the exact energy/valence/tempo coordinates to one of 18 named vibe labels with accent colors.

---

## Tech Stack

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Framer Motion — page transitions, component animations
- React Three Fiber + Three.js + `@react-three/drei` + `@react-three/postprocessing` — 3D orb, galaxy
- Zustand — global state
- TanStack Query — server state
- Recharts — analytics charts
- D3 — data visualization utilities
- Axios — HTTP client
- html2canvas — aesthetic board export

**Backend**
- Python + Flask
- Flask-PyMongo + MongoDB Atlas
- scikit-learn — KNN, PCA, clustering (similarity + recommendation engines)
- NumPy + SciPy — audio feature vectors
- PyJWT + bcrypt — auth
- Gunicorn — production server

**APIs**
- Spotify Web API — top artists, tracks, audio features, OAuth
- Last.fm API — scrobble history, top artists/tracks
- Pinterest API — aesthetic board image queries
- Unsplash API — aesthetic imagery

---

## Setup

### 1. Clone

```bash
git clone https://github.com/your-username/melody-map.git
cd melody-map
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/melodymap

# Spotify OAuth
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5000/auth/spotify/callback

# Last.fm
LASTFM_API_KEY=your_lastfm_api_key
LASTFM_API_SECRET=your_lastfm_api_secret
LASTFM_REDIRECT_URI=http://localhost:5000/auth/lastfm/callback

# Pinterest
PINTEREST_ACCESS_TOKEN=your_pinterest_token

# App
SECRET_KEY=your_jwt_secret
FRONTEND_URL=http://localhost:5173
FLASK_ENV=development
PORT=5000
```

Run the server:

```bash
python app.py
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Start the dev server:

```bash
npm run dev
```

### 4. Production environment variables

**Backend (Render)**

| Key | Value |
|-----|-------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `SPOTIFY_CLIENT_ID` | From Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | From Spotify Developer Dashboard |
| `SPOTIFY_REDIRECT_URI` | `https://your-backend.onrender.com/auth/spotify/callback` |
| `LASTFM_API_KEY` | From Last.fm API |
| `LASTFM_API_SECRET` | From Last.fm API |
| `LASTFM_REDIRECT_URI` | `https://your-backend.onrender.com/auth/lastfm/callback` |
| `PINTEREST_ACCESS_TOKEN` | From Pinterest Developer |
| `SECRET_KEY` | Random secret for JWT signing |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |

**Frontend (Vercel)**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-backend.onrender.com` |

---

## Folder Structure

```
melody-map/
├── backend/
│   ├── app.py                    # Flask app, blueprint registration, core routes
│   ├── config.py                 # Environment config
│   ├── routes/                   # Blueprint route handlers
│   │   ├── spotify_auth.py       # Spotify OAuth
│   │   ├── lastfm_auth.py        # Last.fm OAuth
│   │   ├── music_profile.py      # /api/music-profile
│   │   ├── discover.py           # /api/discover
│   │   ├── soulmate.py           # /api/soulmate
│   │   ├── aesthetic.py          # /api/aesthetic
│   │   ├── pinterest_aesthetic.py# Pinterest image queries
│   │   └── auralith.py           # /api/auralith (AI layer)
│   ├── ml/
│   │   ├── aesthetic_engine.py   # Visual identity generation
│   │   ├── discover_engine.py    # Playlist concept generation
│   │   ├── soulmate_engine.py    # Compatibility scoring
│   │   ├── similarity_engine.py  # KNN + PCA for music map
│   │   └── recommendation_engine.py
│   ├── services/
│   │   ├── music_profile_builder.py  # Spotify data aggregation pipeline
│   │   └── spotify_service.py
│   └── middleware/
│       ├── auth.py               # JWT middleware
│       └── rate_limit.py
│
└── frontend/
    ├── src/
    │   ├── pages/                # Route-level components
    │   ├── components/           # Shared UI components
    │   │   ├── MusicSoulOrb.jsx  # Living 3D identity orb
    │   │   ├── IdentityReveal.jsx# Cinematic identity reveal
    │   │   └── SoulmateMap.jsx   # Constellation visualization
    │   ├── hooks/
    │   │   └── useMusicProfile.js# Central data hook
    │   ├── utils/
    │   │   └── personalityEngine.js  # MBTI + archetype computation
    │   ├── services/
    │   │   ├── api.js            # Axios instances + interceptors
    │   │   └── musicService.js   # Spotify/Last.fm abstraction
    │   └── store/
    │       └── useStore.js       # Zustand global state
    └── vite.config.js
```

---

## UI

Dark background (`#0d0d14` surface), pastel gradients in purple, pink, and blue. Every page uses spring-physics transitions via Framer Motion — pages enter with a slight upward drift and blur-to-focus effect.

The galaxy is a deep-space 3D environment with glowing artist nodes. The soul orb pulses and breathes in real time. The aesthetic board renders as a mood board of visual tags. The soulmate constellation maps two users' shared and exclusive artists as a star graph.

The vibe theme system (`vibeTheme.js`) dynamically updates CSS custom properties based on your audio features — the entire UI shifts color temperature as your profile loads.

---

## Why This Stands Out

This isn't a CRUD app with a Spotify wrapper. Every layer has real logic:

- The personality engine uses weighted audio feature formulas, not genre labels
- The MBTI computation derives four independent axes from different data dimensions
- The discover engine scores 10 archetypes and computes a Harmonic Mood Vector per session
- The soulmate engine uses five weighted similarity metrics including cosine similarity on audio vectors
- The aesthetic engine maps 30 genres to visual tag sets, 18 vibe labels to hex colors, and generates poetic identity narratives
- The galaxy positions artists in 3D space using actual audio feature coordinates
- The soul orb has 11 MBTI motion presets that change its physical behavior

The system treats music taste as a multi-dimensional identity signal, not a playlist preference.

---

## Future Improvements

- Expand Auralith with a full RAG pipeline over listening history
- Real-time listening sync via Spotify webhooks
- Mobile app (React Native)
- Social soulmate matching across registered users
- Time-range identity drift — show how your personality has shifted over months
- Export identity card as shareable image (html2canvas foundation already in place)

---

## Author

Built with obsession over music, data, and the space between them.

