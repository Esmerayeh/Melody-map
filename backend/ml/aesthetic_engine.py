"""
Aesthetic Engine — converts a music taste profile into visual aesthetic data.
Generates: aesthetic name (3-word), color palette, tags, vibe description,
           music personality profile, and shared aesthetic for soulmate pairs.
"""
import random

# ── Genre → aesthetic tag mapping ─────────────────────────────────────────────
GENRE_TAGS = {
    'shoegaze':      ['neon fog', 'dreamy photography', 'blurred lights', 'hazy bokeh', 'ethereal blur'],
    'dream pop':     ['pastel sky', 'soft clouds', 'ethereal photography', 'lavender fields', 'soft focus'],
    'indie rock':    ['vintage film photography', 'polaroid aesthetic', 'warm grain', 'retro street', 'analog film'],
    'jazz':          ['smoky bar', 'dim amber lights', 'vintage vinyl', 'noir photography', 'candlelit room'],
    'electronic':    ['cyberpunk city', 'neon streets', 'synthwave aesthetic', 'glitch art', 'digital rain'],
    'hip hop':       ['urban street art', 'city skyline night', 'graffiti wall', 'golden hour city'],
    'r&b':           ['velvet aesthetic', 'moody portrait', 'warm candlelight', 'silk texture'],
    'classical':     ['marble architecture', 'golden hour', 'baroque art', 'misty forest'],
    'metal':         ['dark forest', 'storm clouds', 'dramatic lightning', 'gothic architecture'],
    'pop':           ['colorful confetti', 'bright neon signs', 'bubblegum aesthetic', 'pastel room'],
    'folk':          ['autumn forest', 'cozy cabin', 'wildflower field', 'golden wheat field'],
    'ambient':       ['deep ocean', 'starry night sky', 'misty mountains', 'aurora borealis'],
    'punk':          ['gritty urban', 'torn posters', 'raw street photography', 'industrial'],
    'soul':          ['warm sunset', 'vintage diner', 'golden hour portrait', 'retro americana'],
    'lo-fi':         ['rainy window', 'cozy study room', 'warm lamp light', 'vintage cassette'],
    'indie pop':     ['pastel aesthetic', 'flower crown', 'soft sunlight', 'dreamy portrait'],
    'alternative':   ['moody landscape', 'overcast sky', 'abandoned building', 'film noir'],
    'trap':          ['neon city rain', 'luxury aesthetic', 'dark moody portrait', 'city lights'],
    'house':         ['colorful rave', 'laser lights', 'festival crowd', 'neon dance floor'],
    'techno':        ['industrial warehouse', 'dark rave', 'strobe lights', 'concrete aesthetic'],
    'country':       ['open road', 'golden field', 'rustic barn', 'sunset prairie'],
    'reggae':        ['tropical beach', 'palm trees', 'ocean sunset', 'colorful culture'],
    'blues':         ['dusty road', 'old guitar', 'southern gothic', 'sepia photography'],
    'k-pop':         ['pastel studio', 'neon aesthetic', 'colorful fashion', 'dreamy portrait'],
    'emo':           ['rainy night', 'dark bedroom', 'moody black and white', 'melancholic portrait'],
    'synthwave':     ['retro neon grid', 'purple sunset highway', 'vaporwave aesthetic', 'chrome reflections'],
    'nightcore':     ['midnight city', 'neon rain', 'dark alley lights', 'electric night'],
    'vaporwave':     ['pastel glitch', 'retro computer aesthetic', 'pink sunset mall', 'nostalgic digital'],
    'post-rock':     ['vast landscape', 'long exposure sky', 'cinematic horizon', 'empty highway'],
    'darkwave':      ['gothic cathedral', 'moonlit ruins', 'dark romanticism', 'velvet shadows'],
}

# ── Mood descriptors (energy-based) ───────────────────────────────────────────
_MOOD_HIGH   = ['Neon', 'Electric', 'Blazing', 'Kinetic', 'Radiant', 'Vivid', 'Charged']
_MOOD_MID    = ['Velvet', 'Amber', 'Golden', 'Cobalt', 'Silver', 'Ivory', 'Lunar']
_MOOD_LOW    = ['Midnight', 'Obsidian', 'Phantom', 'Dusk', 'Ash', 'Muted', 'Hollow']

# ── Valence descriptors ────────────────────────────────────────────────────────
_VALENCE_HIGH = ['Bloom', 'Solstice', 'Cascade', 'Horizon', 'Reverie', 'Glow', 'Drift']
_VALENCE_MID  = ['Haze', 'Mirage', 'Eclipse', 'Labyrinth', 'Static', 'Veil', 'Ether']
_VALENCE_LOW  = ['Abyss', 'Cathedral', 'Void', 'Ruin', 'Requiem', 'Dirge', 'Shade']

# ── Genre-specific environment words ──────────────────────────────────────────
_GENRE_ENV = {
    'shoegaze':   'Dreamscape',
    'dream pop':  'Reverie',
    'jazz':       'Nocturne',
    'electronic': 'Circuit',
    'synthwave':  'Highway',
    'nightcore':  'Midnight',
    'lo-fi':      'Cassette',
    'ambient':    'Cosmos',
    'folk':       'Meadow',
    'metal':      'Abyss',
    'classical':  'Sonata',
    'indie rock': 'Polaroid',
    'vaporwave':  'Glitch',
    'darkwave':   'Cathedral',
    'post-rock':  'Horizon',
    'emo':        'Static',
    'r&b':        'Velvet',
    'hip hop':    'Skyline',
    'trap':       'Neon',
    'house':      'Rave',
    'k-pop':      'Pastel',
}

# ── Time-of-day vibes ──────────────────────────────────────────────────────────
_TIME_VIBES = {
    'nightcore':  'Midnight',
    'synthwave':  'Midnight',
    'jazz':       'Evening',
    'lo-fi':      'Late Night',
    'ambient':    'Dawn',
    'folk':       'Afternoon',
    'classical':  'Morning',
    'electronic': 'Night',
    'trap':       'Night',
    'house':      'Night',
    'indie rock': 'Sunset',
    'dream pop':  'Dusk',
    'shoegaze':   'Dusk',
}


def generate_aesthetic_name(
    genres: list[str],
    energy: float,
    valence: float,
    seed_offset: int = 0,
) -> str:
    """Generate a 2–3 word aesthetic name seeded by taste profile."""
    seed_str = ''.join(sorted(genres[:3])) + f'{energy:.1f}{valence:.1f}{seed_offset}'
    rng = random.Random(hash(seed_str) % (2 ** 32))

    # Pick mood word based on energy
    if energy > 0.65:
        mood = rng.choice(_MOOD_HIGH)
    elif energy < 0.4:
        mood = rng.choice(_MOOD_LOW)
    else:
        mood = rng.choice(_MOOD_MID)

    # Pick environment word — genre-specific first, then valence-based
    env = None
    for g in genres:
        for key, word in _GENRE_ENV.items():
            if key in g.lower():
                env = word
                break
        if env:
            break

    if not env:
        if valence > 0.65:
            env = rng.choice(_VALENCE_HIGH)
        elif valence < 0.4:
            env = rng.choice(_VALENCE_LOW)
        else:
            env = rng.choice(_VALENCE_MID)

    # Optional third word (time-of-day) — 60% chance
    time_word = None
    for g in genres:
        for key, word in _TIME_VIBES.items():
            if key in g.lower():
                time_word = word
                break
        if time_word:
            break

    if time_word and rng.random() < 0.6 and time_word not in (mood, env):
        return f'{mood} {time_word} {env}'
    return f'{mood} {env}'


# ── Color palette ──────────────────────────────────────────────────────────────
_GENRE_PALETTES = {
    'dream pop':   ['#e0c3fc', '#8ec5fc', '#f093fb', '#c471f5', '#fa71cd'],
    'shoegaze':    ['#1a1a2e', '#3a0ca3', '#7209b7', '#560bad', '#480ca8'],
    'jazz':        ['#2c1810', '#8b4513', '#d2691e', '#f4a460', '#daa520'],
    'electronic':  ['#0d0221', '#00f5ff', '#ff00ff', '#7700ff', '#00ff88'],
    'lo-fi':       ['#2d1b69', '#4a3728', '#8b7355', '#c4a882', '#e8d5b7'],
    'ambient':     ['#0a0a2e', '#1a1a5e', '#2d2d8e', '#4040be', '#6060ee'],
    'folk':        ['#2d4a1e', '#4a7c3f', '#8fbc8f', '#d4a96a', '#c8a96e'],
    'metal':       ['#0a0a0a', '#1a1a1a', '#2d2d2d', '#8b0000', '#dc143c'],
    'synthwave':   ['#0d0221', '#ff00ff', '#00f5ff', '#7700ff', '#ff6ec7'],
    'vaporwave':   ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'],
    'darkwave':    ['#1a0a2e', '#2d0a4e', '#4a0a6e', '#6a0a8e', '#8a0aae'],
    'indie rock':  ['#8b4513', '#d2691e', '#cd853f', '#daa520', '#b8860b'],
    'r&b':         ['#2d0a1e', '#5a0a3e', '#8a0a5e', '#b8607e', '#e8a09e'],
    'hip hop':     ['#0a0a0a', '#1a1a1a', '#ffd700', '#ff8c00', '#ff4500'],
    'k-pop':       ['#ffb3c6', '#ff85a1', '#fbb1bd', '#ff0a54', '#ff477e'],
    'classical':   ['#f5f0e8', '#d4c5a9', '#b8a88a', '#8b7355', '#6b5a3e'],
    'emo':         ['#0a0a0a', '#1a0a1a', '#2d0a2d', '#8b008b', '#9400d3'],
    'post-rock':   ['#1a1a2e', '#2d3561', '#4a5568', '#718096', '#a0aec0'],
}

_PALETTE_MAP = [
    (0.6, 1.0, 0.6, 1.0, ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b']),
    (0.6, 1.0, 0.0, 0.4, ['#0d0221', '#3a0ca3', '#7209b7', '#f72585', '#4361ee']),
    (0.0, 0.4, 0.6, 1.0, ['#caf0f8', '#ade8f4', '#90e0ef', '#48cae4', '#00b4d8']),
    (0.0, 0.4, 0.0, 0.4, ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560']),
    (0.4, 0.6, 0.4, 0.6, ['#2d1b69', '#11998e', '#38ef7d', '#fc5c7d', '#6a3093']),
]


def generate_palette(genres: list[str], energy: float, valence: float) -> list[str]:
    for g in genres:
        g_lower = g.lower()
        for key, palette in _GENRE_PALETTES.items():
            if key in g_lower:
                return palette
    for e_min, e_max, v_min, v_max, palette in _PALETTE_MAP:
        if e_min <= energy <= e_max and v_min <= valence <= v_max:
            return palette
    return ['#1a1a2e', '#3a0ca3', '#7209b7', '#f72585', '#4361ee']


# ── Vibe description ───────────────────────────────────────────────────────────
_ENERGY_DESC  = {
    'high': ['electric', 'intense', 'pulsating', 'kinetic', 'blazing'],
    'mid':  ['flowing', 'dynamic', 'wandering', 'drifting'],
    'low':  ['serene', 'introspective', 'quiet', 'still', 'hushed'],
}
_VALENCE_DESC = {
    'high': ['euphoric', 'radiant', 'joyful', 'luminous', 'vibrant'],
    'mid':  ['bittersweet', 'nostalgic', 'wistful', 'contemplative'],
    'low':  ['melancholic', 'shadowed', 'brooding', 'haunting', 'aching'],
}
_GENRE_VIBES = {
    'shoegaze':   'washed in reverb and haze',
    'dream pop':  'floating through soft clouds',
    'jazz':       'drifting through smoky rooms',
    'electronic': 'pulsing through neon corridors',
    'lo-fi':      'curled up in a warm, rainy afternoon',
    'ambient':    'dissolving into open space',
    'folk':       'rooted in earth and golden light',
    'metal':      'forged in storm and shadow',
    'indie rock': 'captured on grainy film',
    'hip hop':    'moving through city lights at midnight',
    'synthwave':  'racing down a neon highway at 2am',
    'vaporwave':  'lost in a pastel digital dreamworld',
    'darkwave':   'wandering through moonlit cathedrals',
    'classical':  'suspended in golden afternoon light',
    'r&b':        'wrapped in velvet and candlelight',
    'k-pop':      'glowing under pastel studio lights',
    'emo':        'staring out a rain-streaked window',
    'post-rock':  'standing at the edge of a vast horizon',
}


def generate_vibe_description(genres: list[str], energy: float, valence: float) -> str:
    e_key = 'high' if energy > 0.6 else ('low' if energy < 0.4 else 'mid')
    v_key = 'high' if valence > 0.6 else ('low' if valence < 0.4 else 'mid')
    rng = random.Random(int(energy * 100 + valence * 100))
    e_word = rng.choice(_ENERGY_DESC[e_key])
    v_word = rng.choice(_VALENCE_DESC[v_key])

    genre_vibe = ''
    for g in genres:
        for key, vibe in _GENRE_VIBES.items():
            if key in g.lower():
                genre_vibe = f', {vibe}'
                break
        if genre_vibe:
            break

    return f'Your music taste feels {e_word}, {v_word}, and deeply atmospheric{genre_vibe}.'


# ── Audio feature → tags ───────────────────────────────────────────────────────
def _audio_tags(energy: float, valence: float, tempo: float, danceability: float = 0.5) -> list[str]:
    tags = []
    if energy > 0.7:
        tags += ['electric atmosphere', 'high energy photography']
    elif energy < 0.35:
        tags += ['calm minimalist', 'slow exposure photography']
    if valence > 0.65:
        tags += ['bright joyful aesthetic', 'warm sunlight']
    elif valence < 0.35:
        tags += ['melancholic aesthetic', 'dark moody photography']
    else:
        tags += ['bittersweet aesthetic', 'golden hour mood']
    if tempo > 140:
        tags += ['fast motion blur', 'kinetic photography']
    elif tempo < 80:
        tags += ['slow motion aesthetic', 'long exposure light']
    if danceability > 0.7:
        tags += ['vibrant dance aesthetic', 'colorful movement']
    return tags


def generate_aesthetic_tags(
    genres: list[str],
    energy: float,
    valence: float,
    tempo: float,
    danceability: float = 0.5,
    top_artists: list[str] | None = None,
    personality_traits: list[str] | None = None,
    max_tags: int = 18,
) -> list[str]:
    tags = set()
    for genre in genres:
        g_lower = genre.lower()
        for key, genre_tags in GENRE_TAGS.items():
            if key in g_lower:
                tags.update(genre_tags)
    tags.update(_audio_tags(energy, valence, tempo, danceability))
    if valence < 0.4:
        tags.add('dark aesthetic photography')
    elif valence > 0.6:
        tags.add('bright aesthetic photography')

    # Add artist-specific aesthetic queries
    if top_artists:
        for artist in top_artists[:3]:
            tags.add(f'{artist} aesthetic')

    # Add personality trait queries
    if personality_traits:
        for trait in personality_traits[:2]:
            tags.add(f'{trait} music aesthetic')

    # Add top genre aesthetic queries
    if genres:
        tags.add(f'{genres[0]} aesthetic')
        if len(genres) > 1:
            tags.add(f'{genres[1]} aesthetic')

    tag_list = list(tags)
    rng = random.Random(int(energy * 1000 + valence * 1000 + tempo))
    rng.shuffle(tag_list)
    return tag_list[:max_tags]


# ── Music Personality Profiles ─────────────────────────────────────────────────
_PERSONALITIES = [
    {
        'id': 'nocturnal_dreamer',
        'name': 'Nocturnal Dreamer',
        'description': 'You gravitate toward atmospheric soundscapes, nostalgic melodies, and late-night music.',
        'traits': ['introspective', 'atmospheric', 'nocturnal'],
        'match': lambda g, e, v, t: e < 0.5 and v < 0.5,
    },
    {
        'id': 'electric_wanderer',
        'name': 'Electric Wanderer',
        'description': 'You chase energy and movement — your music is kinetic, charged, and always in motion.',
        'traits': ['energetic', 'restless', 'adventurous'],
        'match': lambda g, e, v, t: e > 0.65 and t > 120,
    },
    {
        'id': 'velvet_romantic',
        'name': 'Velvet Romantic',
        'description': 'Warm, soulful, and deeply emotional — you feel music in your chest.',
        'traits': ['emotional', 'warm', 'soulful'],
        'match': lambda g, e, v, t: v > 0.55 and e < 0.6 and any(x in ' '.join(g) for x in ['r&b', 'soul', 'jazz']),
    },
    {
        'id': 'neon_architect',
        'name': 'Neon Architect',
        'description': 'You build worlds with sound — electronic, precise, and futuristic.',
        'traits': ['analytical', 'futuristic', 'precise'],
        'match': lambda g, e, v, t: any(x in ' '.join(g) for x in ['electronic', 'techno', 'synthwave', 'house']),
    },
    {
        'id': 'golden_nostalgist',
        'name': 'Golden Nostalgist',
        'description': 'You live in warm memories — your music smells like old film and summer afternoons.',
        'traits': ['nostalgic', 'warm', 'reflective'],
        'match': lambda g, e, v, t: v > 0.5 and any(x in ' '.join(g) for x in ['indie', 'folk', 'lo-fi', 'soul']),
    },
    {
        'id': 'storm_chaser',
        'name': 'Storm Chaser',
        'description': 'Intense, raw, and unfiltered — you need music that matches the chaos inside.',
        'traits': ['intense', 'raw', 'powerful'],
        'match': lambda g, e, v, t: e > 0.7 and v < 0.45,
    },
    {
        'id': 'cosmic_drifter',
        'name': 'Cosmic Drifter',
        'description': 'You float between worlds — ambient, expansive, and endlessly curious.',
        'traits': ['expansive', 'curious', 'meditative'],
        'match': lambda g, e, v, t: e < 0.45 and any(x in ' '.join(g) for x in ['ambient', 'post-rock', 'classical']),
    },
    {
        'id': 'urban_poet',
        'name': 'Urban Poet',
        'description': 'You find beauty in city grit — your music is street-level and deeply human.',
        'traits': ['observant', 'grounded', 'lyrical'],
        'match': lambda g, e, v, t: any(x in ' '.join(g) for x in ['hip hop', 'r&b', 'trap', 'soul']),
    },
]

_DEFAULT_PERSONALITY = {
    'id': 'sonic_explorer',
    'name': 'Sonic Explorer',
    'description': 'Your taste defies categories — you roam freely across genres, moods, and eras.',
    'traits': ['eclectic', 'open-minded', 'adventurous'],
}


def generate_personality(genres: list[str], energy: float, valence: float, tempo: float) -> dict:
    genres_str = ' '.join(g.lower() for g in genres)
    for p in _PERSONALITIES:
        try:
            if p['match'](genres_str, energy, valence, tempo):
                return {k: v for k, v in p.items() if k != 'match'}
        except Exception:
            continue
    return _DEFAULT_PERSONALITY


# ── Shared aesthetic (soulmate compatibility) ──────────────────────────────────
_SHARED_MOOD   = ['Neon', 'Velvet', 'Midnight', 'Cobalt', 'Amber', 'Silver', 'Phantom']
_SHARED_ENV    = ['Dream', 'Nostalgia', 'Reverie', 'Echo', 'Drift', 'Pulse', 'Haze']
_SHARED_SUFFIX = ['Collective', 'Frequency', 'Wavelength', 'Resonance', 'Orbit', 'Signal']


def generate_shared_aesthetic(
    tags_a: list[str],
    tags_b: list[str],
    shared_genres: list[str],
    shared_artists: list[str],
) -> dict:
    """Generate a combined aesthetic for two matched users."""
    set_a = set(t.lower() for t in tags_a)
    set_b = set(t.lower() for t in tags_b)
    shared_tags = sorted(set_a & set_b)

    # Merge and deduplicate all tags for the shared board
    all_tags = shared_tags + [t for t in tags_a if t.lower() not in set_b][:4] + \
               [t for t in tags_b if t.lower() not in set_a][:4]

    # Generate shared name seeded by shared content
    seed_str = ''.join(sorted(shared_genres[:3] + shared_artists[:3]))
    rng = random.Random(hash(seed_str) % (2 ** 32))
    mood   = rng.choice(_SHARED_MOOD)
    env    = rng.choice(_SHARED_ENV)
    suffix = rng.choice(_SHARED_SUFFIX)
    name   = f'{mood} {env} {suffix}'

    # Shared vibe description
    if shared_genres:
        genre_str = ', '.join(shared_genres[:3])
        vibe = f'Together you inhabit a world of {genre_str} — a shared frequency only you two can hear.'
    elif shared_artists:
        artist_str = ', '.join(shared_artists[:2])
        vibe = f'Your connection runs through {artist_str} — a sonic bridge between your worlds.'
    else:
        vibe = 'Your musical universes orbit each other — different stars, same sky.'

    return {
        'shared_aesthetic_name': name,
        'shared_tags':           all_tags[:12],
        'shared_vibe':           vibe,
    }


# ── Hyper-Specific Vibe Classifier ────────────────────────────────────────────
# Maps Spotify audio_features (valence, energy, tempo, danceability) to a
# poetic vibe label + accent hex color. Goes beyond genre labels.

_VIBE_TABLE = [
    # (energy_min, energy_max, valence_min, valence_max, tempo_min, tempo_max, label, hex, description)
    (0.75, 1.0,  0.70, 1.0,  130, 999, 'Neon Euphoria Rush',        '#ff6ec7', 'Pure kinetic joy — the feeling of a crowd moving as one.'),
    (0.75, 1.0,  0.70, 1.0,   80, 130, 'Golden Hour Ignition',      '#ffd700', 'Warm, blazing energy that feels like the last hour of sunlight.'),
    (0.75, 1.0,  0.30, 0.70, 120, 999, 'Midnight Highway Echoes',   '#00f5ff', 'Driving fast through empty streets at 2am, windows down.'),
    (0.75, 1.0,  0.00, 0.30, 120, 999, 'Gritty Urban Solitude',     '#ff4500', 'The city at its rawest — concrete, tension, and truth.'),
    (0.75, 1.0,  0.00, 0.30,  80, 120, 'Storm Cathedral Catharsis', '#8b0000', 'Heavy, dark, and cathartic — music that processes the unprocessable.'),
    (0.50, 0.75, 0.65, 1.0,  100, 999, 'Sunlit Frequency Bloom',    '#6bcb77', 'Bright, airy, and full of the kind of joy that feels almost too delicate.'),
    (0.50, 0.75, 0.65, 1.0,   80, 100, 'Velvet Afternoon Drift',    '#f4a460', 'Warm and unhurried — the feeling of a slow Sunday with nowhere to be.'),
    (0.50, 0.75, 0.35, 0.65, 100, 999, 'Electric Bittersweet Haze', '#7c6fff', 'Caught between dancing and crying — the most honest emotional state.'),
    (0.50, 0.75, 0.35, 0.65,  80, 100, 'Cobalt Wandering Static',   '#4361ee', 'Restless and searching — music for the in-between moments.'),
    (0.50, 0.75, 0.00, 0.35,  90, 999, 'Phantom Neon Undertow',     '#560bad', 'Dark energy with a pulse — the feeling of something vast beneath the surface.'),
    (0.50, 0.75, 0.00, 0.35,   0,  90, 'Obsidian Slow Burn',        '#1a1a2e', 'Low, heavy, and deliberate — music that takes its time to devastate.'),
    (0.25, 0.50, 0.65, 1.0,    0, 999, 'Pastel Liminal Reverie',    '#e0c3fc', 'Soft and weightless — floating through a world that feels slightly unreal.'),
    (0.25, 0.50, 0.35, 0.65,   0,  90, 'Rainy Window Solitude',     '#90e0ef', 'Quiet introspection — the sound of watching rain from a warm room.'),
    (0.25, 0.50, 0.35, 0.65,  90, 999, 'Warm Cassette Nostalgia',   '#c4a882', 'Analog warmth and faded memories — music that smells like old film.'),
    (0.25, 0.50, 0.00, 0.35,   0,  80, 'Void Frequency Meditation', '#0a0a2e', 'Vast, still, and quietly overwhelming — music that makes the room feel infinite.'),
    (0.25, 0.50, 0.00, 0.35,  80, 999, 'Dusk Signal Melancholia',   '#533483', 'The ache of beautiful things ending — bittersweet and deeply felt.'),
    (0.00, 0.25, 0.50, 1.0,    0, 999, 'Ethereal Dawn Suspension',  '#caf0f8', 'Barely-there and luminous — music that exists at the edge of silence.'),
    (0.00, 0.25, 0.00, 0.50,   0, 999, 'Hollow Midnight Cathedral', '#16213e', 'Empty, echoing, and hauntingly beautiful — the sound of 4am.'),
]

_VIBE_DEFAULT = ('Sonic Wanderer', '#7c6fff', 'Your taste moves freely — genre-less, era-less, and entirely your own.')


def classify_vibe(
    energy: float,
    valence: float,
    tempo: float,
    genres: list[str] | None = None,
) -> dict:
    """
    Map Spotify audio features to a hyper-specific poetic vibe label.
    Returns: { label, hex, description, energy, valence, tempo }
    """
    for e_lo, e_hi, v_lo, v_hi, t_lo, t_hi, label, hex_color, desc in _VIBE_TABLE:
        if e_lo <= energy <= e_hi and v_lo <= valence <= v_hi and t_lo <= tempo <= t_hi:
            return {
                'label':       label,
                'hex':         hex_color,
                'description': desc,
                'energy':      round(energy, 3),
                'valence':     round(valence, 3),
                'tempo':       round(tempo, 1),
            }

    label, hex_color, desc = _VIBE_DEFAULT
    return {
        'label':       label,
        'hex':         hex_color,
        'description': desc,
        'energy':      round(energy, 3),
        'valence':     round(valence, 3),
        'tempo':       round(tempo, 1),
    }


# ── Poetic Persona (Music Identity Report) ────────────────────────────────────
# Richer than personality — generates a full identity narrative.

_PERSONA_TABLE = [
    {
        'id':    'melancholic_voyager',
        'name':  'The Melancholic Voyager',
        'tagline': 'You travel through sound like others travel through memory.',
        'report': (
            'Your listening patterns reveal a soul that finds beauty in the bittersweet. '
            'You gravitate toward music that aches — not because you are sad, but because '
            'you understand that the most honest emotions live in the space between joy and grief. '
            'You are drawn to texture, atmosphere, and the feeling of being somewhere else entirely.'
        ),
        'keywords': ['introspective', 'atmospheric', 'bittersweet', 'wandering'],
        'match': lambda e, v, t, g: e < 0.55 and v < 0.55,
    },
    {
        'id':    'high_energy_architect',
        'name':  'The High-Energy Architect',
        'tagline': 'You don\'t listen to music. You build with it.',
        'report': (
            'Your taste is kinetic and purposeful. High tempo, high energy, and always forward-moving — '
            'you use music as fuel. Whether you\'re working, running, or just existing at full intensity, '
            'your playlist is a blueprint for momentum. You don\'t do slow. You do precise.'
        ),
        'keywords': ['kinetic', 'focused', 'driven', 'electric'],
        'match': lambda e, v, t, g: e > 0.70 and t > 120,
    },
    {
        'id':    'velvet_romantic',
        'name':  'The Velvet Romantic',
        'tagline': 'You feel music in places words can\'t reach.',
        'report': (
            'Warm, soulful, and deeply emotional — your listening history reads like a love letter '
            'to human connection. You choose music that understands you, that sits with you in the '
            'difficult moments and celebrates the beautiful ones. Your taste is intimate, curated, '
            'and entirely your own.'
        ),
        'keywords': ['emotional', 'warm', 'intimate', 'soulful'],
        'match': lambda e, v, t, g: v > 0.60 and e < 0.65 and any(x in g for x in ['r&b', 'soul', 'jazz', 'folk']),
    },
    {
        'id':    'neon_futurist',
        'name':  'The Neon Futurist',
        'tagline': 'You hear the future before it arrives.',
        'report': (
            'Electronic, precise, and always ahead of the curve — your taste is a map of where music '
            'is going. You\'re drawn to synthesis, texture, and the feeling of sound as architecture. '
            'You don\'t just listen; you analyze, dissect, and reconstruct. Your playlist is a blueprint '
            'for a world that doesn\'t exist yet.'
        ),
        'keywords': ['futuristic', 'analytical', 'precise', 'synthetic'],
        'match': lambda e, v, t, g: any(x in g for x in ['electronic', 'techno', 'synthwave', 'house', 'ambient']),
    },
    {
        'id':    'golden_nostalgist',
        'name':  'The Golden Nostalgist',
        'tagline': 'You collect moments the way others collect records.',
        'report': (
            'Your music taste is a time machine. You\'re drawn to warmth, texture, and the feeling '
            'that everything important happened just slightly out of reach. Indie folk, lo-fi, '
            'singer-songwriter — you choose music that smells like old film and summer afternoons. '
            'You don\'t just listen to music; you preserve it.'
        ),
        'keywords': ['nostalgic', 'warm', 'reflective', 'analog'],
        'match': lambda e, v, t, g: v > 0.45 and any(x in g for x in ['indie', 'folk', 'lo-fi', 'singer-songwriter']),
    },
    {
        'id':    'cosmic_drifter',
        'name':  'The Cosmic Drifter',
        'tagline': 'You listen to music the way astronomers look at stars.',
        'report': (
            'Vast, patient, and endlessly curious — your taste gravitates toward music that makes '
            'the room feel larger. Post-rock, ambient, classical — you choose sound that matches '
            'the scale of your thoughts. You don\'t need lyrics. You need space.'
        ),
        'keywords': ['expansive', 'meditative', 'curious', 'vast'],
        'match': lambda e, v, t, g: e < 0.50 and any(x in g for x in ['ambient', 'post-rock', 'classical', 'drone']),
    },
]

_DEFAULT_PERSONA = {
    'id':      'sonic_shapeshifter',
    'name':    'The Sonic Shapeshifter',
    'tagline': 'You refuse to be defined by a single sound.',
    'report':  (
        'Your taste is a constellation — each point of light a different genre, era, or mood. '
        'You move freely between worlds, finding beauty in the unexpected connections. '
        'You are the rarest kind of listener: genuinely open, genuinely curious, and entirely unclassifiable.'
    ),
    'keywords': ['eclectic', 'open-minded', 'adventurous', 'unclassifiable'],
}


def generate_poetic_persona(
    genres: list[str],
    energy: float,
    valence: float,
    tempo: float,
) -> dict:
    """Generate a full Music Identity Report with poetic persona."""
    genres_str = ' '.join(g.lower() for g in genres)
    vibe       = classify_vibe(energy, valence, tempo, genres)

    for p in _PERSONA_TABLE:
        try:
            if p['match'](energy, valence, tempo, genres_str):
                persona = {k: v for k, v in p.items() if k != 'match'}
                persona['vibe'] = vibe
                return persona
        except Exception:
            continue

    result = dict(_DEFAULT_PERSONA)
    result['vibe'] = vibe
    return result


# ── Palette Extractor from Audio Features ─────────────────────────────────────
# Maps average_valence + average_energy of top 20 tracks to a named palette.

_FEATURE_PALETTES = {
    # (energy_min, energy_max, valence_min, valence_max): (name, [hex codes], unsplash_query)
    'electric_citrus': {
        'energy_range':  (0.65, 1.0),
        'valence_range': (0.65, 1.0),
        'name':          'Electric Citrus',
        'palette':       ['#ff6b35', '#ffd93d', '#ff9f1c', '#ffbf69', '#ffffff'],
        'unsplash_query': 'neon citrus abstract vibrant energy',
        'description':   'High energy, high joy — blazing yellows and electric oranges.',
    },
    'midnight_velvet': {
        'energy_range':  (0.0, 0.4),
        'valence_range': (0.0, 0.4),
        'name':          'Midnight Velvet',
        'palette':       ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'],
        'unsplash_query': 'dark indigo velvet moody night abstract',
        'description':   'Low energy, low valence — deep indigo and slate, introspective and shadowed.',
    },
    'pastel_reverie': {
        'energy_range':  (0.0, 0.5),
        'valence_range': (0.55, 1.0),
        'name':          'Pastel Reverie',
        'palette':       ['#caf0f8', '#ade8f4', '#90e0ef', '#e0c3fc', '#fbc2eb'],
        'unsplash_query': 'soft pastel dreamy bokeh light',
        'description':   'Low energy, high valence — soft and luminous, like a dream you can almost remember.',
    },
    'neon_tension': {
        'energy_range':  (0.65, 1.0),
        'valence_range': (0.0, 0.4),
        'name':          'Neon Tension',
        'palette':       ['#0d0221', '#3a0ca3', '#7209b7', '#f72585', '#4361ee'],
        'unsplash_query': 'neon purple dark cyberpunk tension',
        'description':   'High energy, low valence — electric and dark, like a storm about to break.',
    },
    'golden_haze': {
        'energy_range':  (0.4, 0.65),
        'valence_range': (0.55, 1.0),
        'name':          'Golden Haze',
        'palette':       ['#f9c74f', '#f8961e', '#f3722c', '#90be6d', '#43aa8b'],
        'unsplash_query': 'golden hour warm haze bokeh film grain',
        'description':   'Mid energy, warm valence — the feeling of a perfect afternoon.',
    },
    'cobalt_drift': {
        'energy_range':  (0.4, 0.65),
        'valence_range': (0.4, 0.6),
        'name':          'Cobalt Drift',
        'palette':       ['#2d1b69', '#11998e', '#38ef7d', '#fc5c7d', '#6a3093'],
        'unsplash_query': 'abstract blue purple gradient drift',
        'description':   'Mid energy, mid valence — restless and searching, caught between moods.',
    },
    'ash_cathedral': {
        'energy_range':  (0.4, 0.65),
        'valence_range': (0.0, 0.4),
        'name':          'Ash Cathedral',
        'palette':       ['#2d3561', '#4a5568', '#718096', '#a0aec0', '#e2e8f0'],
        'unsplash_query': 'moody overcast grey cathedral fog',
        'description':   'Mid energy, low valence — quiet and heavy, like an overcast sky.',
    },
}


def extract_palette_from_features(
    average_valence: float,
    average_energy: float,
    genres: list[str] | None = None,
) -> dict:
    """
    Extract a named color palette and Unsplash search query from a user's
    average audio features (top 20 tracks).

    Args:
        average_valence: Mean valence across top tracks (0.0–1.0)
        average_energy:  Mean energy across top tracks (0.0–1.0)
        genres:          Optional list of top genres for refinement

    Returns:
        {
          name, palette, unsplash_query, description,
          energy, valence, genre_override (bool)
        }
    """
    # Genre-specific overrides take priority
    if genres:
        genre_str = ' '.join(g.lower() for g in genres)
        for key, gp in _GENRE_PALETTES.items():
            if key in genre_str:
                # Build a genre-specific unsplash query
                genre_tags = GENRE_TAGS.get(key, [key])
                query = ' '.join(genre_tags[:2]) if genre_tags else key
                return {
                    'name':           key.title(),
                    'palette':        gp,
                    'unsplash_query': query,
                    'description':    f'Palette derived from your dominant {key} listening.',
                    'energy':         round(average_energy, 3),
                    'valence':        round(average_valence, 3),
                    'genre_override': True,
                }

    # Energy/valence quadrant matching
    for key, entry in _FEATURE_PALETTES.items():
        e_lo, e_hi = entry['energy_range']
        v_lo, v_hi = entry['valence_range']
        if e_lo <= average_energy <= e_hi and v_lo <= average_valence <= v_hi:
            return {
                'name':           entry['name'],
                'palette':        entry['palette'],
                'unsplash_query': entry['unsplash_query'],
                'description':    entry['description'],
                'energy':         round(average_energy, 3),
                'valence':        round(average_valence, 3),
                'genre_override': False,
            }

    # Fallback
    return {
        'name':           'Cosmic Default',
        'palette':        ['#1a1a2e', '#3a0ca3', '#7209b7', '#f72585', '#4361ee'],
        'unsplash_query': 'abstract space nebula dark',
        'description':    'A universal palette for the unclassifiable listener.',
        'energy':         round(average_energy, 3),
        'valence':        round(average_valence, 3),
        'genre_override': False,
    }
