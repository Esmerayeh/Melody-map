# Verification Notes

Melody Map should be verified with authoritative build sources, not only inside constrained sandboxes.

## Sandbox limitation

Some sandboxed environments block the child-process spawning that Vite and esbuild use while loading `vite.config.js`. When that happens, frontend builds can fail with `spawn EPERM` even if the app code is valid.

Treat a sandbox-only Vite/esbuild `spawn EPERM` as non-authoritative unless the same failure also appears in:

- a normal local terminal
- GitHub Actions CI
- deployment preview or production logs

## Authoritative verification sources

Use these as the real sources of truth:

- GitHub Actions on the active branch `master`
- a normal local terminal build
- deployment preview or production logs

## Local build command

Run the frontend build in a normal local terminal with:

```bash
npm run build
```

If your installed Vite version supports an alternate config loader and you need it in a constrained environment, you can also try:

```bash
npm run build -- --configLoader runner
```

## CI build command

GitHub Actions verifies the frontend with:

```bash
npm ci
npm run lint --if-present
npm run test --if-present
npm run build
```

Backend verification in CI is:

```bash
pip install -r requirements.txt pytest pytest-cov
pytest tests/ -v --cov=. --cov-report=xml
```
