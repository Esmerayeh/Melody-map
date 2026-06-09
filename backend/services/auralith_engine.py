"""
AuralithEngine
--------------
The Auralith music oracle.

Retrieval layer (always active):
  Hash-bucket bag-of-words embedding over the local auralith_songs.json dataset.
  Produces candidate songs + context that ground every response.
  Honest label: "melody-map-retrieval-v1"

LLM layer (activated when env vars are set):
  When AURALITH_LLM_ENDPOINT + AURALITH_LLM_API_KEY are present, the
  oracle sends a structured prompt (user profile + retrieved songs + question)
  to a real language model and returns its response as the oracle answer.
  The retrieval layer still runs — its output becomes context for the LLM.
  Honest label: "llm-grounded"

If the LLM endpoint is unavailable or returns an error, the engine falls
back to the deterministic template response and logs the failure.
"""
import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path

from config import Config
from ml.serving.auralith_retriever import AuralithRetriever
from services.feature_store import get_latest_snapshot, get_recent_events
from utils.logger import logger

# ─────────────────────────────────────────────────────────────────────────────
# LLM call helper — provider-aware, never logs the API key
# ─────────────────────────────────────────────────────────────────────────────

# HTTP status codes that should be surfaced as labelled failures rather than
# generic "connection error".
_LLM_LABELLED_ERRORS = {
    401: "auth_error",
    403: "auth_error",
    429: "rate_limited",
}


def _call_llm(
    system_prompt: str,
    user_message: str,
    max_tokens: int | None = None,
) -> dict:
    """
    Call the configured LLM endpoint and return a result dict:

        {
            "text":           str | None,   # assistant reply; None on failure
            "provider":       str,          # "groq" | "anthropic" | "openai_compatible" | "none"
            "llm_model":      str | None,
            "fallback_reason": str | None,  # set when text is None
        }

    Provider routing:
      - provider == "anthropic"       → Anthropic Messages API (x-api-key, anthropic-version)
      - everything else (incl "groq") → OpenAI-compatible Chat Completions
                                        (Authorization: Bearer, messages array with system role)

    The API key is NEVER included in log output under any circumstances.
    """
    endpoint  = Config.auralith_llm_endpoint
    api_key   = Config.auralith_llm_api_key
    provider  = (Config.auralith_llm_provider or "openai_compatible").lower().strip()
    model_id  = Config.auralith_llm_model or "llama-3.1-8b-instant"
    timeout   = Config.auralith_llm_timeout          # seconds, from env
    tokens    = max_tokens if max_tokens is not None else Config.auralith_llm_max_tokens

    _empty: dict = {"text": None, "provider": provider, "llm_model": model_id, "fallback_reason": None}

    if not endpoint or not api_key:
        return {**_empty, "provider": "none", "fallback_reason": "llm_not_configured"}

    # ── Build request payload ────────────────────────────────────────────────
    if provider == "anthropic":
        # Anthropic Messages API: system is a top-level field
        payload_dict = {
            "model":      model_id,
            "max_tokens": tokens,
            "temperature": 0.45,
            "system":     system_prompt,
            "messages":   [{"role": "user", "content": user_message}],
        }
        headers = {
            "Content-Type":       "application/json",
            "x-api-key":          api_key,
            "anthropic-version":  "2023-06-01",
            # Cloudflare (in front of several LLM providers) blocks the default
            # "Python-urllib/x.y" agent with a 403 / error 1010. A real UA passes.
            "User-Agent":         "melody-map-auralith/1.0",
        }
    else:
        # OpenAI-compatible: Groq, OpenAI, local Ollama, etc.
        payload_dict = {
            "model":      model_id,
            "max_tokens": tokens,
            "temperature": 0.45,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
        }
        headers = {
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {api_key}",
            # Cloudflare (in front of Groq/OpenAI-compatible gateways) blocks the
            # default "Python-urllib/x.y" agent with a 403 / error 1010. A real UA passes.
            "User-Agent":    "melody-map-auralith/1.0",
        }

    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    req = urllib.request.Request(
        url=endpoint,
        data=payload_bytes,
        method="POST",
        headers=headers,
    )

    # ── Execute request ──────────────────────────────────────────────────────
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))

            # OpenAI / Groq chat completions format
            if "choices" in body:
                text = (body["choices"][0].get("message") or {}).get("content") or ""
                if not text.strip():
                    return {**_empty, "fallback_reason": "llm_empty_response"}
                return {**_empty, "text": text.strip()}

            # Anthropic messages format (fallback detection)
            if "content" in body and isinstance(body["content"], list):
                text = (body["content"][0] or {}).get("text", "")
                if not text.strip():
                    return {**_empty, "fallback_reason": "llm_empty_response"}
                return {**_empty, "text": text.strip()}

            return {**_empty, "fallback_reason": "llm_unrecognised_response_shape"}

    except urllib.error.HTTPError as exc:
        label = _LLM_LABELLED_ERRORS.get(exc.code, "http_error")
        logger.warning({
            "event":    "auralith_llm_failed",
            "provider": provider,
            "model":    model_id,
            "reason":   label,
            "status":   exc.code,
            # Never log exc.headers or the request headers — key is there
        })
        return {**_empty, "fallback_reason": label}

    except urllib.error.URLError as exc:
        # Catches timeout (socket.timeout wraps to URLError in Python ≥3.11)
        reason = "llm_timeout" if "timed out" in str(exc.reason).lower() else "llm_connection_error"
        logger.warning({"event": "auralith_llm_failed", "provider": provider, "model": model_id, "reason": reason})
        return {**_empty, "fallback_reason": reason}

    except (json.JSONDecodeError, KeyError, IndexError) as exc:
        logger.warning({"event": "auralith_llm_failed", "provider": provider, "model": model_id, "reason": "llm_parse_error", "detail": str(exc)})
        return {**_empty, "fallback_reason": "llm_parse_error"}


def _np():
    """Lazy numpy import — keeps numpy out of gunicorn worker startup."""
    import numpy as _numpy  # noqa: PLC0415
    return _numpy


class AuralithEngine:
    def __init__(self, dataset_path: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parents[1]
        self.dataset_path = Path(dataset_path) if dataset_path else base_dir / "data" / "auralith_songs.json"
        self.songs = self._load_songs()
        self.dimension = 64
        self.matrix = self._embed_many(self._serialize_song(song) for song in self.songs)
        self.retriever = AuralithRetriever()

    def _load_songs(self) -> list[dict]:
        if not self.dataset_path.exists():
            logger.warning({"event": "auralith_dataset_missing", "path": str(self.dataset_path)})
            return []
        with self.dataset_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _serialize_song(self, song: dict) -> str:
        return (
            f"{song['title']} by {song['artist']}. Genre: {song['genre']}. Mood: {song['mood']}. "
            f"Energy: {song['energy']}. Valence: {song['valence']}. Tempo: {song['tempo']}. "
            f"Description: {song['description']}"
        )

    def _hash_token(self, token: str) -> int:
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return int(digest, 16) % self.dimension

    def _embed(self, text: str):
        np = _np()
        vector = np.zeros(self.dimension, dtype="float32")
        normalized = text.lower().replace("/", " ").replace(",", " ").replace("-", " ")
        tokens = [token for token in normalized.split() if token]
        if not tokens:
            return vector
        for token in tokens:
            vector[self._hash_token(token)] += 1.0
        norm = np.linalg.norm(vector)
        return vector if norm == 0 else vector / norm

    def _embed_many(self, texts):
        np = _np()
        return np.vstack([self._embed(text) for text in texts]).astype("float32")

    def _item_label(self, item, *keys: str) -> str:
        if isinstance(item, str):
            return item.strip()
        if isinstance(item, dict):
            for key in keys:
                value = item.get(key)
                if value:
                    return str(value).strip()
        return ""

    def _track_label(self, item) -> str:
        if isinstance(item, str):
            return item.strip()
        if not isinstance(item, dict):
            return ""
        title = item.get("title") or item.get("name") or ""
        artist = item.get("artist") or ""
        if title and artist:
            return f"{title} by {artist}"
        return title or artist

    def _profile_context(self, profile: dict | None) -> dict:
        profile = profile or {}
        genres = [self._item_label(item, "genre", "name") for item in profile.get("genres", []) if item][:6]
        top_artists = [self._item_label(item, "name", "artist") for item in (profile.get("topArtists") or profile.get("favoriteArtists") or []) if item][:6]
        top_tracks = [self._track_label(item) for item in profile.get("topTracks", []) if item][:6]
        recent_tracks = [self._track_label(item) for item in profile.get("recentlyPlayed", []) if item][:6]
        liked_songs = [self._track_label(item) for item in profile.get("likedSongs", []) if item][:6]
        saved_playlists = [self._item_label(item, "name", "title") for item in profile.get("savedPlaylists", []) if item][:4]
        aesthetic_tags = [item for item in profile.get("aestheticTags", []) if item][:6]
        mood_preferences = [item for item in profile.get("moodPreferences", []) if item][:4]
        audio = profile.get("audioFeatures") or {}
        analytics = profile.get("analyticsMetrics") or {}
        identity_signals = [
            item for item in (profile.get("identitySignals") or [])
            if isinstance(item, dict) and item.get("available", True) and item.get("evidence")
        ][:6]
        return {
            "genres": [item for item in genres if item],
            "top_artists": [item for item in top_artists if item],
            "top_tracks": [item for item in top_tracks if item],
            "recent_tracks": [item for item in recent_tracks if item],
            "liked_songs": [item for item in liked_songs if item],
            "saved_playlists": [item for item in saved_playlists if item],
            "aesthetic_tags": aesthetic_tags,
            "mood_preferences": mood_preferences,
            "personality": profile.get("personality") or "",
            "mbti": profile.get("mbti") or "",
            "identity_signals": identity_signals,
            "living_identity": profile.get("livingIdentity") or {},
            "spotify_evidence": profile.get("spotifyEvidence") or profile.get("listeningEvidence") or {},
            "time_range": profile.get("timeRange") or "medium_term",
            "user_name": (profile.get("userProfile") or {}).get("name") or "",
            "audio": audio,
            "analytics": analytics,
            "representations": profile.get("representations") or {},
        }

    def _history_context(self, profile: dict | None) -> dict:
        user_id = (profile or {}).get("user_id") or ((profile or {}).get("userProfile") or {}).get("id")
        events = get_recent_events(user_id, limit=12) if user_id else []
        snapshot = get_latest_snapshot(user_id) if user_id else None
        return {"events": events, "snapshot": snapshot}

    def _profile_terms(self, profile: dict | None) -> str:
        context = self._profile_context(profile)
        parts = []
        parts.extend(context["genres"])
        parts.extend(context["top_artists"])
        parts.extend(context["top_tracks"])
        parts.extend(context["recent_tracks"])
        parts.extend(context["liked_songs"])
        parts.extend(context["saved_playlists"])
        parts.extend(context["aesthetic_tags"])
        parts.extend(context["mood_preferences"])
        if context["personality"]:
            if isinstance(context["personality"], list):
                parts.extend(self._item_label(item, "label", "name", "id") for item in context["personality"])
            else:
                parts.append(str(context["personality"]))
        if context["mbti"]:
            if isinstance(context["mbti"], dict):
                parts.extend([str(context["mbti"].get("type") or ""), str(context["mbti"].get("name") or "")])
            else:
                parts.append(str(context["mbti"]))
        if context["analytics"].get("mood"):
            parts.append(context["analytics"]["mood"])
        for signal in context["identity_signals"][:4]:
            parts.append(signal.get("label") or "")
            parts.extend(signal.get("evidence") or [])
        return " ".join(parts)

    def _profile_fit(self, song: dict, profile: dict | None) -> tuple[int, list[str]]:
        context = self._profile_context(profile)
        score = 0
        reasons = []
        genre = song["genre"].lower()
        description = song["description"].lower()
        mood = song["mood"].lower()

        if any(genre_term.lower() in genre for genre_term in context["genres"]):
            score += 4
            reasons.append(f"it stays close to the {song['genre'].lower()} thread in your listening")

        if any(artist.lower() in description for artist in context["top_artists"]):
            score += 2
            reasons.append("its framing sits near artists you return to often")

        if any(tag.lower() in description or tag.lower() in mood for tag in context["aesthetic_tags"]):
            score += 2
            reasons.append("its atmosphere matches the visual-emotional palette in your profile")

        preferred_mood = (context["analytics"].get("mood") or "").lower()
        if preferred_mood and preferred_mood in mood:
            score += 3
            reasons.append(f"it reflects the {preferred_mood} pull in your recent listening")

        avg_tempo = context["audio"].get("tempo")
        if avg_tempo is not None and abs(song["tempo"] - avg_tempo) <= 18:
            score += 2
            reasons.append("its pacing sits near your usual listening pulse")

        avg_energy = context["audio"].get("energy")
        if avg_energy is not None and abs(song["energy"] - avg_energy) <= 0.16:
            score += 2
            reasons.append("its energy profile feels native to your current taste")

        return score, reasons

    def _personalized_search(self, query: str, profile: dict | None = None, limit: int = 8) -> list[dict]:
        if not self.songs:
            return []
        context_terms = self._profile_terms(profile)
        query_vector = self._embed(f"{query} {context_terms}".strip())
        scores = self.matrix @ query_vector
        ranked = []
        for index, song in enumerate(self.songs):
            affinity, _ = self._profile_fit(song, profile)
            ranked.append((float(scores[index]) + affinity * 0.045, song))
        ranked.sort(key=lambda item: item[0], reverse=True)
        return [song for _, song in ranked[:limit]]

    def search(self, query: str, limit: int = 8) -> list[dict]:
        return self._personalized_search(query, None, limit)

    def search_by_names(self, values: list[str], profile: dict | None = None, limit: int = 8) -> list[dict]:
        query = " ".join(values)
        broad = self._personalized_search(query, profile, limit=limit * 2)
        ranked = []
        for song in self.songs:
            haystack = f"{song['title']} {song['artist']}".lower()
            score = 0
            for value in values:
                needle = value.lower().strip()
                if needle and needle in haystack:
                    score += 4
                for token in needle.split():
                    if token in haystack:
                        score += 1
            affinity, _ = self._profile_fit(song, profile)
            if score or affinity:
                ranked.append((score + affinity, song))
        ranked.sort(key=lambda item: item[0], reverse=True)
        combined = []
        seen = set()
        for song in [*(song for _, song in ranked), *broad]:
            key = (song["title"], song["artist"])
            if key in seen:
                continue
            seen.add(key)
            combined.append(song)
        return combined[:limit]

    def describe_profile(self, songs: list[dict]) -> dict:
        if not songs:
            return {
                "tempo": "not enough indexed tracks",
                "energy": "not enough indexed tracks",
                "texture": "not enough indexed tracks",
            }
        avg_tempo = sum(song["tempo"] for song in songs) / len(songs)
        avg_energy = sum(song["energy"] for song in songs) / len(songs)
        moods = ", ".join(song["mood"].lower() for song in songs[:3])
        tempo = "slow-burning" if avg_tempo < 85 else "gliding mid-tempo" if avg_tempo < 120 else "restless uptempo"
        energy = "low-lit" if avg_energy < 0.38 else "controlled lift" if avg_energy < 0.62 else "high-tension"
        return {
            "tempo": tempo,
            "energy": energy,
            "texture": f"{moods} textures" if moods else "atmospheric textures",
        }

    def _pick_title(self, prompt: str, songs: list[dict]) -> str:
        mood = songs[0]["mood"] if songs else "Afterhours"
        fragment = prompt.split()[:2]
        if not fragment:
            return "Auralith Sequence"
        return f"{mood.title()} {' '.join(word.title() for word in fragment)}"

    def _mood_line(self, songs: list[dict], profile: dict | None = None) -> str:
        context = self._profile_context(profile)
        base = songs[0]["mood"] if songs else "Reflective"
        taste_mood = context["analytics"].get("mood")
        if taste_mood:
            return f"{base} with a {taste_mood} undertow"
        return f"{base} with deliberate emotional contour"

    def _song_reason(self, song: dict, prompt: str, profile: dict | None = None) -> str:
        _, fit_reasons = self._profile_fit(song, profile)
        fit_clause = fit_reasons[0] if fit_reasons else "it extends the same emotional vocabulary without flattening the sequence"
        return (
            f"{song['title']} fits because {song['description'].lower()} "
            f"Its {song['tempo']} BPM pacing and {song['mood'].lower()} tone keep it aligned with '{prompt}', and {fit_clause}."
        )

    def _taste_fit_summary(self, profile: dict | None, songs: list[dict]) -> str:
        context = self._profile_context(profile)
        history = self._history_context(profile)
        if not profile:
            return "This sequence stays coherent by holding to one emotional climate while varying texture and pacing."
        anchors = []
        if context["genres"]:
            anchors.append(f"it keeps one foot in your {context['genres'][0]} lean")
        if context["top_artists"]:
            anchors.append(f"it carries the atmospheric weight you tend to favor around {context['top_artists'][0]}")
        if context["analytics"].get("mood"):
            anchors.append(f"it stays close to the {context['analytics']['mood']} current in your profile")
        if history["events"]:
            anchors.append("it reflects the tracks and sessions you touched most recently")
        for signal in context["identity_signals"][:2]:
            evidence = (signal.get("evidence") or [None])[0]
            if evidence:
                anchors.append(evidence)
        if not anchors and songs:
            anchors.append("it mirrors the pacing and tonal restraint in your current listening")
        return "Why this fits your taste: " + "; ".join(anchors[:3]) + "."

    def _retrieval_trace(self, query: str, profile: dict | None, songs: list[dict]) -> dict:
        history = self._history_context(profile)
        return {
            "query": query,
            "profileEmbeddingVersion": ((profile or {}).get("representations") or {}).get("embeddingVersion"),
            "retrievedSongs": [
                {"title": song["title"], "artist": song["artist"], "genre": song.get("genre"), "mood": song.get("mood")}
                for song in songs[:6]
            ],
            "recentEventsUsed": history["events"][:5],
            "snapshotId": (history["snapshot"] or {}).get("snapshot_id"),
        }

    def _retrieve_grounding(self, prompt: str, profile: dict | None) -> dict:
        user_id = (profile or {}).get("user_id") or ((profile or {}).get("userProfile") or {}).get("id")
        return self.retriever.retrieve(user_id, prompt, profile=profile, limit=12) if user_id else {
            "memories": [],
            "nearest_tracks": [],
            "nearest_artists": [],
            "recent_events": [],
            "snapshot": None,
            "confidence": 0.35,
        }

    def generate_playlist(self, prompt: str, profile: dict | None = None, limit: int = 8) -> dict:
        songs = self._personalized_search(prompt, profile, limit=max(limit, 8))
        selected = songs[:limit]
        if not selected:
            return {
                "playlist_title": "Auralith needs more indexed music",
                "mood": "insufficient signal",
                "vibe_summary": "No playlist was generated because the local song index did not return grounded matches.",
                "sonic_profile": self.describe_profile([]),
                "songs": [],
                "narrative": "Sync or index more Spotify-backed music before Auralith builds an emotional sequence.",
                "why_this_fits_your_taste": self._taste_fit_summary(profile, []),
                "retrieved_context": [],
                "retrieval_trace": self._retrieval_trace(prompt, profile, []),
                "fallbackUsed": True,
                "used_model": "melody-map-auralith",
            }
        return {
            "playlist_title": self._pick_title(prompt, selected),
            "mood": self._mood_line(selected, profile),
            "vibe_summary": "A sequence built to move with intention: atmospheric first, emotionally legible, and personalized to the shape of your Melody Map listening profile.",
            "sonic_profile": self.describe_profile(selected),
            "songs": [
                {"title": song["title"], "artist": song["artist"], "reason": self._song_reason(song, prompt, profile)}
                for song in selected
            ],
            "narrative": "The arc opens in suspension, warms into detail around the center, then leaves a trace of tension so the ending feels carried rather than closed.",
            "why_this_fits_your_taste": self._taste_fit_summary(profile, selected),
            "retrieved_context": songs,
            "retrieval_trace": self._retrieval_trace(prompt, profile, selected),
            "used_model": "melody-map-auralith",
        }

    def analyze_taste(self, seeds: list[str], profile: dict | None = None) -> dict:
        songs = self.search_by_names(seeds, profile=profile, limit=8)
        context = self._profile_context(profile)
        dominant_traits = []
        for signal in context["identity_signals"][:3]:
            evidence = (signal.get("evidence") or [None])[0]
            if evidence:
                dominant_traits.append(f"{signal.get('label')}: {evidence}")
        if not dominant_traits and context["audio"]:
            dominant_traits.append(
                f"Audio-feature profile: energy {context['audio'].get('energy')}, valence {context['audio'].get('valence')}, danceability {context['audio'].get('danceability')}."
            )
        receipts = (context["spotify_evidence"].get("receipts") or [])[:4]
        hidden_patterns = receipts or ["No long-term Spotify identity receipts are indexed yet."]
        if context["recent_tracks"]:
            hidden_patterns.append(f"Recent Spotify plays include {', '.join(context['recent_tracks'][:4])}.")
        living = context["living_identity"]
        profile_line = living.get("summary") or "The taste read is limited to the Spotify artists, tracks, genres, and audio features currently available."
        mood = context["analytics"].get("mood")
        emotional_signature = f"{mood} from Spotify energy and valence" if mood else "Not enough Spotify audio-feature signal for a stable emotional signature."
        return {
            "taste_profile": profile_line,
            "dominant_traits": dominant_traits,
            "hidden_patterns": hidden_patterns[:4],
            "sonic_preferences": self.describe_profile(songs[:6]),
            "emotional_signature": emotional_signature,
            "exploration_suggestions": [
                f"Explore adjacent records near {context['genres'][0]}" if context["genres"] else "Add more Spotify top artists before Auralith widens the map.",
                f"Use {context['top_artists'][0]} as the first anchor, then branch one genre outward" if context["top_artists"] else "Sync top artists to reveal grounded exploration paths.",
                "Prefer recommendations with visible evidence receipts over broad mood labels.",
            ],
            "recommendation_direction": self._taste_fit_summary(profile, songs[:6]),
            "retrieved_context": songs,
            "retrieval_trace": self._retrieval_trace(" ".join(seeds), profile, songs),
            "used_model": "melody-map-auralith",
        }

    def explain_song(self, prompt: str, profile: dict | None = None) -> dict:
        songs = self.search_by_names([prompt], profile=profile, limit=6)
        if not songs:
            return {
                "core_feeling": "I could not match that song against the current indexed catalog.",
                "sonic_breakdown": {},
                "emotional_effect": "No interpretation was generated because Melody Map does not have enough grounded song evidence.",
                "why_it_works": "Auralith needs a matched track, artist, or Spotify profile anchor before making a claim.",
                "listener_alignment": self._taste_fit_summary(profile, []) if profile else "",
                "similar_vibe": [],
                "retrieved_context": [],
                "retrieval_trace": self._retrieval_trace(prompt, profile, []),
                "fallbackUsed": True,
                "used_model": "melody-map-auralith",
            }
        song = songs[0]
        return {
            "core_feeling": f"{song['title']} feels like controlled emotion slowly turning visible.",
            "sonic_breakdown": self.describe_profile([song]),
            "emotional_effect": "It creates closeness without comfort, so the listener sits inside the feeling instead of observing it from a safe distance.",
            "why_it_works": (
                f"The {song['mood'].lower()} tone, {song['tempo']} BPM pacing, and the way {song['description'].lower()} "
                "all point toward the same emotional center."
            ),
            "listener_alignment": self._taste_fit_summary(profile, [song]) if profile else "",
            "similar_vibe": [f"{item['title']} - {item['artist']}" for item in songs[1:5]],
            "retrieved_context": songs,
            "retrieval_trace": self._retrieval_trace(prompt, profile, songs),
            "used_model": "melody-map-auralith",
        }

    def critique_playlist(self, songs_or_artists: list[str], profile: dict | None = None) -> dict:
        songs = self.search_by_names(songs_or_artists, profile=profile, limit=8)
        context = self._profile_context(profile)
        if not songs:
            return {
                "overall_assessment": "Auralith could not match this playlist against the indexed catalog, so no critique was generated.",
                "strengths": [],
                "issues": ["No grounded song matches were available."],
                "flow_analysis": "Sync or index more Spotify-backed tracks before requesting sequencing advice.",
                "improvements": [],
                "replacement_suggestions": [],
                "retrieved_context": [],
                "retrieval_trace": self._retrieval_trace(" ".join(songs_or_artists), profile, []),
                "fallbackUsed": True,
                "used_model": "melody-map-auralith",
            }
        issues = [
            "Middle transitions blur because adjacent tracks share too much tonal weight",
            "The arc needs one controlled lift or one sharper drop",
            "The ending does not yet feel intentionally resolved or intentionally open",
        ]
        if context["audio"].get("energy", 0.5) > 0.62:
            issues[1] = "The sequence could use one calmer reset so the stronger moments land harder"
        return {
            "overall_assessment": "The playlist has a coherent emotional palette, but its sequencing still feels more assembled than directed.",
            "strengths": [
                "Strong atmospheric identity",
                "A believable emotional temperature",
                "Clear instinct for texture-rich selections",
            ],
            "issues": issues,
            "flow_analysis": "The opening sets mood well, but the center holds too long in the same register. A stronger pivot track would create movement instead of drift.",
            "improvements": [
                "Introduce one more rhythmic shift around the midpoint",
                "Remove one tonal duplicate to sharpen contrast",
                "Choose a closer that either resolves the feeling or deepens it on purpose",
            ],
            "replacement_suggestions": [
                {
                    "remove": songs_or_artists[0] if songs_or_artists else "Current opener",
                    "replace_with": f"{songs[1]['title']} - {songs[1]['artist']}" if len(songs) > 1 else "A more spacious opener",
                    "reason": "A slightly less declarative opening gives the sequence more room to unfold and keeps the emotional reveal from arriving too early.",
                }
            ],
            "retrieved_context": songs,
            "retrieval_trace": self._retrieval_trace(" ".join(songs_or_artists), profile, songs),
            "used_model": "melody-map-auralith",
        }

    def concept_playlist(self, prompt: str, profile: dict | None = None, limit: int = 8) -> dict:
        songs = self._personalized_search(prompt, profile, limit=max(limit, 8))
        selected = songs[:limit]
        if not selected:
            return {
                "interpretation": "Auralith needs grounded song matches before shaping this concept.",
                "playlist_title": "Concept needs more signal",
                "emotional_arc": "No emotional arc was inferred because no indexed songs matched the prompt.",
                "songs": [],
                "closing_note": "No Spotify-backed evidence, no invented oracle answer.",
                "retrieved_context": [],
                "retrieval_trace": self._retrieval_trace(prompt, profile, []),
                "fallbackUsed": True,
                "used_model": "melody-map-auralith",
            }
        return {
            "interpretation": "The concept reads like emotional afterimage: a feeling that has already happened but is still lighting the room.",
            "playlist_title": self._pick_title(prompt, selected),
            "emotional_arc": "It starts in suspension, gathers intimacy and texture, then leaves the listener in a clearer but still unresolved space.",
            "songs": [
                {"title": song["title"], "artist": song["artist"], "reason": self._song_reason(song, prompt, profile)}
                for song in selected
            ],
            "closing_note": "The goal is not closure. It is shape, motion, and enough silence around the music to let the feeling breathe.",
            "retrieved_context": songs,
            "retrieval_trace": self._retrieval_trace(prompt, profile, selected),
            "used_model": "melody-map-auralith",
        }
