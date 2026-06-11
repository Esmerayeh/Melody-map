"""
Music Soulmate Engine
---------------------
Builds a structured compatibility reading across overlap, identity,
emotional resonance, discovery, tension, and archetype.
"""

from __future__ import annotations

from ml.soulmate_narratives import (
    build_compatibility_narrative,
    build_confidence_note,
    build_discovery_narrative,
    build_mbti_narrative,
    build_orb_narrative,
    build_shared_atmosphere_narrative,
    build_tension_narrative,
)
from ml.soulmate_scoring import (
    AUDIO_KEYS,
    classify_relationship_archetype,
    compatibility_tier,
    compute_artist_overlap,
    compute_discovery_compatibility,
    compute_emotional_compatibility,
    compute_genre_overlap,
    compute_mbti_compatibility,
    compute_orb_resonance,
    compute_overall_compatibility,
    compute_rarity,
    compute_song_overlap,
    compute_tension_profile,
    confidence_label,
    generate_bridge_tracks,
    genre_weight_map,
    normalize_audio,
    normalize_score,
    normalize_name_set,
    display_name,
    slugify,
)
from ml.representation_learning import cosine_similarity


def _names(items: list[dict | str] | None, *keys: str, limit: int = 6) -> list[str]:
    output = []
    for item in items or []:
        name = display_name(item, *keys)
        if name and name not in output:
            output.append(name)
        if len(output) >= limit:
            break
    return output


def _identity_label(profile: dict) -> str:
    identity = profile.get('musicIdentity') or {}
    identity_type = identity.get('type') if isinstance(identity, dict) else {}
    return (
        (identity_type or {}).get('name')
        or profile.get('sonicPersonalityTitle')
        or ((profile.get('mbtiProfile') or profile.get('mbti') or {}).get('name') if isinstance(profile.get('mbtiProfile') or profile.get('mbti'), dict) else None)
        or profile.get('mbtiType')
        or 'listening self'
    )


def _blend_audio(profile_a: dict, profile_b: dict) -> dict:
    audio_a = normalize_audio(profile_a.get('audioFeatures') or profile_a.get('audio'))
    audio_b = normalize_audio(profile_b.get('audioFeatures') or profile_b.get('audio'))
    blended = {}
    for key in AUDIO_KEYS:
        values = [value for value in [audio_a.get(key), audio_b.get(key)] if value is not None]
        if values:
            blended[key] = round(sum(values) / len(values), 3)
    return blended


def _shared_list(*groups: list[str], limit: int = 8) -> list[str]:
    output = []
    for group in groups:
        for item in group or []:
            if item and item not in output:
                output.append(item)
            if len(output) >= limit:
                return output
    return output


class SoulmateEngine:
    def compute_learned_similarity(self, profile_a: dict, profile_b: dict) -> float:
        embedding_a = ((profile_a.get('representations') or {}).get('profileVector')) or profile_a.get('profileVector')
        embedding_b = ((profile_b.get('representations') or {}).get('profileVector')) or profile_b.get('profileVector')
        return normalize_score(cosine_similarity(embedding_a, embedding_b) * 100) if embedding_a and embedding_b else 0

    def compute_score(self, profile_a: dict, profile_b: dict) -> dict:
        embedding_similarity = self.compute_learned_similarity(profile_a, profile_b)

        artist = compute_artist_overlap(profile_a, profile_b)
        genre = compute_genre_overlap(profile_a, profile_b)
        song = compute_song_overlap(profile_a, profile_b)
        emotional = compute_emotional_compatibility(profile_a, profile_b)
        mbti = compute_mbti_compatibility(profile_a, profile_b)
        discovery = compute_discovery_compatibility(profile_a, profile_b, artist, genre, emotional)
        tension = compute_tension_profile(profile_a, profile_b, emotional, discovery)
        orb = compute_orb_resonance(emotional, mbti, tension, profile_a, profile_b)

        confidence_score = round(
            min(
                1.0,
                (
                    artist.confidence_weight
                    + genre.confidence_weight
                    + song.confidence_weight
                    + emotional.confidence_weight
                    + mbti.confidence_weight
                ) / 5.0,
            ),
            3,
        )

        overall = compute_overall_compatibility(
            emotional=emotional,
            mbti=mbti,
            artist=artist,
            genre=genre,
            song=song,
            discovery=discovery,
            tension=tension,
            orb=orb,
            confidence=confidence_score,
        )
        if embedding_similarity:
            overall = normalize_score(overall * 0.84 + embedding_similarity * 0.16)
        rarity = compute_rarity(overall, emotional, discovery, tension, artist, genre, mbti)
        bridges = generate_bridge_tracks(profile_a, profile_b)

        metrics = {
            'overallCompatibility': overall,
            'emotionalCompatibility': emotional.score,
            'mbtiCompatibility': mbti.score,
            'orbResonanceScore': orb.score,
            'artistOverlapScore': artist.score,
            'genreOverlapScore': genre.score,
            'songOverlapScore': song.score,
            'discoveryCompatibility': discovery.score,
            'tensionScore': tension.score,
            'embeddingSimilarity': embedding_similarity,
            'rarityScore': rarity.score,
            'sharedAtmosphere': emotional.details.get('sharedAtmosphere', []),
            'mbtiTypes': mbti.details.get('mbtiTypes', []),
            'mbtiMatchType': mbti.details.get('mbtiMatchType'),
            'sharedTraits': mbti.details.get('sharedTraits', []),
            'orbHarmony': orb.details.get('orbHarmony'),
            'auraOverlap': orb.details.get('auraOverlap', []),
            'phaseAlignment': orb.details.get('phaseAlignment'),
            'tensionType': tension.details.get('tensionType'),
            'complementaryTraits': tension.details.get('complementaryTraits', []),
            'contrastingTraits': tension.details.get('contrastingTraits', []),
            'userAToUserBDiscovery': discovery.details.get('userAToUserB', 0),
            'userBToUserADiscovery': discovery.details.get('userBToUserA', 0),
        }
        archetype = classify_relationship_archetype(metrics)
        metrics.update(archetype)

        confidence = {
            'score': confidence_score,
            'label': confidence_label(confidence_score),
        }

        note = build_confidence_note(confidence_score)
        evidence_receipts = []
        shared_artists = artist.details.get('sharedArtists', [])
        shared_genres = genre.details.get('sharedGenres', [])
        shared_tracks = [item.get('title') for item in bridges.get('sharedTracks', []) if item.get('title')]
        metrics['sharedArtists'] = shared_artists
        metrics['sharedGenres'] = shared_genres
        if shared_artists:
            evidence_receipts.append(f"Shared Spotify artist anchors: {', '.join(shared_artists[:5])}.")
        if shared_genres:
            evidence_receipts.append(f"Shared genre gravity: {', '.join(shared_genres[:5])}.")
        if shared_tracks:
            evidence_receipts.append(f"{len(shared_tracks)} shared top-track anchors were detected.")
        if emotional.details.get('audioSimilarity') is not None:
            evidence_receipts.append(f"Audio-feature similarity scored {emotional.details.get('audioSimilarity')} across {', '.join(AUDIO_KEYS[:6])}.")
        if embedding_similarity:
            evidence_receipts.append(f"Learned profile-vector similarity contributed {embedding_similarity} points.")
        evidence_receipts.append(f"Overall confidence is {confidence['label']} from available artist, genre, track, audio, and identity fields.")

        combined_galaxy = self.build_combined_galaxy(profile_a, profile_b, metrics, bridges)
        combined_orb = self.build_combined_soul_orb(profile_a, profile_b, metrics)
        duo_identity = self.build_duo_identity(profile_a, profile_b, metrics, evidence_receipts)
        shared_atmosphere_identity = self.build_shared_atmosphere(profile_a, profile_b, metrics)
        dual_recommendations = self.build_dual_recommendations(profile_a, profile_b, bridges, metrics)

        result = {
            **metrics,
            'compatibilityTier': compatibility_tier(overall),
            'rarityLabel': rarity.details.get('rarityLabel'),
            'sharedArtists': artist.details.get('sharedArtists', []),
            'sharedGenres': genre.details.get('sharedGenres', []),
            'sharedTracks': shared_tracks,
            'bridgeTracks': bridges.get('bridgeTracks', []),
            'userAToUserBRecommendations': bridges.get('userAToUserBRecommendations', []),
            'userBToUserARecommendations': bridges.get('userBToUserARecommendations', []),
            'beautifulTensionNarrative': build_tension_narrative(metrics),
            'compatibilityNarrative': build_compatibility_narrative(metrics),
            'mbtiNarrative': build_mbti_narrative(metrics),
            'orbNarrative': build_orb_narrative(metrics),
            'sharedAtmosphereNarrative': build_shared_atmosphere_narrative(metrics),
            'discoveryNarrative': build_discovery_narrative(metrics),
            'archetypeSummary': archetype.get('archetypeSummary'),
            'whyThisWorks': build_compatibility_narrative(metrics),
            'evidenceReceipts': evidence_receipts,
            'whyThisWorksEvidence': evidence_receipts[:5],
            'combinedGalaxy': combined_galaxy,
            'combinedSoulOrb': combined_orb,
            'duoIdentity': duo_identity,
            'sharedAtmosphereIdentity': shared_atmosphere_identity,
            'songsBothMayLove': dual_recommendations.get('songsBothMayLove', []),
            'comfortSongs': dual_recommendations.get('comfortSongs', []),
            'discoverySongs': dual_recommendations.get('discoverySongs', []),
            'bridgeSongs': dual_recommendations.get('bridgeSongs', []),
            'shareSafeSummary': {
                'sharedArtists': shared_artists[:5],
                'sharedGenres': shared_genres[:5],
                'compatibilityPercentage': overall,
                'rawListeningHistoryIncluded': False,
            },
            'whereItGetsInteresting': build_tension_narrative(metrics),
            'confidence': confidence,
            'learnedCompatibility': embedding_similarity,
            'learnedModelVersion': 'soulmate-siamese-v1' if embedding_similarity else None,
            'hybridBlend': 0.16 if embedding_similarity else 0.0,
            'note': note,
            'match_score': overall,
            'shared_artists': artist.details.get('sharedArtists', []),
            'shared_tracks': [item.get('title') for item in bridges.get('sharedTracks', [])],
            'shared_genres': genre.details.get('sharedGenres', []),
            'breakdown': {
                'artists': artist.score,
                'genres': genre.score,
                'audio': emotional.details.get('audioSimilarity'),
                'tracks': song.score,
                'vibe': emotional.details.get('moodAlignment'),
                'mood_alignment': emotional.score,
                'discovery_match': discovery.score,
                'era_match': song.details.get('eraSimilarity'),
                'mbti': mbti.score,
                'orb': orb.score,
                'tension': tension.score,
            },
            'methodology': {
                'audio_keys': AUDIO_KEYS,
                'overall': {
                    'emotionalCompatibility': 0.23,
                    'mbtiCompatibility': 0.17,
                    'artistOverlapScore': 0.12,
                    'genreOverlapScore': 0.10,
                'songOverlapScore': 0.06,
                'discoveryCompatibility': 0.14,
                'orbResonanceScore': 0.12,
                'embeddingSimilarity': 0.16,
                'tensionBonus': 'healthy tension peaks near the middle rather than zero',
                'confidence': 'final score is gently modulated by data confidence',
            },
            },
        }
        return result

    def build_combined_galaxy(self, profile_a: dict, profile_b: dict, metrics: dict, bridges: dict | None = None) -> dict:
        graph = self.build_constellation_graph(
            profile_a,
            profile_b,
            user_a_name=profile_a.get('username', 'You'),
            user_b_name=profile_b.get('username', 'Soulmate'),
        )
        shared_artists = metrics.get('sharedArtists') or []
        shared_genres = metrics.get('sharedGenres') or []
        bridge_tracks = (bridges or {}).get('bridgeTracks', [])

        regions = []
        if shared_artists:
            regions.append({
                'id': 'overlap_constellation',
                'label': 'Overlap constellation',
                'kind': 'shared',
                'description': f"This cluster glows from shared artist anchors like {', '.join(shared_artists[:3])}.",
                'evidence': shared_artists[:5],
            })
        if bridge_tracks:
            regions.append({
                'id': 'bridge_arc',
                'label': 'Bridge arc',
                'kind': 'bridge',
                'description': 'These songs sit between both profiles and are the best share-safe bridge candidates.',
                'evidence': [track.get('title') for track in bridge_tracks[:5] if track.get('title')],
            })
        if metrics.get('tensionScore', 0) >= 55:
            regions.append({
                'id': 'contrast_zone',
                'label': 'Contrast zone',
                'kind': 'contrast',
                'description': 'This region shows where one listener can expand the other without flattening the match.',
                'evidence': metrics.get('contrastingTraits', [])[:4],
            })

        return {
            'graph': graph,
            'regions': regions,
            'legend': {
                'shared': 'shared artist nodes',
                'user_a': f"{profile_a.get('username', 'User A')}-only anchors",
                'user_b': f"{profile_b.get('username', 'User B')}-only anchors",
                'bridge': 'songs or artists that connect the two maps',
            },
            'explanations': [
                'Shared nodes glow brighter because both Spotify profiles contain the same artist anchors.',
                'Bridge arcs are derived from top tracks that fit the other listener by artist, genre, era, or audio-feature profile.',
                'Contrast zones are shown when discovery and tension scores suggest useful difference rather than pure mismatch.',
            ],
            'summary': f"Your combined galaxy is built from {len(shared_artists)} shared artists, {len(shared_genres)} shared genres, and {len(bridge_tracks)} bridge tracks.",
        }

    def build_combined_soul_orb(self, profile_a: dict, profile_b: dict, metrics: dict) -> dict:
        blended = _blend_audio(profile_a, profile_b)
        compatibility = metrics.get('overallCompatibility', 0)
        complementarity = max(metrics.get('tensionScore', 0), metrics.get('discoveryCompatibility', 0))
        emotional = metrics.get('emotionalCompatibility', 0)
        valence = blended.get('valence', 0.45)
        energy = blended.get('energy', 0.45)
        acousticness = blended.get('acousticness', 0.3)

        if emotional >= 78 and complementarity < 58:
            mode = 'merged center glow'
        elif complementarity >= 62:
            mode = 'two orbiting cores'
        else:
            mode = 'soft braided orbit'

        if valence < 0.38 and acousticness >= 0.35:
            colors = ['#8f75ff', '#f28ddf', '#8baaff', '#f5c98a']
            signature = 'atmospheric melancholy'
        elif energy >= 0.62:
            colors = ['#9fd0ff', '#f5b97a', '#ff7cc8', '#b68dff']
            signature = 'charged motion'
        else:
            colors = ['#b68dff', '#c8b8ff', '#8baaff', '#f28ddf']
            signature = 'soft resonance'

        return {
            'name': f"{metrics.get('relationshipArchetype', 'Dual Orbit')} orb",
            'mode': mode,
            'colors': colors,
            'blendedAudio': blended,
            'pulseSync': metrics.get('phaseAlignment') or metrics.get('orbResonanceScore', 0),
            'haloStrength': emotional,
            'orbitDistance': normalize_score(100 - emotional + complementarity * 0.28),
            'compatibilityScore': compatibility,
            'complementarityScore': complementarity,
            'description': f"Your shared orb pulses strongest around {signature}, shaped by audio-feature similarity, shared genres, and productive contrast.",
            'dataBasis': ['audio features', 'shared genres', 'artist overlap', 'tension score', 'discovery score'],
        }

    def build_duo_identity(self, profile_a: dict, profile_b: dict, metrics: dict, evidence: list[str]) -> dict:
        archetype_id = metrics.get('archetypeId')
        name_map = {
            'rare_alignment': 'The Twin Nocturnes',
            'twin_dreamers': 'The Twin Nocturnes',
            'midnight_orbit': 'The Moonlit Frequency',
            'magnetic_contrast': 'The Velvet Collision',
            'silver_echoes': 'The Liminal Pair',
        }
        pair_name = name_map.get(archetype_id, 'The Dream-Static Bond')
        shared_artists = metrics.get('sharedArtists') or []
        shared_genres = metrics.get('sharedGenres') or []
        shared_atmosphere = metrics.get('sharedAtmosphere') or []

        dominant_axis = 'emotional resonance' if metrics.get('emotionalCompatibility', 0) >= max(metrics.get('artistOverlapScore', 0), metrics.get('genreOverlapScore', 0)) else 'taste overlap'
        complementary_axis = 'discovery tension' if metrics.get('tensionScore', 0) >= 55 else 'comfort recognition'

        meet = f"You meet through {', '.join(shared_artists[:3])}." if shared_artists else f"You meet through {', '.join(shared_genres[:3]) or 'adjacent emotional texture'}."
        diverge = 'One of you can open a discovery corridor for the other.' if metrics.get('discoveryCompatibility', 0) >= 55 else 'Your differences are subtle, mostly in how each profile carries the same mood.'

        return {
            'pairName': pair_name,
            'compatibilityArchetype': metrics.get('relationshipArchetype'),
            'sharedEmotionalSignature': ', '.join(shared_atmosphere[:3]) or metrics.get('orbHarmony') or 'shared resonance',
            'dominantSharedAxis': dominant_axis,
            'complementaryAxis': complementary_axis,
            'whatYouBothSeek': f"{profile_a.get('username', 'One listener')} and {profile_b.get('username', 'the other')} both seek music with {dominant_axis}.",
            'whereYouMeet': meet,
            'whereYouDiverge': diverge,
            'oneLine': f"{pair_name}: {metrics.get('archetypeSummary', 'two music identities in a shared field')}",
            'evidence': evidence[:5],
            'individualIdentities': [_identity_label(profile_a), _identity_label(profile_b)],
        }

    def build_shared_atmosphere(self, profile_a: dict, profile_b: dict, metrics: dict) -> dict:
        shared_genres = metrics.get('sharedGenres') or []
        shared_artists = metrics.get('sharedArtists') or []
        shared_atmosphere = metrics.get('sharedAtmosphere') or []
        blended = _blend_audio(profile_a, profile_b)
        valence = blended.get('valence', 0.45)
        energy = blended.get('energy', 0.45)
        acousticness = blended.get('acousticness', 0.25)

        first = 'Silver Rain' if valence < 0.4 else 'Violet Light' if energy < 0.55 else 'Neon Bloom'
        second = 'Cathedral' if acousticness >= 0.38 else 'Observatory' if shared_genres else 'Afterglow'
        name = f"{first} {second}"

        tags = _shared_list(
            shared_atmosphere,
            shared_genres,
            ['moonlit rooms' if valence < 0.42 else 'warm light', 'soft grain', 'listening-era fragments'],
            limit=8,
        )
        palette = ['#090815', '#8f75ff', '#f28ddf', '#8baaff', '#f5c98a'] if valence < 0.45 else ['#070912', '#9fd0ff', '#f5b97a', '#f28ddf', '#c8b8ff']
        query_core = ' '.join((shared_genres or shared_atmosphere or ['cinematic music atmosphere'])[:3])

        return {
            'name': name,
            'palette': palette,
            'visualTags': tags,
            'unsplashQueries': [
                f"{query_core} night atmosphere",
                f"{query_core} cinematic light",
                f"{query_core} dreamy interior",
            ],
            'pinterestReadyQueries': [
                f"{name} music atmosphere",
                f"{query_core} editorial mood archive",
            ],
            'explanation': f"This atmosphere comes from shared Spotify evidence: {', '.join(shared_artists[:3]) or 'adjacent artists'}, {', '.join(shared_genres[:3]) or 'nearby genres'}, and blended audio features.",
            'source': 'Spotify-derived mood and genre translation; no Pinterest API connection is assumed.',
        }

    def build_dual_recommendations(self, profile_a: dict, profile_b: dict, bridges: dict, metrics: dict) -> dict:
        def enrich(track: dict, category: str, fallback_reason: str) -> dict:
            return {
                'title': track.get('title'),
                'artist': track.get('artist'),
                'score': track.get('score', metrics.get('overallCompatibility', 0)),
                'category': category,
                'whyItFitsBoth': track.get('reason') or fallback_reason,
                'source': track.get('source') or category,
            }

        shared_tracks = [enrich(track, 'comfort', 'Both profiles already contain this song as a shared anchor.') for track in bridges.get('sharedTracks', [])]
        bridge_tracks = [enrich(track, 'bridge', 'This track sits between one profile and the other by artist, genre, era, or audio features.') for track in bridges.get('bridgeTracks', [])]
        discovery_a = [enrich(track, 'discovery', f"This comes from {profile_a.get('username', 'one listener')}'s orbit and fits the other profile.") for track in bridges.get('userAToUserBRecommendations', [])]
        discovery_b = [enrich(track, 'discovery', f"This comes from {profile_b.get('username', 'the other listener')}'s orbit and fits the other profile.") for track in bridges.get('userBToUserARecommendations', [])]

        combined = []
        seen = set()
        for item in shared_tracks + bridge_tracks + discovery_a + discovery_b:
            key = slugify(f"{item.get('title')} {item.get('artist')}")
            if not item.get('title') or key in seen:
                continue
            seen.add(key)
            combined.append(item)

        return {
            'songsBothMayLove': combined[:8],
            'comfortSongs': shared_tracks[:4],
            'bridgeSongs': bridge_tracks[:6],
            'discoverySongs': (discovery_a + discovery_b)[:6],
        }

    def rank_matches(self, user_profile: dict, all_profiles: list[dict]) -> list[dict]:
        results = []
        for other in all_profiles:
            result = self.compute_score(user_profile, other)
            results.append({
                'user_id': other.get('user_id'),
                'username': other.get('username', 'Unknown'),
                'public_slug': other.get('public_slug') or other.get('publicSlug'),
                'publicSlug': other.get('public_slug') or other.get('publicSlug'),
                'avatar': other.get('avatar'),
                'match_score': result['match_score'],
                'overallCompatibility': result['overallCompatibility'],
                'compatibilityTier': result['compatibilityTier'],
                'relationshipArchetype': result['relationshipArchetype'],
                'shared_artists': result['shared_artists'][:3],
                'shared_genres': result['shared_genres'][:3],
                'sharedArtists': result['sharedArtists'][:3],
                'sharedGenres': result['sharedGenres'][:3],
                'emotionalCompatibility': result['emotionalCompatibility'],
                'discoveryCompatibility': result['discoveryCompatibility'],
                'tensionScore': result['tensionScore'],
                'breakdown': result['breakdown'],
                'confidence': result['confidence'],
                'compatibilityNarrative': result['compatibilityNarrative'],
            })
        results.sort(
            key=lambda item: (
                item['match_score'],
                item.get('emotionalCompatibility', 0),
                item.get('discoveryCompatibility', 0),
            ),
            reverse=True,
        )
        return results

    def build_constellation_graph(self, profile_a: dict, profile_b: dict, user_a_name: str = 'You', user_b_name: str = 'Soulmate') -> dict:
        artists_a_raw = profile_a.get('topArtists') or profile_a.get('artists') or []
        artists_b_raw = profile_b.get('topArtists') or profile_b.get('artists') or []
        mapping_a, ordered_a = normalize_name_set(artists_a_raw, 'name')
        mapping_b, ordered_b = normalize_name_set(artists_b_raw, 'name')

        shared_keys = set(ordered_a) & set(ordered_b)
        only_a = [key for key in ordered_a if key not in shared_keys]
        only_b = [key for key in ordered_b if key not in shared_keys]

        nodes = []
        links = []

        for key in ordered_a[:12]:
            if key in shared_keys:
                nodes.append({'id': key, 'label': mapping_a[key], 'type': 'shared', 'image': None})

        for key in only_a[:10]:
            nodes.append({'id': f'a_{key}', 'label': mapping_a[key], 'type': 'user_a', 'image': None, 'owner': user_a_name})

        for key in only_b[:10]:
            nodes.append({'id': f'b_{key}', 'label': mapping_b[key], 'type': 'user_b', 'image': None, 'owner': user_b_name})

        shared_list = [node['id'] for node in nodes if node['type'] == 'shared']
        for node in nodes:
            if node['type'] == 'user_a' and shared_list:
                links.append({'source': node['id'], 'target': shared_list[0], 'strength': 0.34})
            elif node['type'] == 'user_b' and shared_list:
                links.append({'source': node['id'], 'target': shared_list[-1], 'strength': 0.34})

        for index in range(len(shared_list) - 1):
            links.append({'source': shared_list[index], 'target': shared_list[index + 1], 'strength': 0.82})

        return {'nodes': nodes, 'links': links}


soulmate_engine = SoulmateEngine()
