# Getting Started

## What is Melody Map?

Melody Map is an AI-powered music identity engine. Connect your Spotify or Last.fm account and it builds a psychological and aesthetic model of your taste — personality archetypes, a Music MBTI type, a living 3D soul orb, a visual aesthetic board, soulmate compatibility scoring, and personalized playlist concepts.

It's not a recommender. It's a mirror.

---

## Prerequisites

- Python 3.9+
- Node.js 18+
- A Spotify account (free or premium) — or a Last.fm account
- MongoDB (local install, or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster)

---

## 1. Clone the repo

```bash
git clone https://github.com/yourusername/melody-map.git
cd melody-map
```

---

## 2. Get API credentials

### Spotify (required for full experience)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Under Edit Settings → Redirect URIs, add:
   ```
   http://127.0.0.1:5000/auth/spotify/callback
   ```
4. Copy your Client ID and Client Secret

### Last.fm (optional — alternative to Spotify)

1. Go to [last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Create an API account
3. Copy your API Key and Shared Secret

### Unsplash (optional — for aesthetic board images)

1. Go to [unsplash.com/developers](https://unsplash.com/developers)
2. Create an app
3. Copy your Access Key

---

## 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/melodymap
SECRET_KEY=any-random-string-here

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/auth/spotify/callback

LASTFM_API_KEY=your_lastfm_api_key
LASTFM_API_SECRET=your_lastfm_api_secret
LASTFM_REDIRECT_URI=http://127.0.0.1:5000/auth/lastfm/callback

UNSPLASH_ACCESS_KEY=your_unsplash_key

FRONTEND_URL=http://localhost:5173
FLASK_ENV=development
PORT=5000
```

Start the backend:

```bash
python app.py
```

You should see:
```
INFO  mongo_connected
INFO  blueprints_registered
```

Backend runs on `http://127.0.0.1:5000`.

---

## 4. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:5000
```

Start the frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## 5. Open the app

Visit `http://localhost:5173`.

1. Register an account (email + password)
2. On the login page, click "Connect Spotify" or "Connect Last.fm"
3. Authorize the app — you'll be redirected back to the frontend
4. Your music profile loads automatically

---

## What happens after you connect

Once Spotify is connected, `useMusicProfile` fetches your top artists, top tracks, recently played, saved tracks, and audio features from the Spotify API. This takes a few seconds on first load.

From that data, the app computes:
- Your top 3 personality archetypes (Dreamy, Nostalgic, Chaotic, Romantic, Melancholic, Cosmic)
- Your Music MBTI type (one of 16 types derived from audio features + genre diversity)
- Galaxy node positions for the 3D artist map
- Aesthetic tags for the visual identity board
- Analytics metrics (mood, energy score, nostalgia index, diversity score)

All of this is cached in Zustand — navigating between pages doesn't re-fetch.

---

## Pages overview

| Route | What it does |
|-------|-------------|
| `/` | Dashboard — soul orb, identity summary, top artists/tracks |
| `/galaxy` | 3D artist/genre map — explore your taste as a star system |
| `/discover` | Playlist concepts generated from your audio profile |
| `/playlists` | Your Spotify playlists |
| `/analytics` | Audio feature charts, mood metrics, nostalgia index |
| `/soulmate` | Find your music soulmate — compatibility scoring |
| `/aesthetic` | Visual identity board — colors, images, vibe description |
| `/auralith` | AI reasoning layer — natural language music insights |
| `/profile` | Account settings |

---

## Using the Soulmate feature

The soulmate system requires at least two users to have synced profiles.

1. Go to `/soulmate`
2. Click "Sync My Profile" — this stores your taste data in the database
3. Share your profile link with someone else
4. Once they sync, you'll appear in each other's matches
5. Click a match to see the full compatibility breakdown and constellation graph

---

## Using the Discover feature

1. Go to `/discover`
2. Your audio features are sent to the backend automatically
3. The engine scores 10 playlist archetypes against your taste profile
4. Each concept shows a title, description, "why it fits you", mood tags, and seed artists
5. Toggle "Serendipity mode" to get recommendations from outside your usual taste

---

## Troubleshooting

**Backend won't start**
- Check that MongoDB is running: `mongosh` (or use Atlas)
- Verify all required env vars are set in `backend/.env`
- Port 5000 in use? Change `PORT=5001` in `.env`

**"Spotify token missing" error**
- Make sure `VITE_API_URL` in `frontend/.env` points to `http://127.0.0.1:5000` (not `localhost`)
- Spotify's post-2025 rules reject `localhost` as a redirect URI hostname — use `127.0.0.1`

**OAuth redirects to wrong URL**
- Confirm `FRONTEND_URL` in `backend/.env` is `http://localhost:5173`
- Confirm `SPOTIFY_REDIRECT_URI` is `http://127.0.0.1:5000/auth/spotify/callback`
- Confirm the same redirect URI is registered in your Spotify app settings

**Profile loads but soul orb is grey / "Tuning your frequency..."**
- This is the fallback state — personality data hasn't computed yet
- Wait for the full profile fetch to complete (watch the network tab)
- If it persists, check the browser console for errors from `useMusicProfile`

**Aesthetic board shows placeholder images**
- `UNSPLASH_ACCESS_KEY` is not set — add it to `backend/.env`
- The app falls back to Picsum placeholders automatically

**ML endpoints return 503**
- scikit-learn failed to import at startup — check terminal logs for `ml_engines_failed`
- Only affects `/api/map/generate`, `/api/songs/<id>/similar`, and `/api/playlists/generate`
- All other routes work normally

---

## Production deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Render + Vercel + MongoDB Atlas setup.
