from __future__ import annotations

from typing import Any

from services.spotify_proxy_service import SpotifyProxyService, spotify_proxy_service
from services.listening_identity import build_recommendation_reason


LIVE_RECOMMENDATION_SCHEMA_VERSION = "2026-05-spotify-live-bridge-v1"


def _label(item: Any, *keys: str) -> str:
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        for key in keys:
            value = item.get(key)
            if value:
                return str(value).strip()
    return ""


def _artist_name(item: Any) -> str:
    return _label(item, "name", "artist")


def _track_title(item: Any) -> str:
    return _label(item, "title", "name")


def _seed_id(item: Any) -> str:
    if not isinstance(item, dict):
        return ""
    return str(item.get("id") or item.get("spotify_id") or "").strip()


def _track_from_spotify(item: dict, *, source: str, reason: str, score: int = 78) -> dict:
    artists = item.get("artists") or []
    artist_names = [
        artist.get("name") if isinstance(artist, dict) else str(artist)
        for artist in artists
        if artist
    ]
    album = item.get("album") or {}
    images = album.get("images") or []
    return {
        "id": item.get("id"),
        "title": item.get("name") or item.get("title"),
        "artist": artist_names[0] if artist_names else item.get("artist"),
        "artists": artist_names,
        "album": album.get("name") or item.get("album"),
        "album_art": images[0].get("url") if images and isinstance(images[0], dict) else item.get("album_art"),
        "preview_url": item.get("preview_url"),
        "spotify_url": (item.get("external_urls") or {}).get("spotify") or item.get("spotify_url"),
        "popularity": item.get("popularity"),
        "score": score,
        "source": source,
        "whyItFitsBoth": reason,
        "reason": reason,
        "liveSpotify": True,
    }


class SpotifyRecommendationBridge:
    def __init__(self, proxy: SpotifyProxyService | None = None) -> None:
        self.proxy = proxy or spotify_proxy_service

    def _profile_seeds(self, profile: dict | None, explicit: dict | None = None) -> dict:
        profile = profile or {}
        explicit = explicit or {}
        top_artists = explicit.get("seedArtists") or explicit.get("seed_artists") or profile.get("topArtists") or profile.get("top_artists") or []
        top_tracks = explicit.get("seedTracks") or explicit.get("seed_tracks") or profile.get("topTracks") or profile.get("top_tracks") or []
        genres = explicit.get("seedGenres") or explicit.get("seed_genres") or profile.get("genres") or profile.get("top_genres") or []
        return {
            "artist_ids": [_seed_id(item) for item in top_artists if _seed_id(item)][:3],
            "track_ids": [_seed_id(item) for item in top_tracks if _seed_id(item)][:3],
            "artist_names": [_artist_name(item) for item in top_artists if _artist_name(item)][:6],
            "track_titles": [_track_title(item) for item in top_tracks if _track_title(item)][:6],
            "genres": [_label(item, "genre", "name") for item in genres if _label(item, "genre", "name")][:6],
        }

    def _recommendation_params(self, seeds: dict, concept: dict, profile: dict | None, limit: int) -> dict | None:
        seed_artists = seeds["artist_ids"][:2]
        seed_tracks = seeds["track_ids"][:2]
        seed_genres = []
        for genre in [*(concept.get("seed_genres") or []), *seeds["genres"]]:
            clean = str(genre or "").lower().strip().replace(" ", "-")
            if clean and clean not in seed_genres:
                seed_genres.append(clean)
            if len(seed_artists) + len(seed_tracks) + len(seed_genres) >= 5:
                break
        if not seed_artists and not seed_tracks and not seed_genres:
            return None
        audio = (profile or {}).get("audioFeatures") or {}
        params = {"limit": limit}
        if seed_artists:
            params["seed_artists"] = ",".join(seed_artists)
        if seed_tracks:
            params["seed_tracks"] = ",".join(seed_tracks)
        if seed_genres and len(seed_artists) + len(seed_tracks) < 5:
            params["seed_genres"] = ",".join(seed_genres[: 5 - len(seed_artists) - len(seed_tracks)])
        for source, target in [("energy", "target_energy"), ("valence", "target_valence"), ("danceability", "target_danceability")]:
            value = audio.get(source)
            if value is not None:
                params[target] = value
        return params

    def _search_queries(self, seeds: dict, concept: dict) -> list[str]:
        queries = []
        for artist in seeds["artist_names"][:3]:
            queries.append(f'artist:"{artist}"')
        for query in concept.get("seed_queries") or []:
            queries.append(query)
        if seeds["genres"]:
            queries.append(" ".join(seeds["genres"][:2]))
        return list(dict.fromkeys([query for query in queries if query]))[:4]

    def _search_tracks(self, token: str, queries: list[str], *, limit: int, reason: str) -> tuple[list[dict], list[str]]:
        tracks = []
        warnings = []
        seen = set()
        for query in queries:
            result = self.proxy.get(token, "/search", {"q": query, "type": "track", "limit": max(1, min(limit, 10))})
            if not result.ok:
                warnings.append(result.error_code or "SPOTIFY_SEARCH_FAILED")
                continue
            for item in ((result.data or {}).get("tracks") or {}).get("items", []):
                key = item.get("id") or f"{item.get('name')}::{item.get('artists')}"
                if not item.get("id") or key in seen:
                    continue
                seen.add(key)
                tracks.append(_track_from_spotify(item, source="spotify_search_fallback", reason=reason, score=74))
                if len(tracks) >= limit:
                    return tracks, warnings
        return tracks, warnings

    def live_tracks_for_concept(self, token: str | None, concept: dict, profile: dict | None = None, explicit_seeds: dict | None = None, limit: int = 5) -> dict:
        if not token:
            return {
                "tracks": [],
                "source": "unavailable",
                "warnings": ["spotify_token_missing"],
                "fallbackUsed": True,
                "schemaVersion": LIVE_RECOMMENDATION_SCHEMA_VERSION,
            }
        seeds = self._profile_seeds(profile, explicit_seeds)
        reason = (concept.get("why_it_fits") or "This candidate is pulled from live Spotify catalog data and ranked against your profile anchors.")
        params = self._recommendation_params(seeds, concept, profile, limit)
        warnings = []
        tracks = []
        source = "spotify_recommendations"
        if params:
            result = self.proxy.get(token, "/recommendations", params)
            if result.ok:
                tracks = [
                    _track_from_spotify(item, source=source, reason=reason, score=max(68, 92 - index * 4))
                    for index, item in enumerate(((result.data or {}).get("tracks") or [])[:limit])
                    if item
                ]
            else:
                warnings.append(result.error_code or "SPOTIFY_RECOMMENDATIONS_FAILED")
        if not tracks:
            tracks, search_warnings = self._search_tracks(token, self._search_queries(seeds, concept), limit=limit, reason=reason)
            warnings.extend(search_warnings)
            source = "spotify_search_fallback" if tracks else "unavailable"
        for track in tracks:
            explanation = build_recommendation_reason(profile, track, mode="spotify_live")
            track["whyItFitsBoth"] = explanation["text"] if explanation.get("text") else track["whyItFitsBoth"]
            track["evidence"] = explanation.get("evidence", [])
            track["methodology"] = explanation.get("methodology")
        return {
            "tracks": tracks[:limit],
            "source": source,
            "seedSummary": {
                "artists": seeds["artist_names"][:4],
                "tracks": seeds["track_titles"][:4],
                "genres": seeds["genres"][:4],
                "usedRecommendationEndpoint": source == "spotify_recommendations",
            },
            "warnings": list(dict.fromkeys(warnings)),
            "fallbackUsed": source != "spotify_recommendations",
            "schemaVersion": LIVE_RECOMMENDATION_SCHEMA_VERSION,
        }

    def attach_to_concepts(self, token: str | None, concepts: list[dict], profile: dict | None = None, explicit_seeds: dict | None = None, limit_per_concept: int = 4) -> list[dict]:
        output = []
        for concept in concepts:
            live = self.live_tracks_for_concept(token, concept, profile=profile, explicit_seeds=explicit_seeds, limit=limit_per_concept)
            output.append({
                **concept,
                "liveSpotify": live,
                "tracks": live.get("tracks") or concept.get("tracks") or [],
                "recommendationConfidence": {
                    "score": 0.78 if live.get("tracks") and not live.get("fallbackUsed") else 0.58 if live.get("tracks") else 0.34,
                    "label": "high" if live.get("tracks") and not live.get("fallbackUsed") else "medium" if live.get("tracks") else "limited",
                },
            })
        return output

    def enhance_soulmate_result(self, token: str | None, result: dict, profile_a: dict, profile_b: dict, limit: int = 6) -> dict:
        concept = {
            "id": "soulmate_bridge",
            "seed_genres": result.get("sharedGenres") or [],
            "seed_queries": [
                " ".join((result.get("sharedArtists") or [])[:2]),
                " ".join((result.get("sharedGenres") or [])[:2]),
            ],
            "why_it_fits": result.get("whyThisWorks") or result.get("compatibilityNarrative"),
        }
        merged_profile = {
            "topArtists": [*(profile_a.get("topArtists") or []), *(profile_b.get("topArtists") or [])],
            "topTracks": [*(profile_a.get("topTracks") or []), *(profile_b.get("topTracks") or [])],
            "genres": [*(profile_a.get("genres") or []), *(profile_b.get("genres") or [])],
            "audioFeatures": result.get("combinedSoulOrb", {}).get("blendedAudio") or profile_a.get("audioFeatures") or {},
            "recommendationContext": {
                "anchors": result.get("sharedArtists") or [],
                "genres": result.get("sharedGenres") or [],
                "signals": [],
            },
        }
        live = self.live_tracks_for_concept(token, concept, profile=merged_profile, limit=limit)
        if live.get("tracks"):
            existing = result.get("songsBothMayLove") or []
            seen = {f"{item.get('title')}::{item.get('artist')}".lower() for item in existing}
            merged = [*existing]
            for track in live["tracks"]:
                key = f"{track.get('title')}::{track.get('artist')}".lower()
                if key not in seen:
                    merged.append({**track, "category": "live_bridge"})
                    seen.add(key)
            result["songsBothMayLove"] = merged[:10]
        result["liveSpotifyRecommendations"] = live
        return result


spotify_recommendation_bridge = SpotifyRecommendationBridge()
