"""
Explanation helpers for the Melody Map aesthetic engine.
"""

from __future__ import annotations


def _join_labels(items: list[str], limit: int = 3) -> str:
    values = [str(item) for item in items if item]
    if not values:
        return ''
    if len(values) <= limit:
        if len(values) == 1:
            return values[0]
        if len(values) == 2:
            return f'{values[0]} and {values[1]}'
        return f"{', '.join(values[:-1])}, and {values[-1]}"
    trimmed = values[:limit]
    return f"{', '.join(trimmed[:-1])}, and {trimmed[-1]}"


def build_aesthetic_explanation(
    primary: dict,
    secondary: list[dict],
    support: dict,
    confidence: dict,
    rejected: list[dict],
) -> dict:
    genre_text = _join_labels(support.get('genreEvidence') or [])
    artist_text = _join_labels(support.get('artistEvidence') or [])
    texture_text = _join_labels(primary.get('texture_hints') or [], limit=2)
    mood_text = _join_labels(support.get('moodEvidence') or [], limit=2)
    era_text = _join_labels(support.get('eraEvidence') or [], limit=2)

    segments = []
    if primary:
        segments.append(
            f"Your aesthetic lands in {primary['label'].lower()} because your listening profile most strongly aligns with {primary['short_description'].lower()}"
        )
    if genre_text:
        segments.append(f'The strongest genre evidence comes from {genre_text}')
    if artist_text:
        segments.append(f'Recurring artist worlds like {artist_text} reinforce that visual identity')
    if mood_text:
        segments.append(f'Emotionally, the profile reads as {mood_text}')
    if era_text:
        segments.append(f'The era layer leans toward {era_text}')
    if texture_text:
        segments.append(f'Texturally, it resolves into {texture_text}')

    explanation = '. '.join(segment.rstrip('.') for segment in segments if segment) + '.'

    blend_names = [primary['label']] + [item['label'] for item in secondary]
    blend_line = f"The blend is led by {primary['label']}"
    if secondary:
        blend_line += f", with secondary pull from {_join_labels([item['label'] for item in secondary], limit=3)}"
    blend_line += '.'

    rejected_lines = []
    for candidate in rejected:
        reason = _join_labels(candidate.get('why_not') or [], limit=2) or 'its supporting signals were weaker'
        rejected_lines.append({
            'label': candidate['label'],
            'reason': reason,
        })

    methodology = [
        'Weighted genre ecosystem matching from canonical top artists',
        'Artist-world matching from recurring top-artist signals',
        'Audio feature target proximity using real Spotify aggregates',
        'Era influence from release-year distribution',
        'Discovery and profile-structure adjustments from popularity and diversity signals',
    ]
    if confidence['label'] != 'high':
        methodology.append('Confidence is reduced when audio coverage, genre density, or era evidence are weak')

    return {
        'summary': explanation,
        'blendExplanation': blend_line,
        'rejected': rejected_lines,
        'methodology': methodology,
        'visualMoodDescriptors': primary.get('visual_mood') or [],
        'culturalDescriptors': primary.get('cultural_descriptors') or [],
        'textureHints': primary.get('texture_hints') or [],
        'motionHints': primary.get('motion_hints') or [],
        'paletteHints': primary.get('palette_hints') or [],
        'blendLabels': blend_names,
    }
