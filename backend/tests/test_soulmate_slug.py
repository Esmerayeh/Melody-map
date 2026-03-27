from routes.soulmate import _build_public_slug, _clean_public_identity_value


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
