# Melody Map Migration Plan

## 1. Frontend Refactor

### Immediate
- Keep current Vite app live
- Move all new server fetches to TanStack Query
- Leave Zustand for shell/interaction state only
- Add design tokens and module-level error/skeleton boundaries

### Next
- Add `tsconfig.json` with `allowJs`
- Convert new modules to TypeScript first
- Migrate query hooks, auth bootstrap, and app shell before page components

## 2. Backend Refactor

### Immediate
- Keep Flask as compatibility layer
- Introduce FastAPI service scaffold in parallel
- Start with `/api/session/bootstrap`, `/api/jobs/*`, and typed profile contracts

### Next
- Move auth bootstrap and job submission into FastAPI
- Proxy old routes if needed during cutover
- Decommission Flask endpoints after parity

## 3. Data Migration

### Add
- Postgres schema for users, sessions, jobs
- Redis for cache and queue
- Feature artifact metadata with version fields

### Preserve
- MongoDB profile documents until feature store stabilizes

## 4. ML Migration

### Split
- request path -> fetch cached artifact
- worker path -> recompute artifact

### Version every artifact with
- `pipeline_version`
- `feature_schema_version`
- `embedding_version`
- `generated_at`
- `provider_mix`

## 5. Delivery

### CI/CD
- typed checks
- integration tests
- e2e auth/bootstrap tests
- security scans
- preview and canary workflows

### Observability
- Sentry
- OpenTelemetry
- request IDs
- cache hit metrics
- ML latency metrics
