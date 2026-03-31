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
    normalize_score,
    normalize_name_set,
)


class SoulmateEngine:
    def compute_score(self, profile_a: dict, profile_b: dict) -> dict:
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

        result = {
            **metrics,
            'compatibilityTier': compatibility_tier(overall),
            'rarityLabel': rarity.details.get('rarityLabel'),
            'sharedArtists': artist.details.get('sharedArtists', []),
            'sharedGenres': genre.details.get('sharedGenres', []),
            'sharedTracks': [item.get('title') for item in bridges.get('sharedTracks', [])],
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
            'whereItGetsInteresting': build_tension_narrative(metrics),
            'confidence': confidence,
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
                    'tensionBonus': 'healthy tension peaks near the middle rather than zero',
                    'confidence': 'final score is gently modulated by data confidence',
                },
            },
        }
        return result

    def rank_matches(self, user_profile: dict, all_profiles: list[dict]) -> list[dict]:
        results = []
        for other in all_profiles:
            result = self.compute_score(user_profile, other)
            results.append({
                'user_id': other.get('user_id'),
                'username': other.get('username', 'Unknown'),
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
