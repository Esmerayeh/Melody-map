# Melody Map

Melody Map is a music identity platform powered by real listening behavior. It turns Spotify and Last.fm data into living identity surfaces: a taste galaxy, music identity reading, soul orb, atmosphere archive, recommendations, Auralith interpretations, and soulmate compatibility.

The product is built around one principle:

> Listening history is the source of truth.

No quiz typing, fake percentages, or disconnected moodboard logic should drive the core experience. Identity, recommendations, soulmates, visual atmosphere, and sharing all trace back to profile snapshots, artists, tracks, genres, audio features, recurrence, and temporal signals.

## App Surfaces

- Dashboard: an observatory for recent music identity signals.
- Galaxy: a living map of artist, genre, mood, and memory relationships.
- Discover: grounded recommendation capsules with evidence.
- Soulmates: Spotify-authenticated public profile links, compatibility scoring, combined galaxy, dual orb, duo identity, shared atmosphere, and share cards.
- Atmosphere: the visual subconscious of a listener, derived from sonic signals.
- Music Identity: Melody Map's original identity framework built from sonic axes and listening evidence.
- Soul Orb: a data-derived visual identity object.
- Identity Drift: temporal movement across listening phases.
- Auralith: an oracle-style interpreter grounded in stored profile and match context.

## Repository Layout

```text
backend/              Flask API, auth/session, routes, services, ML engines, training, tests
frontend/             Vite React app, route shell, feature surfaces, share/export utilities, tests
mobile/               React Native shell and API client
services/             Next-generation service scaffold and worker prototypes
infra/                Prometheus and Grafana provisioning
docs/                 Architecture, ML, QA, and product documentation
.github/workflows/    CI, preview, and canary workflows
```

For a detailed map of the active architecture, cleanup boundaries, and high-risk areas, see [docs/architecture/repo-map.md](docs/architecture/repo-map.md).

## Core Backend Systems

- `backend/app.py`: Flask application factory, middleware, blueprint registration, session bootstrap.
- `backend/routes/`: API route modules for auth, Spotify/Last.fm data, music profiles, identity, discovery, soulmates, sharing, and Auralith.
- `backend/services/music_profile_builder.py`: Spotify-first profile aggregation and derived feature construction.
- `backend/services/feature_store.py`: local/Mongo-backed profile snapshots, events, public profiles, social requests, and recommendation feedback.
- `backend/services/listening_identity.py`: temporal identity and behavioral signal helpers.
- `backend/ml/discover_engine.py`: recommendation reasoning from profile evidence.
- `backend/ml/soulmate_engine.py`: multi-layer soulmate compatibility, combined galaxy/orb/identity/atmosphere, and dual recommendations.
- `backend/ml/aesthetic_engine.py`: visual atmosphere interpretation.
- `backend/ml/training/` and `backend/ml/serving/`: retrieval, ranking, FAISS, training, and evaluation modules.

## Core Frontend Systems

- `frontend/src/App.jsx`: route shell, protected-route behavior, lazy loading, and bootstrap flow.
- `frontend/src/app/AuthBootstrap.jsx`: session hydration through backend bootstrap state.
- `frontend/src/pages/`: route-level product surfaces.
- `frontend/src/features/galaxy/`: interactive galaxy model, scene, controls, inspectors, and interaction store.
- `frontend/src/features/orb/`: orb profile, shader, themes, and controller logic.
- `frontend/src/components/share/`: shareable identity, soul orb, and soulmate export cards.
- `frontend/src/utils/shareUtils.js`: reusable Web Share, clipboard, WhatsApp, Instagram fallback, and PNG export helpers.
- `frontend/src/utils/musicIdentityEngine.js`: client-side Music Identity model for frontend fallback and presentation.
- `frontend/src/services/profileAdapters.js`: compatibility layer between backend profile envelopes and UI expectations.

## Development

Backend:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Validation:

```bash
backend\venv\Scripts\python.exe -m pytest backend\tests -q
cd frontend && npm run build
node --test tests\*.test.js
```

## Documentation

- [Repository map](docs/architecture/repo-map.md)
- [Mobile readiness checklist](docs/qa/mobile-readiness-checklist.md)
- [Verification notes](docs/verification.md)
- [API documentation](API_DOCUMENTATION.md)
- [Architecture notes](ARCHITECTURE.md)
- [ML pipeline notes](ML_PIPELINE.md)
- [Deployment guide](DEPLOYMENT.md)

Some older root-level docs are retained as reference material until they are refreshed into the `docs/` hierarchy. New documentation should live under `docs/` by domain.
