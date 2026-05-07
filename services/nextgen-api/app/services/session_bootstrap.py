from __future__ import annotations

from fastapi import Request

from app.models.bootstrap import ProfileStatus, ProviderState, ProvidersPayload, SessionBootstrapPayload, UserSummary


def build_session_bootstrap(request: Request) -> SessionBootstrapPayload:
    spotify_cookie = request.cookies.get("mm_spotify_access")
    lastfm_cookie = request.cookies.get("mm_lastfm_session")
    app_session = request.cookies.get("mm_session")

    spotify = ProviderState(
        connected=bool(spotify_cookie),
        status="connected" if spotify_cookie else "disconnected",
    )
    lastfm = ProviderState(
        connected=bool(lastfm_cookie),
        status="connected" if lastfm_cookie else "disconnected",
    )

    if app_session or spotify.connected or lastfm.connected:
        state = "authenticated"
        profile_status = ProfileStatus(
            state="hydrating" if spotify.connected or lastfm.connected else "idle",
            tier="medium" if spotify.connected or lastfm.connected else "limited",
            degraded=not (spotify.connected or lastfm.connected),
            backend_warm=True,
        )
        user = UserSummary(
            id="session-user",
            username="music-traveler",
            display_name="Music Traveler",
        )
    else:
        state = "no_session"
        profile_status = ProfileStatus(
            state="idle",
            tier="limited",
            degraded=False,
            backend_warm=True,
        )
        user = None

    return SessionBootstrapPayload(
        auth_state=state,
        user=user,
        providers=ProvidersPayload(spotify=spotify, lastfm=lastfm),
        profile_status=profile_status,
    )
