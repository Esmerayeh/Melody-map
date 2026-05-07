# Melody Map Platform Upgrade

## Target Architecture

```text
[Frontend Shell on Vercel]
        |
        v
[API Gateway / FastAPI]
   |        |         |
   v        v         v
[Auth]   [Profile]   [Jobs/ML]
   |        |         |
   +--------+----+----+
                 |
                 v
        [Redis / Postgres / Mongo / Object Storage]
                 |
                 v
             [Celery Worker]
```

## Design Goals

- Deterministic auth and profile bootstrap
- Typed API envelopes with explicit degraded states
- Async-first compute for heavy profile, soulmate, and galaxy work
- Versioned ML outputs and feature lineage
- Observable services with structured logs, tracing, and metrics

## Migration Shape

### Phase 1
- Keep current React + Flask app running
- Introduce secure session bootstrap and progressive UI
- Add platform scaffold for FastAPI + worker + Redis/Postgres

### Phase 2
- Move profile bootstrap and job orchestration into FastAPI
- Start routing new endpoints through typed contracts
- Move heavy work onto Celery-backed jobs

### Phase 3
- Introduce versioned feature store and embedding pipeline
- Gradually retire synchronous Flask ML endpoints
- Add canary deployment and staging promotion

## Service Boundaries

### Auth Service
- Provider OAuth exchange
- Refresh rotation
- Session bootstrap
- CSRF and cookie policy

### Profile Service
- Spotify + Last.fm aggregation
- Consistent time-window profile artifacts
- Data completeness and source attribution

### ML Service
- Feature materialization
- Embedding generation
- Similarity neighborhoods
- Galaxy layout artifacts

### Job Layer
- Recompute orchestration
- Idempotent enqueueing
- Background enrichment

## Data Ownership

- Postgres: users, sessions, jobs, auth metadata
- Redis: cache, rate limiting, queue broker, locks
- MongoDB: flexible profile artifacts if still needed
- Object storage: generated galaxy layouts, identity artifacts, exports

## Frontend Direction

- TanStack Query for server state
- Zustand for UI state only
- Route shell always visible
- Module boundaries for degraded/error states
- Tokenized CSS system for color, depth, motion, and spacing
