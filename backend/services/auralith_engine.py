import hashlib
import json
from pathlib import Path

import numpy as np


class AuralithEngine:
    def __init__(self, dataset_path: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parents[1]
        self.dataset_path = Path(dataset_path) if dataset_path else base_dir / "data" / "auralith_songs.json"
        self.songs = self._load_songs()
        self.dimension = 64
        self.matrix = self._embed_many(self._serialize_song(song) for song in self.songs)

    def _load_songs(self) -> list[dict]:
        if not self.dataset_path.exists():
            import sys
            print(f"WARNING: auralith dataset not found at {self.dataset_path} — engine will run with empty catalog", file=sys.stderr)
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

    def _embed(self, text: str) -> np.ndarray:
        vector = np.zeros(self.dimension, dtype="float32")
        normalized = text.lower().replace("/", " ").replace(",", " ").replace("-", " ")
        tokens = [token for token in normalized.split() if token]
        if not tokens:
            return vector
        for token in tokens:
            vector[self._hash_token(token)] += 1.0
        norm = np.linalg.norm(vector)
        return vector if norm == 0 else vector / norm

    def _embed_many(self, texts) -> np.ndarray:
        return np.vstack([self._embed(text) for text in texts]).astype("float32")

    def _profile_context(self, profile: dict | None) -> dict:
        profile = profile or {}
        genres = [item for item in profile.get("genres", []) if item][:6]
        top_artists = [item for item in (profile.get("topArtists") or profile.get("favoriteArtists") or []) if item][:6]
        top_tracks = [item for item in profile.get("topTracks", []) if item][:6]
        recent_tracks = [item for item in profile.get("recentlyPlayed", []) if item][:6]
        liked_songs = [item for item in profile.get("likedSongs", []) if item][:6]
        saved_playlists = [item for item in profile.get("savedPlaylists", []) if item][:4]
        aesthetic_tags = [item for item in profile.get("aestheticTags", []) if item][:6]
        mood_preferences = [item for item in profile.get("moodPreferences", []) if item][:4]
        audio = profile.get("audioFeatures") or {}
        analytics = profile.get("analyticsMetrics") or {}
        return {
            "genres": genres,
            "top_artists": top_artists,
            "top_tracks": top_tracks,
            "recent_tracks": recent_tracks,
            "liked_songs": liked_songs,
            "saved_playlists": saved_playlists,
            "aesthetic_tags": aesthetic_tags,
            "mood_preferences": mood_preferences,
            "personality": profile.get("personality") or "",
            "mbti": profile.get("mbti") or "",
            "time_range": profile.get("timeRange") or "medium_term",
            "user_name": (profile.get("userProfile") or {}).get("name") or "",
            "audio": audio,
            "analytics": analytics,
        }

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
            parts.append(context["personality"])
        if context["mbti"]:
            parts.append(context["mbti"])
        if context["analytics"].get("mood"):
            parts.append(context["analytics"]["mood"])
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
                "tempo": "mid-tempo",
                "energy": "measured",
                "texture": "atmospheric",
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
        if not profile:
            return "This sequence stays coherent by holding to one emotional climate while varying texture and pacing."
        anchors = []
        if context["genres"]:
            anchors.append(f"it keeps one foot in your {context['genres'][0]} lean")
        if context["top_artists"]:
            anchors.append(f"it carries the atmospheric weight you tend to favor around {context['top_artists'][0]}")
        if context["analytics"].get("mood"):
            anchors.append(f"it stays close to the {context['analytics']['mood']} current in your profile")
        if not anchors and songs:
            anchors.append("it mirrors the pacing and tonal restraint in your current listening")
        return "Why this fits your taste: " + "; ".join(anchors[:3]) + "."

    def generate_playlist(self, prompt: str, profile: dict | None = None, limit: int = 8) -> dict:
        songs = self._personalized_search(prompt, profile, limit=max(limit, 8))
        selected = songs[:limit]
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
            "used_model": "melody-map-auralith",
        }

    def analyze_taste(self, seeds: list[str], profile: dict | None = None) -> dict:
        songs = self.search_by_names(seeds, profile=profile, limit=8)
        context = self._profile_context(profile)
        dominant_traits = [
            "Atmosphere before spectacle",
            "Emotional precision over obvious catharsis",
            "A preference for pacing that drifts rather than rushes",
        ]
        if context["audio"].get("energy", 0.5) > 0.62:
            dominant_traits[2] = "Controlled tension with a taste for propulsion"
        hidden_patterns = [
            "You consistently choose songs with interior pressure instead of loud release",
            "Texture matters to you as much as melody, even when genres change",
            "You return to voices and mixes that feel close rather than grand",
        ]
        if context["recent_tracks"]:
            hidden_patterns.append("Your recent listening suggests you test subtle variations in mood before you make sharper genre jumps")
        return {
            "taste_profile": "Your taste leans toward music that feels intimate, textural, and emotionally exact rather than merely genre-correct.",
            "dominant_traits": dominant_traits,
            "hidden_patterns": hidden_patterns[:4],
            "sonic_preferences": self.describe_profile(songs[:6]),
            "emotional_signature": "Reflective, dusk-lit, and emotionally precise.",
            "exploration_suggestions": [
                "Try records that keep intimacy but introduce more rhythmic lift",
                "Use downtempo or left-field electronic cuts to widen contrast without losing atmosphere",
                "Follow artists adjacent to your top genres, not only the same canon names",
            ],
            "recommendation_direction": "Expand into art pop, downtempo, and left-field electronic releases that preserve closeness while widening dynamic range.",
            "retrieved_context": songs,
            "used_model": "melody-map-auralith",
        }

    def explain_song(self, prompt: str, profile: dict | None = None) -> dict:
        songs = self.search_by_names([prompt], profile=profile, limit=6)
        song = songs[0] if songs else {
            "title": prompt,
            "artist": "Unknown",
            "genre": "Unknown",
            "mood": "Evocative",
            "energy": 0.4,
            "valence": 0.4,
            "tempo": 95,
            "description": "its structure and texture create a focused emotional impression.",
        }
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
            "used_model": "melody-map-auralith",
        }

    def critique_playlist(self, songs_or_artists: list[str], profile: dict | None = None) -> dict:
        songs = self.search_by_names(songs_or_artists, profile=profile, limit=8)
        context = self._profile_context(profile)
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
            "used_model": "melody-map-auralith",
        }

    def concept_playlist(self, prompt: str, profile: dict | None = None, limit: int = 8) -> dict:
        songs = self._personalized_search(prompt, profile, limit=max(limit, 8))
        selected = songs[:limit]
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
            "used_model": "melody-map-auralith",
        }
