# Melody Map Repository Map

This document is the canonical structure guide for Melody Map after the repository cleanup pass. It separates active production code from scaffolds, generated artifacts, and high-risk systems that should be changed carefully.

## Top-Level Structure

```text
backend/              Flask API, auth/session, music profile services, ML engines, tests
frontend/             Vite React app, route shell, feature surfaces, share/export utilities
mobile/               React Native shell and shared API client
services/             Next-generation API/worker scaffold; not the current production path
infra/                Prometheus and Grafana provisioning for platform observability
docs/                 Architecture, ML, QA, product, and operational documentation
.github/workflows/    CI, preview deploy, and canary release workflows
```

## Frontend Architecture

`frontend/src/App.jsx` owns routing, route-level lazy loading, shell layout, auth guard behavior, and bootstrap-aware protected routes.

Active route pages live in `frontend/src/pages/`:

- `Dashboard.jsx`: observatory surface for profile, mood, artists, tracks, and orb preview.
- `Discover.jsx`: grounded recommendation and signal-stream experience.
- `MusicMap.jsx`: interactive taste galaxy.
- `MusicSoulmate.jsx`: profile link creation, soulmate comparison, combined galaxy, dual orb, duo identity, shared atmosphere, Auralith questions, and sharing.
- `MusicIdentity.jsx`: Music Identity reading and export surface.
- `MusicAesthetic.jsx`: currently the visual atmosphere/dream archive surface. The file name is legacy; user-facing copy should avoid "Aesthetic" as the product name.
- `IdentityDrift.jsx`: identity evolution and drift surface.
- `Auralith.jsx`: listener interpretation surface.
- `Analytics.jsx`, `Profile.jsx`, `Playlists.jsx`, `Login.jsx`, `SpotifySuccess.jsx`, `LastfmSuccess.jsx`: supporting product and auth routes.

Feature domains:

- `features/galaxy/`: galaxy graph building, scoring, explanations, scene, controls, inspector, and interaction store.
- `features/orb/`: soul orb model, shader, themes, and controller.
- `components/premium/`: reusable cosmic/glass visual primitives.
- `components/share/`: reusable share-card surfaces for soul orb and soulmates.
- `components/identity/`: shareable identity card and export helper.
- `components/shell/`: route/module skeletons and boundaries.
- `hooks/`: profile, route readiness, backend wake, adaptive experience, live signal, debounce.
- `services/`: API clients, profile adapters, music provider abstraction, analysis helpers.
- `store/`: Zustand auth, profile, global app, and experience stores.
- `utils/`: share utilities and Music Identity fallback logic.

## Backend Architecture

`backend/app.py` is the current production API entry point. It initializes Mongo, registers blueprints, wires auth/session context, exposes metrics, and provides compatibility bootstrap endpoints.

Active route domains:

- `routes/spotify_auth.py`, `routes/spotify_data.py`: Spotify OAuth, app-session minting, and Spotify proxy endpoints.
- `routes/lastfm_auth.py`, `routes/lastfm_data.py`: Last.fm OAuth/session and data proxy endpoints.
- `routes/music_profile.py`: profile snapshot and music profile access.
- `routes/identity.py`: Music Identity API surface.
- `routes/discover.py`: recommendation surface.
- `routes/soulmate.py`, `routes/social.py`, `routes/public_profile.py`: compatibility, public profile slugs, social requests, privacy-safe sharing.
- `routes/share.py`: share/link normalization helpers.
- `routes/aesthetic.py`, `routes/pinterest_aesthetic.py`: atmosphere/aesthetic generation and visual reference fallback.
- `routes/auralith.py`: listener and soulmate interpretation endpoints.
- `routes/recommendation_events.py`: feedback and recommendation event tracking.

Core services:

- `services/music_profile_builder.py`: Spotify-first data aggregation into normalized profile artifacts.
- `services/feature_store.py`: Mongo/local feature store for profile snapshots, public profiles, social requests, events, and cached artifacts.
- `services/listening_identity.py`: derived temporal listening identity signals.
- `services/identity_drift.py`: evolution and drift reports.
- `services/auralith_engine.py`, `services/auralith_memory.py`, `services/auralith_planner.py`, `services/auralith_explainer.py`: Auralith context, memory, retrieval, and interpretation support.
- `services/realtime_listening_sync.py`, `services/stream_consumers/`: event and feedback ingestion.

ML domains:

- `ml/discover_engine.py`: evidence-grounded recommendation reasoning.
- `ml/soulmate_engine.py`, `ml/soulmate_scoring.py`, `ml/soulmate_narratives.py`: soulmate compatibility, evidence, combined artifacts, and narratives.
- `ml/aesthetic_engine.py`, `ml/aesthetic_confidence.py`, `ml/aesthetic_categories.py`, `ml/aesthetic_explainer.py`: visual atmosphere interpretation.
- `ml/recommendation_engine.py`, `ml/representation_learning.py`, `ml/similarity_engine.py`, `ml/graph_topology.py`, `ml/graph_walk_embeddings.py`, `ml/co_listen_embeddings.py`: recommendation, graph, similarity, and embedding systems.
- `ml/training/`: datasets, models, training pipelines, and eval scripts.
- `ml/serving/`: retrieval, ranking, FAISS vector index, and index management.

## Testing Structure

Frontend tests live in `frontend/tests/` and use Node's built-in test runner. Keep new frontend tests as `*.test.js`.

Backend tests live in `backend/tests/` and use pytest. Keep new backend tests as `test_*.py`.

Important test categories:

- Auth/session: Spotify app-session bootstrap and protected-route readiness.
- Music profile and identity: profile builder, listening identity, drift, and identity API behavior.
- Recommendations: discover engine, ranking, retrieval, events, and vertical integration.
- Soulmates: slug generation, privacy, compatibility shape, combined artifacts.
- Share/export: share utility and identity export behavior.
- Galaxy/mobile: interaction model and mobile readiness checks.

## Cleanup Audit

### Safe To Delete

Removed in this pass:

- `frontend/src/components/Navbar.jsx`: duplicate legacy navbar, no imports.
- `frontend/src/components/PageLoader.jsx`: unused loader superseded by shell/module skeletons.
- `frontend/src/pages/SocialSoulmates.jsx`: old social route not wired into `App.jsx`.
- `frontend/src/utils/musicMapper.js`: unused legacy mapping helper.
- `frontend/src/utils/soulmateEngine.js`: old client-side compatibility engine superseded by backend `SoulmateEngine`.
- `PROJECT_STRUCTURE.md`: stale generated tree snapshot.
- `NEXTGEN_CODE_STRUCTURE.md`: stale migration planning note.
- `MIGRATION_PLAN_NEXTGEN.md`: stale migration planning note.
- `PLATFORM_UPGRADE.md`: stale migration planning note.

Generated artifacts removed locally:

- `.pytest_cache/`
- `backend/.pytest_cache/`
- `backend/__pycache__/`
- `backend/mlruns/`
- `frontend/dist/`
- `frontend/.npm-cache/`
- frontend dev/preview logs
- `analysis_frames/`

### Maybe Stale

These are retained because they may still carry useful operational context, but they should be refreshed or moved into `docs/` over time:

- `API_DOCUMENTATION.md`
- `ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DEPLOYMENT.md`
- `GETTING_STARTED.md`
- `ML_PIPELINE.md`
- `SETUP.sh`

### Duplicated Or Legacy Naming

- `MusicAesthetic.jsx` is now conceptually the Atmosphere/Reverie surface, but the filename remains legacy. Rename only in a focused route/file migration because it touches route naming, imports, tests, and docs.
- `personalityEngine.js` still supports legacy compatibility fields consumed by `profileAdapters.js`. Do not remove until backend Music Identity coverage fully replaces every frontend fallback.
- `public_profile.py` and `social.py` both touch public-profile concerns. `social.py` is the newer soulmate/public slug flow; keep both until public-profile consumers are migrated.

### Archive Candidates

- `services/nextgen-api/`
- `services/nextgen-worker/`
- `docker-compose.platform.yml`
- `infra/`

These look like a platform scaffold rather than the current production runtime. They are kept because they are real architecture work and may be part of the next deployment direction.

### Actively Used

- `backend/app.py`, `backend/routes/`, `backend/services/`, `backend/ml/`
- `frontend/src/App.jsx`, `frontend/src/app/AuthBootstrap.jsx`
- `frontend/src/pages/`
- `frontend/src/features/galaxy/`
- `frontend/src/features/orb/`
- `frontend/src/components/share/`
- `frontend/src/utils/shareUtils.js`
- `frontend/src/utils/musicIdentityEngine.js`
- `frontend/src/services/api.js`
- `frontend/src/services/profileAdapters.js`
- `backend/tests/`, `frontend/tests/`

### High-Risk To Touch

- Auth/session bootstrap and provider cookies.
- Spotify and Last.fm OAuth routes.
- `music_profile_builder.py` normalization contracts.
- `feature_store.py` local/Mongo fallback behavior.
- Soulmate public slug/privacy behavior.
- ML serving/training modules that have tests but may depend on generated runtime artifacts.
- Route names exposed to users and share links.

## Documentation Rules

- Keep new docs inside `docs/` by domain.
- Use `docs/architecture/` for structure and system maps.
- Use `docs/ml/` for model, feature, retrieval, ranking, and identity explanations.
- Use `docs/qa/` for validation checklists and route/mobile readiness.
- Root-level docs should be limited to `README.md`, license, setup/deployment entry points, and other intentionally public first-read files.

## Generated Artifact Rules

Generated artifacts should not be committed:

- Frontend `dist/`, Vite caches, Playwright reports, screenshots, recordings, and local exports.
- Pytest caches, Python bytecode, MLflow runs, FAISS indexes, model checkpoints, processed datasets, and local data exports.
- Notebook checkpoints and notebook output folders.

If a generated artifact is needed for demos or tests, keep it small, deterministic, and document why it is committed.
