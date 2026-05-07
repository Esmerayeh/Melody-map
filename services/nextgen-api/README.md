## Melody Map Next-Gen API

This service is the migration target for Melody Map's production-grade backend.

It introduces:

- FastAPI + Pydantic typed contracts
- Redis-backed cache + queue integration points
- Postgres-backed session/job metadata integration points
- structured envelopes for every response
- async-first orchestration for profile and ML work

The current Flask app remains the compatibility layer while this service grows
to parity.
