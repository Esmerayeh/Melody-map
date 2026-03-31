from __future__ import annotations

from ml.soulmate_scoring import confidence_label


def _join_phrases(values: list[str]) -> str:
    clean = [value for value in values if value]
    if not clean:
        return ''
    if len(clean) == 1:
        return clean[0]
    if len(clean) == 2:
        return f'{clean[0]} and {clean[1]}'
    return f"{', '.join(clean[:-1])}, and {clean[-1]}"


def build_compatibility_narrative(metrics: dict) -> str:
    score = metrics['overallCompatibility']
    archetype = metrics['relationshipArchetype']
    atmosphere = metrics.get('sharedAtmosphere', [])
    if score >= 85:
        lead = 'Your worlds meet with unusual clarity.'
    elif score >= 70:
        lead = 'A shared orbit forms with real weight behind it.'
    elif score >= 55:
        lead = 'There is enough overlap here to feel each other clearly.'
    else:
        lead = 'The signal is softer, but there is still a bridge worth following.'

    if atmosphere:
        return f"{lead} This pairing leans toward { _join_phrases(atmosphere[:3]) }, which is why it reads as {archetype.lower()}."
    return f"{lead} It resolves as {archetype.lower()}, where overlap matters but the texture between you matters more."


def build_mbti_narrative(metrics: dict) -> str:
    types = [value for value in metrics.get('mbtiTypes', []) if value]
    match_type = metrics.get('mbtiMatchType') or 'adjacent'
    shared_traits = metrics.get('sharedTraits', [])
    if not types:
        if shared_traits:
            return f'Identity signal is partial, but you still meet through {_join_phrases(shared_traits[:3])}.'
        return 'Identity signal is still forming, so this read leans more on listening behavior than type language.'

    if match_type == 'mirrored':
        return f'{types[0]} and {types[1]} meet in familiar emotional structure, which makes the recognition feel immediate.'
    if match_type == 'complementary':
        return f'{types[0]} and {types[1]} are not identical, but the contrast is productive: one opens the room while the other deepens it.'
    if shared_traits:
        return f'You meet through {_join_phrases(shared_traits[:3])}, even if your types translate feeling a little differently.'
    return f'{types[0]} and {types[1]} stay close enough to understand each other, but not so close that discovery disappears.'


def build_orb_narrative(metrics: dict) -> str:
    harmony = metrics.get('orbHarmony') or 'asymmetrical'
    aura = metrics.get('auraOverlap', [])
    if harmony == 'mirrored':
        return 'Your fields move almost as one. The resonance reads less like collision and more like recognition.'
    if harmony == 'magnetic':
        return 'These orbs do not mirror. They pull, sharpen, and light each other from different angles.'
    if harmony == 'stabilizing':
        return 'One field steadies the other, and the overlap feels calmer than either orb alone.'
    if aura:
        return f'The overlap lives inside {_join_phrases(aura[:3])}, which is why the chemistry feels asymmetrical but real.'
    return 'The orbs stay distinct, but their pulse still reaches across the same field.'


def build_tension_narrative(metrics: dict) -> str:
    tension_type = metrics.get('tensionType') or 'gentle contrast'
    complementary = metrics.get('complementaryTraits', [])
    contrasting = metrics.get('contrastingTraits', [])

    if tension_type == 'beautiful tension':
        if complementary:
            return f'This is not mismatch. It is beautiful imbalance: {_join_phrases(complementary[:2])} keep the orbit alive.'
        return 'This is not mismatch. It is beautiful imbalance, where the difference adds charge instead of distance.'
    if tension_type == 'magnetic':
        if contrasting:
            return f'You do not carry the same night the same way. {_join_phrases(contrasting[:2])} create the pull.'
        return 'The contrast is noticeable, but it lands as chemistry rather than fracture.'
    if tension_type == 'incompatible':
        return 'The contrast is loud right now, and the bridge is still thin. There may be curiosity here, but not yet deep recognition.'
    if complementary:
        return f'What differs between you is mostly useful: {_join_phrases(complementary[:2])} give the pairing shape.'
    return 'The difference here is soft enough to feel interesting, not destabilizing.'


def build_discovery_narrative(metrics: dict) -> str:
    a_to_b = metrics.get('userAToUserBDiscovery', 0)
    b_to_a = metrics.get('userBToUserADiscovery', 0)
    score = metrics.get('discoveryCompatibility', 0)
    if score >= 75:
        return 'You could lead each other somewhere new without losing the emotional thread that already connects you.'
    if a_to_b > b_to_a + 10:
        return 'One side of this pairing carries more surprise, but the handoff still feels like a fit rather than a gamble.'
    if b_to_a > a_to_b + 10:
        return 'The discovery edge is asymmetrical in a good way. One orbit keeps opening doors the other is already ready for.'
    if score >= 45:
        return 'There is enough trust in the overlap for recommendations to travel both ways.'
    return 'Discovery is still tentative here. The bridge exists, but it needs a little more shared signal to brighten.'


def build_shared_atmosphere_narrative(metrics: dict) -> str:
    atmosphere = metrics.get('sharedAtmosphere', [])
    if atmosphere:
        return f'You both return to {_join_phrases(atmosphere[:3])}. The overlap arrives in atmosphere before it arrives in genre.'
    return 'The overlap is more structural than atmospheric right now. You may feel the same pull through different surfaces.'


def build_confidence_note(score: float) -> str | None:
    label = confidence_label(score)
    if label == 'high':
        return None
    if label == 'medium':
        return 'The chemistry is readable, but a few edges are still forming.'
    if label == 'low':
        return 'This is a partial read. Enough signal exists to find a pattern, but not enough to call it complete.'
    return 'Limited signal: this pairing is being read through fragments rather than the full emotional field.'
