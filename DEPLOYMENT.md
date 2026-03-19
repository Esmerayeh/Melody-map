# Deployment

Melody Map runs on two separate services:
- Frontend: Vercel — `https://melodymap.site`
- Backend: Render — `https://melody-map-wgv2.onrender.com`

---

## Production Stack

| Layer | Service | Notes |
|-------|---------|-------|
| Frontend | Vercel | Auto-deploys from `frontend/` on push |
| Backend | Render | Docker container, Gunicorn |
| Database | MongoDB Atlas | Free tier M0 works for dev |
| Images | Unsplash API | Aesthetic board photos |
| Pins | Pinterest API | Optional — falls back to Unsplash |

---

## Backend — Render

### Dockerfile

The backend ships with a `backend/Dockerfile`. Render builds and runs it automatically.

```dockerfile
# backend/Dockerfile (already present in repo)
```

Render runs Gunicorn as the production server. Make sure `gunicorn` is in `requirements.txt` (it is).

### Environment Variables (Render Dashboard)

Set these under your Render service → Environment:

```
MONGODB_URI          mongodb+srv://<user>:<password>@cluster.mongodb.net/melodymap?retryWrites=true&w=majority
SECRET_KEY           <random 32+ char string>

SPOTIFY_CLIENT_ID    <from Spotify Developer Dashboard>
SPOTIFY_CLIENT_SECRET <from Spotify Developer Dashboard>
SPOTIFY_REDIRECT_URI https://melody-map-wgv2.onrender.com/auth/spotify/callback

LASTFM_API_KEY       <from Last.fm API account>
LASTFM_API_SECRET    <from Last.fm API account>
LASTFM_REDIRECT_URI  https://melody-map-wgv2.onrender.com/auth/lastfm/callback

UNSPLASH_ACCESS_KEY  <from Unsplash Developer>
PINTEREST_ACCESS_TOKEN <from Pinterest Developer — optional>

FRONTEND_URL         https://melodymap.site
FLASK_ENV            production
PORT                 5000
```

Important notes:
- `MONGODB_URI` passwords with special characters (e.g. `@`) are safe — `config.py` re-encodes credentials with `urllib.parse.quote_plus` at startup.
- `SPOTIFY_REDIRECT_URI` must exactly match what's registered in your Spotify app settings. Spotify no longer accepts `localhost` — use the Render URL for production, `http://127.0.0.1:5000/auth/spotify/callback` for local dev.
- `FRONTEND_URL` is the single source of truth for all OAuth redirects. Never hardcode the Render URL in redirect logic.

### Spotify App Settings

In your Spotify Developer Dashboard → your app → Edit Settings → Redirect URIs, add:
```
https://melody-map-wgv2.onrender.com/auth/spotify/callback
http://127.0.0.1:5000/auth/spotify/callback
```

### Last.fm App Settings

In your Last.fm API account settings, set the callback URL to:
```
https://melody-map-wgv2.onrender.com/auth/lastfm/callback
```

---

## Frontend — Vercel

### Environment Variables (Vercel Dashboard)

Under your Vercel project → Settings → Environment Variables:

```
VITE_API_URL    https://melody-map-wgv2.onrender.com
```

### vercel.json

The `frontend/vercel.json` SPA rewrite rule is already in place:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

This ensures React Router handles all routes — without it, direct URL access to `/galaxy` or `/soulmate` returns 404.

### Deploy

Vercel auto-deploys when you push to your connected branch. To deploy manually:

```bash
cd frontend
npm run build
# then push to git, or use Vercel CLI: vercel --prod
```

---

## Local Development

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB (local or Atlas free tier)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your values
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

Local `.env` minimum:

```env
MONGODB_URI=mongodb://localhost:27017/melodymap
SECRET_KEY=any-local-secret
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/auth/spotify/callback
LASTFM_API_KEY=your_key
LASTFM_API_SECRET=your_secret
LASTFM_REDIRECT_URI=http://127.0.0.1:5000/auth/lastfm/callback
FRONTEND_URL=http://localhost:5173
FLASK_ENV=development
```

### Frontend

```bash
cd frontend
npm install
# create frontend/.env:
# VITE_API_URL=http://127.0.0.1:5000
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Docker Compose (local full-stack)

A `docker-compose.yml` is included at the repo root for running the full stack locally with a containerized MongoDB.

```bash
docker-compose up --build
```

Services:
- `backend` → `http://localhost:5000`
- `frontend` → `http://localhost:3000`
- `mongodb` → `mongodb://localhost:27017`

For Docker, set `MONGODB_URI=mongodb://mongodb:27017/melodymap` in the backend service environment (uses the container hostname `mongodb`).

---

## MongoDB Atlas Setup

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user with read/write access
3. Whitelist `0.0.0.0/0` (or Render's IP range) under Network Access
4. Get the connection string: `mongodb+srv://<user>:<password>@cluster.mongodb.net/melodymap`
5. If your password contains special characters, `config.py` handles encoding automatically

Recommended indexes (run once after first deploy):

```js
db.users.createIndex({ email: 1 }, { unique: true })
db.taste_profiles.createIndex({ user_id: 1 }, { unique: true })
db.taste_profiles.createIndex({ username: 1 })
db.songs.createIndex({ title: "text", artist: "text", album: "text" })
db.songs.createIndex({ cluster_id: 1 })
db.interactions.createIndex({ user_id: 1, timestamp: -1 })
```

---

## Troubleshooting

**Backend returns 502 on Render**
- Check Render logs for startup errors
- Verify `MONGODB_URI` is set and the Atlas cluster is accessible
- Confirm `gunicorn` is in `requirements.txt`

**OAuth redirects to Render URL instead of frontend**
- Verify `FRONTEND_URL` is set correctly in Render env vars
- Check that `SPOTIFY_REDIRECT_URI` / `LASTFM_REDIRECT_URI` point to the Render backend, not the frontend

**Spotify callback fails with `invalid_client`**
- Double-check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- Confirm the redirect URI in Render env vars exactly matches what's registered in Spotify Dashboard

**Last.fm callback fails**
- Confirm `LASTFM_REDIRECT_URI` in Render env vars matches the callback URL in your Last.fm app settings
- Check `LASTFM_API_KEY` and `LASTFM_API_SECRET` are correct

**Frontend shows blank page on direct URL access**
- Confirm `frontend/vercel.json` has the SPA rewrite rule
- Redeploy on Vercel after adding it

**ML endpoints return 503**
- This means scikit-learn failed to import at startup — check Render logs for the `ml_engines_failed` log line
- All other routes still work; only `/api/map/generate`, `/api/songs/<id>/similar`, and `/api/playlists/generate` are affected
