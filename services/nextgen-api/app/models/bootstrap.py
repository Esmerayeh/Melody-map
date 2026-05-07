from typing import Literal

from pydantic import BaseModel, Field


AuthState = Literal[
    "booting",
    "checking_session",
    "authenticated",
    "hydrating",
    "ready",
    "no_session",
    "error",
]


class ProviderState(BaseModel):
    connected: bool = False
    status: str = "disconnected"
    username: str | None = None
    expires_at: str | None = None


class ProvidersPayload(BaseModel):
    spotify: ProviderState = Field(default_factory=ProviderState)
    lastfm: ProviderState = Field(default_factory=ProviderState)


class UserSummary(BaseModel):
    id: str | None = None
    username: str | None = None
    display_name: str | None = None


class ProfileStatus(BaseModel):
    state: str = "idle"
    tier: str = "limited"
    degraded: bool = False
    retry_after: int | None = None
    backend_warm: bool = True


class SessionBootstrapPayload(BaseModel):
    auth_state: AuthState
    user: UserSummary | None = None
    providers: ProvidersPayload
    profile_status: ProfileStatus
