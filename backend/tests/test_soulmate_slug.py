from routes.public_profile import _public_profile_visible
from routes.soulmate import _build_public_slug, _clean_public_identity_value, _profile_allows_matching


def test_clean_public_identity_rejects_placeholder_values():
    assert _clean_public_identity_value('You') == ''
    assert _clean_public_identity_value('me') == ''
    assert _clean_public_identity_value('your-public-slug') == ''


def test_build_public_slug_uses_human_readable_username():
    assert _build_public_slug('Esmerayeh', 'abc123456') == 'esmerayeh'
    assert _build_public_slug('Noire Dusk', 'abc123456') == 'noire-dusk'


def test_build_public_slug_falls_back_to_stable_user_suffix():
    slug = _build_public_slug('You', '507f1f77bcf86cd799439011')
    assert slug == 'user-439011'


def test_soulmate_private_profiles_do_not_allow_matching():
    assert _profile_allows_matching({'allow_matching': False}) is False
    assert _profile_allows_matching({'allow_matching': True}) is True
    assert _profile_allows_matching({}) is True


def test_public_profile_visibility_requires_explicit_public_surface():
    assert _public_profile_visible({'visibility': 'private'}) is False
    assert _public_profile_visible({'visibility': 'public'}) is True
    assert _public_profile_visible({'visibility': 'private', 'allow_public_artifacts': True}) is True
