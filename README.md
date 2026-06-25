# Melody Map 🌌

> Your listening history as a living, breathing 3D universe.
> Every artist you love becomes a star. Your obsessions form gravity wells.
> Forgotten favorites drift as ghost constellations. At the center — your Soul Orb —
> pulses with everything you've ever felt through music.

**▶ Demo video:** https://1drv.ms/v/c/5b53b2250f49d353/IQCKNmR8KhfvR7_3RuoTUzp3ATw47c7eXsyXCSSOqTDr3p8?e=YZHW9v

**Stack:** React · Vite · React Three Fiber · Three.js · Framer Motion · Zustand · Flask/Python
**Tests:** 91 passing (Node's built-in runner, zero test dependencies)

---

## The idea

Music taste is deeply personal but invisibly stored — buried in play counts and playlists.
Spotify Wrapped gives you one flat snapshot per year; Last.fm gives you cold charts. Neither
shows you *who you are* as a listener, as a whole, right now.

Melody Map connects to your Spotify / Last.fm history and renders it as an explorable 3D galaxy.
Artist stars cluster by taste. Your most-repeated artist becomes a gravity well. Music you've
drifted from haunts the outer rim as ghost stars. Recommendations arrive as comets from the
frontier. It's always-on, spatial, and alive — not a report you read, a place you visit.

**One principle drives everything:**

> Listening history is the source of truth.

No quiz typing, no fake percentages, no disconnected moodboard logic. Identity, recommendations,
soulmate compatibility, visual atmosphere, and sharing all trace back to real signals — profile
snapshots, artists, tracks, genres, audio features, recurrence, and temporal patterns. When the
data isn't there, surfaces degrade honestly rather than inventing values.

## See it

```bash
cd frontend && npm install && npm run dev
# open http://localhost:3000/demo  — fully explorable, no login required
```

`/demo` runs on a curated set of **real** dream-pop / shoegaze / ambient artists (so every feature,
including in-galaxy playback, is demonstrable) and is clearly labeled *"Demo universe · not your
real data."* It never pretends to be a personal account.

**~90-second tour:** Galaxy materializes through a cinematic genesis sequence → Soul Orb ignites
at the center → hover a star for its place in your sky → **open a star and the actual song plays
inline** → comets decode into recommendations → export your Identity Passport → Auralith interprets
what a region of your taste means.

## What makes it technically interesting

This is a 3D web app that has to stay smooth and stay alive under real-world conditions. A few of
the engineering decisions behind that:

- **The galaxy self-heals from GPU context loss.** WebGL can drop its rendering context at any
  time — mobile tab backgrounding, memory pressure, driver hiccups. Most 3D web apps freeze to a
  permanent black canvas. Melody Map listens for `webglcontextlost`, shows a calm recovery overlay,
  and remounts the scene to rebuild a fresh context. The subtle part: a lost context also makes the
  R3F render loop *throw*, which the scene's error boundary catches — so the recovery state has to
  live **above** that boundary, or the remount gets unmounted before it can run. Verified by driving
  the `WEBGL_lose_context` extension end-to-end.

- **The song actually plays — through a live API deprecation.** Spotify deprecated track
  `preview_url` (it now returns `null`). Rather than fake a clip, opening a star embeds the official
  Spotify iframe player — the real, full track, with no extra scopes, tokens, or Web Playback SDK.
  The missing sensory beat, recovered honestly.

- **Disciplined frame loops.** ~20k stars are driven by a *single* consolidated `useFrame` over a
  ref map — no per-node React subscriptions, no `setState` in the animation loop. Shader color
  uniforms are computed once per palette change instead of allocating ~20 `THREE.Color` objects
  every frame. Imperatively-built geometries are disposed on change/unmount — closing the slow VRAM
  leak that itself triggers context loss. Targets 60fps with a reduced-particle low-power mode that
  auto-engages on phones.

- **Touch-first, accessible, resilient.** Damped touch camera (one-finger orbit, two-finger
  pinch-zoom, pan disabled so the camera can't fly off into empty space), enlarged tap targets on
  coarse pointers, `prefers-reduced-motion` honored throughout, keyboard deselect, and a graceful
  non-WebGL fallback so the app is never a blank screen.

- **Lean, well-cached bundle.** The first-paint shell ships ~112 KB gzip of JS (entry + React +
  router); the entire Three.js stack — `GalaxyScene`, post-processing/Bloom, and three.js itself
  (~210 KB gzip) — is lazy-split so it streams in *after* first paint instead of blocking it. Stable
  vendors (React, router, query, motion) are carved into their own chunks so an app deploy doesn't
  bust their cache for returning visitors. (`npm run build` prints the full chunk map.)

- **Event-driven state, not prop drilling.** Eight purpose-built Zustand stores (interaction,
  stage, audio, presence/events, profile, auth, experience) keep the galaxy, HUD, and orb decoupled
  — any component can emit a signal without threading props through the tree.

## Architecture

```
Frontend    React 18 + Vite 5 (JSX, TypeScript-ready)
3D engine   React Three Fiber 8 + Three.js 0.159 + custom GLSL (Soul Orb shaders)
State       Zustand 5 — 8 event-driven stores
Animation   Framer Motion 11 + custom R3F frame loops
Data        TanStack Query 5 + Axios
Auth        Spotify + Last.fm OAuth (token kept httpOnly server-side; Flask sessions)
Backend     Flask / Python on Render — profile aggregation, ML engines, Auralith oracle
Testing     Node.js built-in test runner (91 frontend tests) + pytest (backend)
```

The galaxy renders from **one persistent `<Canvas>`** that lives behind every route, so navigation
never tears down and rebuilds the scene. A camera/focus system eases between stars; a presence
state machine (active → idle → sleeping) lets the universe dim and drift when you step away.

## App surfaces

- **Galaxy** (`/universe`, the default route) — the living 3D map of artist, genre, mood, and memory relationships.
- **Soul Orb** — a data-derived visual identity object pulsing at the galaxy's center.
- **Discover** (`/discover`) — grounded recommendation capsules, each with its supporting evidence.
- **Playlists** (`/playlists`) — your connected playlists, surfaced as listening signal.
- **Music Identity** (`/identity`) — an identity reading built from sonic axes and listening evidence, including movement across temporal listening phases (identity drift).
- **Identity Passport** — your music DNA, exportable as a shareable card (PNG / Web Share).
- **Soulmates** (`/soulmate`) — Spotify-authenticated compatibility, combined galaxy, dual orb, shared atmosphere.
- **Atmosphere** (`/aesthetic`) — the visual subconscious of a listener, derived from sonic signals.
- **Auralith** (`/auralith`) — an oracle-style interpreter grounded in stored profile and match context; calls a real LLM when one is configured (`AURALITH_LLM_*` env vars) and falls back to a deterministic, grounded explanation otherwise.

> Earlier routes are consolidated: `/dashboard` and `/` redirect to `/universe`, while `/analytics` and `/identity-drift` redirect into `/identity`.

## Repository layout

```text
backend/    Flask API, auth/session, routes, services, ML engines, training, tests  ← the live backend
frontend/   Vite React app, route shell, feature surfaces, share/export utilities, tests  ← the live app
infra/      Prometheus and Grafana provisioning
docs/       Architecture, ML, QA, and product documentation
mobile/     React Native shell + API client — early scaffold, not a shipping app
services/   FastAPI "next-gen" service scaffold — exploratory, not wired into the running stack
```

The two surfaces that actually run are `backend/` (Flask) and `frontend/` (Vite). `mobile/` and
`services/` are kept for reference but are not part of the deployed application.

Key frontend systems live in `frontend/src/features/galaxy/` (galaxy model, scene, controls,
inspector, interaction store), `frontend/src/features/orb/` (orb profile, shaders, controller),
and `frontend/src/features/universe/` (comets, gravity wells, memory belt, genesis sequence).
For a detailed map of the active architecture, see [docs/architecture/repo-map.md](docs/architecture/repo-map.md).

## Running locally

**Frontend**
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000  (try /demo for the no-login preview)
```

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Testing & build

```bash
cd frontend && npm test     # 91 tests, Node's built-in runner (no Jest/Vitest)
cd frontend && npm run build
backend\venv\Scripts\python.exe -m pytest backend\tests -q
```

## Documentation

- [Architecture notes](ARCHITECTURE.md)
- [Repository map](docs/architecture/repo-map.md)
- [API documentation](API_DOCUMENTATION.md)
- [ML pipeline notes](ML_PIPELINE.md)
- [Deployment guide](DEPLOYMENT.md)
- [Mobile readiness checklist](docs/qa/mobile-readiness-checklist.md)

---

*Built as an exploration of what a music app feels like when your taste is a place you can visit,
not a chart you scroll.*
