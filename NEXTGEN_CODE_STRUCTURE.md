# Melody Map Next-Gen Code Structure

## Frontend

```text
frontend/
  src/
    app/
      AuthBootstrap.jsx
    components/
      shell/
        ModuleBoundary.jsx
        ShellSkeleton.jsx
    design/
      tokens.css
    lib/
      queryKeys.ts
    store/
      useAuthStore.js
      useProfileStore.js
      useStore.js
```

### Frontend direction

- TanStack Query owns server fetch lifecycle
- Zustand owns UI and interaction state
- shell-first route suspense preserves layout during code-split loading
- module boundaries render degraded and partial states in-place

## Next-Gen Services

```text
services/
  nextgen-api/
    app/
      api/routes/
        health.py
        session.py
        jobs.py
        ml.py
      core/
        contracts.py
        logging.py
        settings.py
      models/
        bootstrap.py
        jobs.py
        ml.py
      services/
        cache.py
        feature_store.py
        jobs.py
        ml_pipeline.py
        session_bootstrap.py
      main.py
  nextgen-worker/
    worker_app.py
```

### Service responsibilities

- `session.py`: deterministic auth/bootstrap contract
- `jobs.py`: async job enqueue contract
- `ml.py`: feature artifact and similarity examples
- `feature_store.py`: versioned ML artifact metadata
- `worker_app.py`: Celery worker entrypoint for background enrichment

## Infra

```text
docker-compose.platform.yml
infra/
  prometheus/
    prometheus.yml
  grafana/
    provisioning/datasources/prometheus.yml
.github/workflows/
  ci.yml
  preview-deploy.yml
  canary-release.yml
```

### Infra direction

- Postgres for users, sessions, and jobs
- Redis for cache and queue transport
- Mongo retained only for document-style artifacts while migration is in flight
- Prometheus/Grafana + Sentry/OpenTelemetry ready path for observability
