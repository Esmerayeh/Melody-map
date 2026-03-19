"""
Discover Engine
---------------
Generates personalized playlist concepts from a user's taste profile.
Each playlist has: title, description, mood tags, era, aesthetic, song list,
and a "why it fits you" message — all derived from audio features + genres.

No external API calls — pure algorithmic generation seeded by taste data.
The frontend then resolves real Spotify tracks via the Spotify API.
"""

from __future__ import annotations
import random
from dataclasses import dataclass, field

# ── Playlist archetypes ────────────────────────────────────────────────────────
# Each archetype defines the "soul" of a playlist type.
# Matched against the user's audio features + genres.

@dataclass
class PlaylistArchetype:
    id: str
    title_templates: list[str]
    descriptions: list[str]
    why_templates: list[str]
    seed_genres: list[str]          # genres that activate this archetype
    seed_artists: list[str]         # artist names used as Spotify search seeds
    seed_queries: list[str]         # Spotify search queries for track discovery
    mood_tags: list[str]
    aesthetic_tags: list[str]
    era_tags: list[str]
    energy_range: tuple[float, float]
    valence_range: tuple[float, float]
    color: str                      # accent color for UI


_ARCHETYPES: list[PlaylistArchetype] = [

    PlaylistArchetype(
        id='nocturnal_drift',
        title_templates=[
            'Nocturnal Drift — {adj} Hours',
            'After Midnight: {adj} Frequencies',
            '{adj} Static at 3am',
            'Signals from the Dark: {adj} Transmissions',
        ],
        descriptions=[
            'The city breathes differently after midnight. Soft reverb, slow pulses, and voices that feel like half-remembered dreams.',
            'Somewhere between sleep and waking, these sounds exist. Hazy, warm, and endlessly patient.',
            'Late-night frequencies for the restless mind — music that understands the weight of 3am.',
        ],
        why_templates=[
            'Your taste gravitates toward the atmospheric and introspective — this playlist lives in the same quiet hours you do.',
            'The low energy and melancholic undertones in your listening history led here: a space built for late-night reflection.',
            'You listen like someone who finds beauty in stillness. This is that stillness, set to sound.',
        ],
        seed_genres=['shoegaze', 'dream pop', 'lo-fi', 'ambient', 'darkwave', 'slowcore'],
        seed_artists=['Beach House', 'Grouper', 'Mazzy Star', 'Cigarettes After Sex', 'Portishead', 'Cocteau Twins'],
        seed_queries=['dreamy shoegaze', 'lo-fi ambient night', 'dream pop atmospheric', 'slowcore melancholic'],
        mood_tags=['dreamy', 'melancholic', 'introspective', 'nocturnal'],
        aesthetic_tags=['neon fog', 'blurred lights', 'rainy window', 'dark bedroom'],
        era_tags=['90s', '2000s', '2010s'],
        energy_range=(0.0, 0.45),
        valence_range=(0.0, 0.55),
        color='#3a0ca3',
    ),

    PlaylistArchetype(
        id='golden_nostalgia',
        title_templates=[
            'Golden Hour Nostalgia — {adj} Afternoons',
            'Warm Static: {adj} Memories',
            '{adj} Film Grain & Fading Light',
            'Polaroid Sunsets: {adj} Reverie',
        ],
        descriptions=[
            'Warm guitars, dusty afternoons, and the feeling that everything important happened just slightly out of reach.',
            'Like finding an old photograph — familiar, tender, and aching with the beauty of things that passed.',
            'Indie folk and sun-bleached indie rock for the part of you that still believes in golden afternoons.',
        ],
        why_templates=[
            'Your listening history is full of warmth and longing — this playlist is the sound of that feeling.',
            'You gravitate toward music with texture and memory. These songs smell like old film and summer afternoons.',
            'The nostalgic valence in your top tracks pointed here: a playlist that lives in the golden hour.',
        ],
        seed_genres=['indie folk', 'indie rock', 'folk', 'lo-fi', 'alternative', 'singer-songwriter'],
        seed_artists=['Fleet Foxes', 'Bon Iver', 'Iron & Wine', 'Sufjan Stevens', 'Big Thief', 'Phoebe Bridgers'],
        seed_queries=['indie folk nostalgic', 'warm acoustic indie', 'folk singer-songwriter emotional'],
        mood_tags=['nostalgic', 'warm', 'bittersweet', 'reflective'],
        aesthetic_tags=['vintage film photography', 'polaroid aesthetic', 'golden hour', 'warm grain'],
        era_tags=['2000s', '2010s', '2020s'],
        energy_range=(0.2, 0.6),
        valence_range=(0.35, 0.7),
        color='#d2691e',
    ),

    PlaylistArchetype(
        id='neon_kinetic',
        title_templates=[
            'Neon Kinetic — {adj} Frequencies',
            '{adj} Highway at 140 BPM',
            'Electric {adj}: Pulse & Motion',
            'Charged Particles: {adj} Transmission',
        ],
        descriptions=[
            'Synthesizers that feel like speed, drums that feel like urgency. This is music for moving through the world at full voltage.',
            'Neon-soaked and relentless — electronic textures built for the space between midnight and dawn.',
            'High energy, high stakes. Every track here is a small act of controlled chaos.',
        ],
        why_templates=[
            'Your audio profile skews high-energy and kinetic — this playlist matches that charge.',
            'The tempo and danceability in your listening history built this: a playlist that never slows down.',
            'You listen like someone who needs music to keep pace with their mind. This does.',
        ],
        seed_genres=['electronic', 'synthwave', 'techno', 'house', 'drum and bass', 'industrial'],
        seed_artists=['Aphex Twin', 'Burial', 'Four Tet', 'Bicep', 'Moderat', 'Jon Hopkins'],
        seed_queries=['electronic high energy', 'synthwave neon', 'techno kinetic', 'house driving'],
        mood_tags=['energetic', 'electric', 'kinetic', 'focused'],
        aesthetic_tags=['cyberpunk city', 'neon streets', 'synthwave aesthetic', 'glitch art'],
        era_tags=['2000s', '2010s', '2020s'],
        energy_range=(0.65, 1.0),
        valence_range=(0.3, 0.8),
        color='#00f5ff',
    ),

    PlaylistArchetype(
        id='velvet_soul',
        title_templates=[
            'Velvet Soul — {adj} Frequencies',
            '{adj} Candlelight & Low Strings',
            'Warm Frequencies: {adj} Resonance',
            'Silk & Static: {adj} Warmth',
        ],
        descriptions=[
            'Soulful, warm, and deeply human. These songs live in the chest — not the head.',
            'R&B and soul for the moments when you need music that actually understands you.',
            'Velvet textures, emotional depth, and voices that carry the weight of lived experience.',
        ],
        why_templates=[
            'Your taste leans toward emotional depth and warmth — this playlist is built from that same frequency.',
            'The soulful undertones in your listening history led here: music that feels like a conversation.',
            'You listen for feeling, not just sound. These tracks deliver exactly that.',
        ],
        seed_genres=['r&b', 'soul', 'neo-soul', 'jazz', 'funk', 'gospel'],
        seed_artists=['Frank Ocean', 'Hiatus Kaiyote', 'Erykah Badu', 'D\'Angelo', 'Solange', 'Sade'],
        seed_queries=['neo-soul emotional', 'r&b soulful warm', 'jazz soul contemporary'],
        mood_tags=['soulful', 'warm', 'emotional', 'intimate'],
        aesthetic_tags=['velvet aesthetic', 'warm candlelight', 'moody portrait', 'silk texture'],
        era_tags=['70s', '90s', '2000s', '2010s', '2020s'],
        energy_range=(0.2, 0.65),
        valence_range=(0.4, 0.85),
        color='#8a0a5e',
    ),

    PlaylistArchetype(
        id='cosmic_expanse',
        title_templates=[
            'Cosmic Expanse — {adj} Horizons',
            '{adj} Signal from the Edge of Space',
            'Deep Field: {adj} Transmissions',
            'Orbital Drift: {adj} Frequencies',
        ],
        descriptions=[
            'Post-rock and ambient soundscapes that feel like standing at the edge of something vast and unknowable.',
            'Music that makes the room feel larger. Expansive, patient, and quietly overwhelming.',
            'For the moments when you need sound that matches the scale of your thoughts.',
        ],
        why_templates=[
            'Your listening history contains music that breathes — expansive, patient, and vast. This playlist lives there.',
            'The ambient and post-rock tendencies in your taste built this: a sonic landscape without edges.',
            'You listen like someone who needs space in their music. This is that space.',
        ],
        seed_genres=['post-rock', 'ambient', 'classical', 'experimental', 'drone', 'space rock'],
        seed_artists=['Godspeed You! Black Emperor', 'Explosions in the Sky', 'Brian Eno', 'Sigur Rós', 'Stars of the Lid', 'Mogwai'],
        seed_queries=['post-rock cinematic', 'ambient expansive', 'instrumental atmospheric vast'],
        mood_tags=['expansive', 'meditative', 'cinematic', 'introspective'],
        aesthetic_tags=['starry night sky', 'misty mountains', 'aurora borealis', 'vast landscape'],
        era_tags=['90s', '2000s', '2010s', '2020s'],
        energy_range=(0.0, 0.5),
        valence_range=(0.2, 0.65),
        color='#4040be',
    ),

    PlaylistArchetype(
        id='urban_pulse',
        title_templates=[
            'Urban Pulse — {adj} City Frequencies',
            '{adj} Midnight Skyline',
            'Street Level: {adj} Transmissions',
            'City Static: {adj} Wavelength',
        ],
        descriptions=[
            'Hip-hop and trap for the city at night — gritty, poetic, and alive with the energy of concrete and neon.',
            'Street-level music that finds beauty in the urban landscape. Beats that feel like footsteps on wet pavement.',
            'The city has a rhythm. This playlist is it.',
        ],
        why_templates=[
            'Your taste has an urban edge — this playlist channels that energy into something cohesive and alive.',
            'The hip-hop and trap influences in your listening history built this: a city soundtrack for your headphones.',
            'You listen like someone who finds poetry in the everyday. These tracks do the same.',
        ],
        seed_genres=['hip hop', 'trap', 'rap', 'grime', 'drill', 'afrobeats'],
        seed_artists=['Kendrick Lamar', 'Frank Ocean', 'Tyler the Creator', 'J. Cole', 'SZA', 'Burna Boy'],
        seed_queries=['hip hop lyrical', 'trap atmospheric', 'rap introspective', 'afrobeats urban'],
        mood_tags=['energetic', 'confident', 'introspective', 'urban'],
        aesthetic_tags=['urban street art', 'city skyline night', 'graffiti wall', 'golden hour city'],
        era_tags=['2000s', '2010s', '2020s'],
        energy_range=(0.5, 1.0),
        valence_range=(0.3, 0.8),
        color='#ffd700',
    ),

    PlaylistArchetype(
        id='ethereal_bloom',
        title_templates=[
            'Ethereal Bloom — {adj} Frequencies',
            '{adj} Lavender Fields at Dusk',
            'Soft Cosmos: {adj} Reverie',
            'Pastel Signal: {adj} Drift',
        ],
        descriptions=[
            'Indie pop and dream pop that floats — light, airy, and full of the kind of joy that feels almost too delicate to hold.',
            'Pastel-colored and weightless. Music for the moments when everything feels possible.',
            'Soft synths, gentle vocals, and the feeling of sunlight through curtains on a slow morning.',
        ],
        why_templates=[
            'Your taste has a bright, airy quality — this playlist lives in that same soft light.',
            'The high valence and gentle energy in your listening history built this: a playlist that feels like a deep breath.',
            'You listen like someone who finds joy in small, beautiful things. These songs are those things.',
        ],
        seed_genres=['indie pop', 'dream pop', 'bedroom pop', 'chillwave', 'synth pop', 'k-pop'],
        seed_artists=['Clairo', 'Tame Impala', 'Alvvays', 'Men I Trust', 'Japanese Breakfast', 'Carly Rae Jepsen'],
        seed_queries=['indie pop dreamy', 'bedroom pop soft', 'dream pop ethereal', 'chillwave pastel'],
        mood_tags=['dreamy', 'joyful', 'light', 'ethereal'],
        aesthetic_tags=['pastel sky', 'soft clouds', 'lavender fields', 'soft focus'],
        era_tags=['2010s', '2020s'],
        energy_range=(0.3, 0.7),
        valence_range=(0.55, 1.0),
        color='#f093fb',
    ),

    PlaylistArchetype(
        id='storm_and_shadow',
        title_templates=[
            'Storm & Shadow — {adj} Frequencies',
            '{adj} Cathedral at Midnight',
            'Dark Matter: {adj} Signal',
            'Void Transmission: {adj} Static',
        ],
        descriptions=[
            'Metal, post-punk, and darkwave for the parts of you that need music with teeth. Intense, raw, and cathartic.',
            'Heavy textures and dark atmospheres — music that doesn\'t flinch from the difficult parts of being alive.',
            'Forged in storm and shadow. These tracks carry weight.',
        ],
        why_templates=[
            'Your taste has an intensity to it — this playlist matches that energy without apology.',
            'The high energy and low valence in your listening history built this: music that processes the difficult stuff.',
            'You listen like someone who needs music to be honest. These tracks are.',
        ],
        seed_genres=['metal', 'post-punk', 'darkwave', 'gothic rock', 'industrial', 'black metal'],
        seed_artists=['Depeche Mode', 'Joy Division', 'Nine Inch Nails', 'Bauhaus', 'The Cure', 'Swans'],
        seed_queries=['post-punk dark', 'darkwave gothic', 'industrial intense', 'metal atmospheric'],
        mood_tags=['intense', 'cathartic', 'dark', 'powerful'],
        aesthetic_tags=['gothic cathedral', 'dark forest', 'storm clouds', 'dramatic lightning'],
        era_tags=['80s', '90s', '2000s', '2010s'],
        energy_range=(0.55, 1.0),
        valence_range=(0.0, 0.45),
        color='#8b0000',
    ),

    PlaylistArchetype(
        id='global_reverie',
        title_templates=[
            'Global Reverie — {adj} Frequencies',
            '{adj} Crossroads: World Frequencies',
            'Borders Dissolved: {adj} Transmissions',
            'Celestial Drifts — {adj} Reverie',
        ],
        descriptions=[
            'From misty Kyoto mornings to neon-soaked Lagos nights — music that crosses borders and eras without asking permission.',
            'World music, global beats, and cross-cultural fusions that remind you the planet is full of extraordinary sound.',
            'A playlist that doesn\'t know what country it\'s from. It just knows it\'s beautiful.',
        ],
        why_templates=[
            'Your eclectic taste suggests an openness to sound from anywhere — this playlist honors that curiosity.',
            'The genre diversity in your listening history built this: a playlist without borders.',
            'You listen like someone who finds music everywhere. This playlist goes everywhere.',
        ],
        seed_genres=['world music', 'afrobeats', 'bossa nova', 'flamenco', 'reggaeton', 'j-pop', 'k-pop', 'cumbia'],
        seed_artists=['Burna Boy', 'Rosalía', 'Anitta', 'Wizkid', 'Arooj Aftab', 'Khruangbin'],
        seed_queries=['world music fusion', 'afrobeats global', 'latin alternative', 'global beats eclectic'],
        mood_tags=['curious', 'joyful', 'adventurous', 'cultural'],
        aesthetic_tags=['tropical beach', 'colorful culture', 'world market', 'vibrant street'],
        era_tags=['2000s', '2010s', '2020s'],
        energy_range=(0.3, 0.9),
        valence_range=(0.4, 1.0),
        color='#06b6d4',
    ),

    PlaylistArchetype(
        id='vaporwave_reverie',
        title_templates=[
            'Vaporwave Reverie — {adj} Mall Frequencies',
            '{adj} Glitch Nostalgia',
            'Pastel Digital: {adj} Dreamworld',
            'Retro Signal: {adj} Transmission',
        ],
        descriptions=[
            'Slowed-down R&B, vaporwave, and chillwave for the part of you that\'s nostalgic for a past that never existed.',
            'Pastel glitch aesthetics and retro digital textures — music that feels like a memory of the future.',
            'Somewhere between 1987 and 2087, these sounds exist. Warm, strange, and deeply comforting.',
        ],
        why_templates=[
            'Your taste has a nostalgic, dreamy quality that maps perfectly onto this retro-futurist space.',
            'The lo-fi and atmospheric tendencies in your listening history built this: a playlist out of time.',
            'You listen like someone who finds beauty in the in-between. This playlist lives there.',
        ],
        seed_genres=['vaporwave', 'chillwave', 'synthwave', 'lo-fi', 'future funk', 'city pop'],
        seed_artists=['Macintosh Plus', 'Saint Pepsi', 'Washed Out', 'Toro y Moi', 'Neon Indian', 'Com Truise'],
        seed_queries=['vaporwave aesthetic', 'chillwave nostalgic', 'synthwave retro', 'lo-fi city pop'],
        mood_tags=['nostalgic', 'dreamy', 'surreal', 'retro'],
        aesthetic_tags=['pastel glitch', 'retro computer aesthetic', 'pink sunset mall', 'nostalgic digital'],
        era_tags=['80s', '90s', '2010s', '2020s'],
        energy_range=(0.2, 0.6),
        valence_range=(0.35, 0.75),
        color='#ff71ce',
    ),
]

# ── Adjective banks (seeded by audio features) ────────────────────────────────
_ADJ_HIGH_ENERGY   = ['Electric', 'Blazing', 'Charged', 'Kinetic', 'Radiant', 'Vivid', 'Neon']
_ADJ_LOW_ENERGY    = ['Quiet', 'Hushed', 'Muted', 'Soft', 'Still', 'Hollow', 'Pale']
_ADJ_HIGH_VALENCE  = ['Golden', 'Luminous', 'Warm', 'Bright', 'Glowing', 'Amber', 'Sunlit']
_ADJ_LOW_VALENCE   = ['Midnight', 'Obsidian', 'Phantom', 'Dusk', 'Ash', 'Shadowed', 'Veiled']
_ADJ_MID           = ['Velvet', 'Cobalt', 'Silver', 'Lunar', 'Ivory', 'Hazy', 'Drifting']


def _pick_adj(energy: float, valence: float, rng: random.Random) -> str:
    if energy > 0.65:
        pool = _ADJ_HIGH_ENERGY
    elif energy < 0.4:
        pool = _ADJ_LOW_ENERGY
    elif valence > 0.65:
        pool = _ADJ_HIGH_VALENCE
    elif valence < 0.4:
        pool = _ADJ_LOW_VALENCE
    else:
        pool = _ADJ_MID
    return rng.choice(pool)


# ── Song tag generator ─────────────────────────────────────────────────────────
_ERA_MAP = {
    '60s': (1960, 1969), '70s': (1970, 1979), '80s': (1980, 1989),
    '90s': (1990, 1999), '2000s': (2000, 2009), '2010s': (2010, 2019), '2020s': (2020, 2029),
}

def _infer_era(year: int | None) -> str:
    if not year:
        return '2010s'
    for era, (lo, hi) in _ERA_MAP.items():
        if lo <= year <= hi:
            return era
    return '2020s'


def generate_song_tags(
    genre: str,
    energy: float,
    valence: float,
    year: int | None,
    archetype: PlaylistArchetype,
) -> dict:
    mood = 'energetic' if energy > 0.65 else ('melancholic' if valence < 0.4 else 'dreamy' if energy < 0.4 else 'bittersweet')
    return {
        'genre':     genre or archetype.seed_genres[0] if archetype.seed_genres else 'indie',
        'mood':      mood,
        'aesthetic': archetype.aesthetic_tags[0] if archetype.aesthetic_tags else '',
        'era':       _infer_era(year),
    }


# ── Main engine ────────────────────────────────────────────────────────────────

class DiscoverEngine:

    def _score_archetype(
        self,
        archetype: PlaylistArchetype,
        genres: list[str],
        energy: float,
        valence: float,
    ) -> float:
        """Score how well an archetype matches the user's taste profile."""
        score = 0.0

        # Energy/valence range match
        e_lo, e_hi = archetype.energy_range
        v_lo, v_hi = archetype.valence_range
        if e_lo <= energy <= e_hi:
            score += 0.4
        else:
            dist = min(abs(energy - e_lo), abs(energy - e_hi))
            score += max(0, 0.4 - dist)

        if v_lo <= valence <= v_hi:
            score += 0.3
        else:
            dist = min(abs(valence - v_lo), abs(valence - v_hi))
            score += max(0, 0.3 - dist)

        # Genre overlap
        genres_lower = [g.lower() for g in genres]
        for seed_genre in archetype.seed_genres:
            for user_genre in genres_lower:
                if seed_genre in user_genre or user_genre in seed_genre:
                    score += 0.1
                    break

        return score

    def select_archetypes(
        self,
        genres: list[str],
        energy: float,
        valence: float,
        n: int = 5,
        seed: int = 0,
    ) -> list[PlaylistArchetype]:
        """Select the n best-matching archetypes, with some randomness for variety."""
        scored = [
            (self._score_archetype(a, genres, energy, valence), a)
            for a in _ARCHETYPES
        ]
        scored.sort(key=lambda x: x[0], reverse=True)

        # Always include top 3, then randomly sample from the rest for variety
        top = [a for _, a in scored[:3]]
        rest = [a for _, a in scored[3:]]
        rng = random.Random(seed + int(energy * 100) + int(valence * 100))
        rng.shuffle(rest)
        selected = top + rest[:max(0, n - 3)]
        return selected[:n]

    def generate_playlist_concept(
        self,
        archetype: PlaylistArchetype,
        energy: float,
        valence: float,
        genres: list[str],
        seed: int = 0,
    ) -> dict:
        """Generate a single playlist concept (no real tracks yet — seeds for Spotify)."""
        rng = random.Random(seed + hash(archetype.id) % (2 ** 16))

        adj = _pick_adj(energy, valence, rng)
        title = rng.choice(archetype.title_templates).format(adj=adj)
        description = rng.choice(archetype.descriptions)
        why = rng.choice(archetype.why_templates)

        return {
            'id':             archetype.id + f'_{seed}',
            'title':          title,
            'description':    description,
            'why_it_fits':    why,
            'mood_tags':      archetype.mood_tags,
            'aesthetic_tags': archetype.aesthetic_tags[:4],
            'era_tags':       archetype.era_tags,
            'color':          archetype.color,
            'seed_artists':   archetype.seed_artists[:6],
            'seed_queries':   archetype.seed_queries[:3],
            'seed_genres':    archetype.seed_genres[:4],
        }

    def generate_playlists(
        self,
        genres: list[str],
        energy: float,
        valence: float,
        n_playlists: int = 6,
        seed: int = 0,
        serendipity: bool = False,
    ) -> list[dict]:
        """Generate n playlist concepts for the given taste profile."""
        # Compute Harmonic Mood Vector — a richer descriptor than raw energy/valence
        hmv = self._harmonic_mood_vector(genres, energy, valence)

        if serendipity:
            # Anti-algorithm: push toward outer edges of the embedding space
            archetypes = self._serendipity_archetypes(genres, energy, valence, n=n_playlists, seed=seed)
        else:
            archetypes = self.select_archetypes(genres, energy, valence, n=n_playlists, seed=seed)

        playlists = []
        for i, archetype in enumerate(archetypes):
            concept = self.generate_playlist_concept(archetype, energy, valence, genres, seed=seed + i)
            concept['harmonic_mood_vector'] = hmv
            playlists.append(concept)
        return playlists

    def _harmonic_mood_vector(self, genres: list[str], energy: float, valence: float) -> dict:
        """
        Compute a Harmonic Mood Vector — a named aesthetic descriptor that goes
        beyond simple energy/valence labels.

        Cross-references genre tags with audio features to produce nuanced
        aesthetic identifiers like "Liminal Space Nostalgia" or "Neon Petrichor".
        """
        # Genre-specific deep aesthetic mappings
        _DEEP_AESTHETICS = {
            ('shoegaze', 'low_energy', 'low_valence'):   'Liminal Space Nostalgia',
            ('shoegaze', 'low_energy', 'mid_valence'):   'Hazy Reverie Static',
            ('dream pop', 'low_energy', 'mid_valence'):  'Soft Dissolve Dreamscape',
            ('dream pop', 'low_energy', 'high_valence'): 'Pastel Infinity Bloom',
            ('lo-fi', 'low_energy', 'low_valence'):      'Rainy Window Solitude',
            ('lo-fi', 'low_energy', 'mid_valence'):      'Warm Cassette Drift',
            ('ambient', 'low_energy', 'low_valence'):    'Void Frequency Meditation',
            ('ambient', 'low_energy', 'mid_valence'):    'Cosmic Suspension Field',
            ('darkwave', 'low_energy', 'low_valence'):   'Moonlit Cathedral Ache',
            ('synthwave', 'high_energy', 'mid_valence'): 'Neon Petrichor Highway',
            ('synthwave', 'high_energy', 'high_valence'):'Electric Chrome Euphoria',
            ('vaporwave', 'low_energy', 'mid_valence'):  'Pastel Glitch Nostalgia',
            ('electronic', 'high_energy', 'low_valence'):'Dark Rave Catharsis',
            ('post-rock', 'low_energy', 'low_valence'):  'Vast Horizon Longing',
            ('post-rock', 'mid_energy', 'mid_valence'):  'Cinematic Threshold Drift',
            ('indie rock', 'mid_energy', 'mid_valence'): 'Golden Film Grain Warmth',
            ('folk', 'low_energy', 'high_valence'):      'Sunlit Meadow Solace',
            ('jazz', 'low_energy', 'mid_valence'):       'Smoky Amber Introspection',
            ('r&b', 'mid_energy', 'high_valence'):       'Velvet Candlelight Intimacy',
            ('hip hop', 'high_energy', 'mid_valence'):   'Midnight Skyline Confidence',
            ('metal', 'high_energy', 'low_valence'):     'Storm Cathedral Catharsis',
            ('k-pop', 'high_energy', 'high_valence'):    'Neon Pastel Euphoria',
            ('emo', 'mid_energy', 'low_valence'):        'Rain-Streaked Window Ache',
        }

        e_key = 'high_energy' if energy > 0.65 else ('low_energy' if energy < 0.4 else 'mid_energy')
        v_key = 'high_valence' if valence > 0.65 else ('low_valence' if valence < 0.4 else 'mid_valence')

        aesthetic_name = None
        for genre in genres:
            g_lower = genre.lower()
            for (g_key, ek, vk), name in _DEEP_AESTHETICS.items():
                if g_key in g_lower and ek == e_key and vk == v_key:
                    aesthetic_name = name
                    break
            if aesthetic_name:
                break

        if not aesthetic_name:
            # Fallback: compose from energy/valence descriptors
            e_words = {'high_energy': 'Electric', 'mid_energy': 'Drifting', 'low_energy': 'Hushed'}
            v_words = {'high_valence': 'Luminous', 'mid_valence': 'Bittersweet', 'low_valence': 'Shadowed'}
            aesthetic_name = f'{e_words[e_key]} {v_words[v_key]} Frequency'

        return {
            'name':    aesthetic_name,
            'energy':  round(energy, 3),
            'valence': round(valence, 3),
            'energy_label':  e_key.replace('_', ' '),
            'valence_label': v_key.replace('_', ' '),
        }

    def _serendipity_archetypes(
        self,
        genres: list[str],
        energy: float,
        valence: float,
        n: int = 5,
        seed: int = 0,
    ) -> list[PlaylistArchetype]:
        """
        Anti-algorithm: select archetypes from the OUTER EDGES of the user's
        embedding space — the music they didn't know they loved.
        """
        scored = [
            (self._score_archetype(a, genres, energy, valence), a)
            for a in _ARCHETYPES
        ]
        scored.sort(key=lambda x: x[0], reverse=True)

        # Invert: take the LOWEST scoring archetypes (most different from user)
        # but keep at least 1 familiar anchor
        anchor  = [scored[0][1]]
        outer   = [a for _, a in scored[-5:]]
        rng     = random.Random(seed + 999)
        rng.shuffle(outer)
        selected = anchor + outer[:max(0, n - 1)]
        return selected[:n]


discover_engine = DiscoverEngine()
