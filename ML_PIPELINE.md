# ML Pipeline

Melody Map has two distinct ML layers: a **client-side personality engine** (pure JavaScript, runs in the browser) and a **server-side pipeline** (Python, runs on Render). They operate independently and serve different purposes.

---

## Client-Side: personalityEngine.js

Located at `frontend/src/utils/personalityEngine.js`. Pure functions — no API calls, no side effects. Called once inside `useMusicProfile` after the profile data loads, results cached in Zustand.

### Personality Archetypes

Six archetypes, each with a weighted scoring formula over Spotify audio features:

| Archetype | Key signals | Formula weights |
|-----------|-------------|-----------------|
| Dreamy | High acousticness, mid valence, low energy | acousticness 50%, valence 30%, inverse energy 20% |
| Nostalgic | Low tempo, high acousticness | inverse tempo 55%, acousticness 45% |
| Chaotic | High energy, high tempo | energy 55%, tempo 45% |
| Romantic | High valence, high acousticness, low energy | valence 45%, acousticness 35%, inverse energy 20% |
| Melancholic | Low valence, low energy | inverse valence 65%, inverse energy 35% |
| Cosmic | High instrumentalness, high acousticness, low energy | instrumentalness 50%, acousticness 30%, inverse energy 20% |

`computePersonality(audioFeatures)` scores all six, normalizes to 100%, returns top 3 with percentage scores and metadata (label, emoji, color, description).

### Music MBTI

`computeMBTI(profile)` derives four independent axes from different data dimensions:

**I/E — Introversion vs Extraversion**
```
ie_score = acousticness * 0.5 + (1 - danceability) * 0.5
I = ie_score > 0.5
```

**N/S — Intuition vs Sensing**
```
genre_diversity = unique_genres / 15  (capped at 1.0)
N = genre_diversity > 0.5
```
Genre diversity is computed from the `genres` array in the profile — more unique genres = more intuitive.

**T/F — Thinking vs Feeling**
```
tf_score = instrumentalness * 0.5 + (1 - valence) * 0.5
T = tf_score > 0.5
```

**J/P — Judging vs Perceiving**
```
popularity_spread = std_dev(artist popularities)
P = spread > 0.25
```
High spread in artist popularity (mixing mainstream + obscure) signals Perceiving.

The four booleans combine into one of 16 MBTI types. Each type has a named identity (e.g. INFP = "The Dream Listener", ENTP = "The Genre Disruptor").

### Advanced Compatibility

`computeAdvancedCompatibility(profileA, profileB)` runs client-side for the soulmate preview. Weights: genre overlap 35%, artist overlap 35%, audio cosine similarity 30%. Also computes mood alignment, discovery match (popularity spread similarity), and era match (average release year proximity).

---

## Server-Side: Python ML Modules

All modules in `backend/ml/`. Pure Python — no Flask imports — so they can be tested independently.

---

### aesthetic_engine.py

Converts a taste profile into a full visual identity. No ML models — deterministic algorithms seeded by audio features.

**`generate_aesthetic_name(genres, energy, valence, seed_offset)`**

Picks a 2–3 word poetic label. Mood word selected by energy bucket (high → "Neon/Electric/Blazing", low → "Midnight/Obsidian/Phantom"). Environment word from genre-specific map or valence bucket. Optional time-of-day word (60% chance) from genre map. All selections seeded by `hash(sorted_genres + energy + valence)` for reproducibility.

**`generate_palette(genres, energy, valence)`**

Returns 5 hex colors. Checks genre-specific palettes first (30 genres mapped). Falls back to a 5-bucket energy/valence matrix.

**`classify_vibe(energy, valence, tempo)`**

Maps the exact energy/valence/tempo coordinates to one of 18 named vibe labels with accent hex colors. Examples:
- energy > 0.75, valence > 0.70, tempo > 130 → "Neon Euphoria Rush" `#ff6ec7`
- energy 0.25–0.50, valence 0.35–0.65, tempo < 90 → "Rainy Window Solitude" `#90e0ef`
- energy < 0.25, valence < 0.50 → "Hollow Midnight Cathedral" `#16213e`

**`generate_poetic_persona(genres, energy, valence, tempo)`**

Matches against 6 persona archetypes (Melancholic Voyager, High-Energy Architect, Velvet Romantic, Neon Futurist, Golden Nostalgist, Cosmic Drifter). Returns a full identity report: name, tagline, narrative paragraph, keywords, and the vibe classification.

**`generate_shared_aesthetic(tags_a, tags_b, shared_genres, shared_artists)`**

For soulmate pairs. Intersects both tag sets, generates a combined aesthetic name seeded by shared content, writes a shared vibe description.

---

### discover_engine.py

Generates personalized playlist concepts. No external API calls — returns seeds for Spotify resolution on the frontend.

**Archetypes**

10 `PlaylistArchetype` dataclasses, each defining:
- `energy_range`, `valence_range` — the audio feature space it occupies
- `seed_genres`, `seed_artists`, `seed_queries` — for Spotify API calls
- `title_templates`, `descriptions`, `why_templates` — content pools
- `mood_tags`, `aesthetic_tags`, `era_tags`, `color` — metadata

The 10 archetypes: Nocturnal Drift, Golden Nostalgia, Neon Kinetic, Velvet Soul, Cosmic Expanse, Urban Pulse, Ethereal Bloom, Storm & Shadow, Global Reverie, Vaporwave Reverie.

**Scoring**

```python
def _score_archetype(archetype, genres, energy, valence):
    score = 0.0
    # Energy range match: up to 0.4
    if e_lo <= energy <= e_hi:
        score += 0.4
    else:
        score += max(0, 0.4 - distance_to_range)
    # Valence range match: up to 0.3
    if v_lo <= valence <= v_hi:
        score += 0.3
    else:
        score += max(0, 0.3 - distance_to_range)
    # Genre overlap: +0.1 per matching genre (capped)
    for seed_genre in archetype.seed_genres:
        for user_genre in genres:
            if seed_genre in user_genre or user_genre in seed_genre:
                score += 0.1
                break
    return score
```

Top 3 archetypes always included. Remaining slots randomly sampled from the rest (seeded by energy + valence) for variety.

**Serendipity mode**

Inverts the ranking — anchors 1 familiar archetype, fills the rest from the 5 lowest-scoring (most different from the user's taste). Activated by `serendipity=true` in the request.

**Harmonic Mood Vector**

Each response includes a `harmonic_mood_vector` — a named aesthetic descriptor computed by cross-referencing genre + energy/valence bucket against a 22-entry lookup table. Examples:
- shoegaze + low energy + low valence → "Liminal Space Nostalgia"
- synthwave + high energy + mid valence → "Neon Petrichor Highway"
- lo-fi + low energy + mid valence → "Warm Cassette Drift"

Falls back to composing from energy/valence word banks if no genre match.

---

### soulmate_engine.py

Computes taste compatibility between two users.

**Scoring formula**

```python
WEIGHTS = {
    'artists': 0.40,
    'genres':  0.25,
    'audio':   0.20,
    'tracks':  0.10,
    'vibe':    0.05,
}

# Jaccard similarity for set dimensions
jaccard(A, B) = |A ∩ B| / |A ∪ B|

# Cosine similarity for audio features
audio_vector = [energy, valence, danceability, acousticness, instrumentalness, speechiness]
audio_sim = cosine_similarity([vec_a], [vec_b])[0][0]  # scikit-learn

# Vibe proximity
vibe_sim = max(0, 1 - (|energy_a - energy_b| + |valence_a - valence_b|) / 2)

match_score = round(weighted_sum * 100)  # 0–100
```

All name comparisons are lowercased and stripped before Jaccard computation.

**Constellation graph**

`build_constellation_graph(profile_a, profile_b)` returns a `{ nodes, links }` structure:
- Shared artists → `type: "shared"` (center nodes)
- User A exclusive → `type: "user_a"`
- User B exclusive → `type: "user_b"`
- Links: exclusive artists connect to the nearest shared artist (strength 0.3); shared artists link to each other in sequence (strength 0.8)

Capped at 12 shared + 10 per user = 32 nodes max.

---

### similarity_engine.py

Used by the internal `/api/map/generate` and `/api/songs/<id>/similar` routes.

**Feature extraction**

Extracts 8 audio features per song: `tempo`, `energy`, `danceability`, `valence`, `acousticness`, `instrumentalness`, `loudness`, `speechiness`. Normalizes with `StandardScaler` (zero mean, unit variance).

**Clustering**

K-Means with `n_clusters=10`, `random_state=42`, `n_init=10`. Each song gets a `cluster_id` stored in MongoDB.

**Dimensionality reduction**

- 2D: PCA (`n_components=2`) → stored as `map_coordinates: {x, y}`
- 3D: PCA (`n_components=3`) → stored as `map_coords_3d: {x, y, z}`

**Similarity search**

KNN fitted on the full song feature matrix. `find_similar_songs(song_features, all_features, top_k=10)` returns indices and cosine similarity scores.

---

### recommendation_engine.py

Used by `/api/playlists/generate` and `/api/recommendations/<user_id>`.

**User profile**

Built from interaction history — averages audio features of liked/played songs, weighted by interaction type.

**Content-based filtering**

Cosine similarity between user profile vector and all song feature vectors. Returns top K by score.

**Collaborative filtering**

Finds users with overlapping liked songs, aggregates their other liked songs, weights by overlap count.

**Hybrid**

Content-based 60% + collaborative 40%.

**Mood-based playlist**

Maps mood string to audio feature ranges, filters songs matching all constraints, ranks by relevance, returns up to 20 songs.

---

### music_profile_builder.py (services/)

Not in `ml/` but the core data pipeline. Called by `/api/music-profile`.

Makes direct Spotify Web API calls (no internal proxy self-calls):
1. `/me` — user profile
2. `/me/top/artists` — up to 50 artists
3. `/me/top/tracks` — up to 50 tracks
4. `/me/player/recently-played` — up to 50, deduplicated
5. `/me/tracks` — up to 50 saved tracks, deduplicated
6. `/audio-features?ids=...` — batched for all collected track IDs

Computes:
- Average audio features across all tracks
- Genre frequency counts from artist genre arrays
- Aesthetic tags from `GENRE_AESTHETIC_MAP` + energy/valence tag banks
- Galaxy nodes: genre nodes positioned on a circle by frequency, artist nodes clustered around their primary genre with audio-feature-based jitter
- Analytics metrics: mood label, energy/valence/danceability scores, nostalgia index (average release year distance from current year), diversity score (Shannon entropy of genre distribution), sonic brightness (valence 45% + energy 35% + inverse acousticness 20%)

---

## Lazy loading

ML engines (`similarity_engine`, `recommendation_engine`) are lazy-loaded in `app.py`:

```python
try:
    from ml.similarity_engine import MusicSimilarityEngine
    similarity_engine = MusicSimilarityEngine(n_clusters=10)
except Exception as e:
    logger.error({'event': 'ml_engines_failed', 'err': str(e)})
    similarity_engine = None
```

If scikit-learn fails to import (e.g. memory constraints on free Render tier), all blueprint routes still register and work. Only the three ML-dependent routes return `503`.

---

## Vector store

The **official vector store is MongoDB `embedding_registry`** (profile, track, and
`auralith_chunk` vectors, keyed by `(entity_type, entity_id, embedding_version)`).
`ml/serving/retrieval_service.py` queries it by cosine similarity and labels results
`source: "embedding_registry"`. At the current corpus size (~1k vectors) a Mongo cosine
scan is single-digit milliseconds, so FAISS adds no measurable win.

FAISS is **optional acceleration only** — used when a real, non-empty index has been
built (`ml/serving/build_faiss_index.py`) and activated. There is intentionally no
on-disk FAISS index checked in; an earlier empty scaffold (`item_count: 0`, `ntotal: 0`,
under `backend/data/indexes/`, which is gitignored) was removed because it was only ever
mistaken for a real index.

## Training-run integrity (smoke-test tagging)

Training runs are auto-classified by dataset size (`classify_run` in
`ml/training/pipelines/train_two_tower.py`). A run is tagged **`run_type: "smoke_test"`**
— in `metrics.json`, `mlflow_run.json`, and as MLflow tags — when items < 50, users < 5,
or windows < 50. This prevents trivially-saturated metrics from reading as real eval:
with a sub-50-item catalogue, `recall@50` is ~1.0 by construction. `recall@10` is also
logged as a more honest signal until the catalogue grows. Current runs (toy `v1` and the
real-data `v2-mongo`: 111 interactions / 2 users / 47 items) are all `smoke_test` —
meaningful retrieval evaluation needs ≥5 users and a ≥50-track catalogue.
