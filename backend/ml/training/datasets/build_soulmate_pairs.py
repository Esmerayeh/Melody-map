from __future__ import annotations


def build_soulmate_pairs(taste_profiles: list[dict]) -> list[dict]:
    pairs = []
    for index, left in enumerate(taste_profiles):
        for right in taste_profiles[index + 1:]:
            pairs.append(
                {
                    "left_user_id": left.get("user_id"),
                    "right_user_id": right.get("user_id"),
                    "label": 1 if set(left.get("top_artists", [])[:3]) & set(right.get("top_artists", [])[:3]) else 0,
                }
            )
    return pairs
