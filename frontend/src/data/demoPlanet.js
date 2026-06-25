/**
 * demoPlanet.js
 * -------------
 * A fully self-contained seed profile that powers the /demo route.
 * Every property intentionally resembles a real profile object so the
 * Soul Orb, Galaxy, and identity pages render without modification.
 *
 * Artists/tracks are REAL public artists (dream-pop / shoegaze / ambient-folk)
 * so the demo can showcase real in-galaxy Spotify playback. This is curated demo
 * data, NOT any real user's listening history — the /demo banner says as much.
 *
 * Visual identity: "Dreamy / Melancholic" archetype blend.
 * Audio signature: low energy, high acousticness, medium valence, moderate tempo.
 */

export const DEMO_PROFILE = {
  // ── Meta ────────────────────────────────────────────────────────────────────
  profileSchemaVersion: '2026-04-v1',
  provider:             'demo',
  generatedAt:          '2026-05-01T00:00:00.000Z',
  syncedAt:             '2026-05-01T00:00:00.000Z',
  isDemo:               true,
  timeRange:            'medium_term',

  // ── User ────────────────────────────────────────────────────────────────────
  userProfile: {
    id:          'demo-listener',
    username:    'midnight.drifter',
    displayName: 'Midnight Drifter',
  },

  // ── Audio features ───────────────────────────────────────────────────────────
  audioFeatures: {
    energy:          0.28,
    valence:         0.38,
    danceability:    0.42,
    acousticness:    0.72,
    instrumentalness:0.31,
    liveness:        0.11,
    speechiness:     0.04,
    tempo:           88,
  },

  // ── Genres ──────────────────────────────────────────────────────────────────
  genres: [
    { genre: 'dream pop',          count: 38, weight: 0.96 },
    { genre: 'shoegaze',           count: 34, weight: 0.88 },
    { genre: 'ambient folk',       count: 28, weight: 0.76 },
    { genre: 'neo-soul',           count: 22, weight: 0.62 },
    { genre: 'chamber pop',        count: 18, weight: 0.52 },
    { genre: 'slowcore',           count: 14, weight: 0.44 },
    { genre: 'lo-fi indie',        count: 11, weight: 0.38 },
    { genre: 'melancholic r&b',    count:  8, weight: 0.30 },
  ],

  // ── Top artists ─────────────────────────────────────────────────────────────
  // Real, public artists in the dream-pop / shoegaze / ambient-folk sphere so the
  // demo can showcase real in-galaxy playback (the Spotify Embed needs a real
  // track/artist id). Each spotify_url is that artist's signature track, so an
  // artist star plays too — verified live via Spotify search, not recalled.
  topArtists: [
    { id: 'a1', name: 'Beach House',     popularity: 72, genres: ['dream pop', 'shoegaze'],        image: null, spotify_url: 'https://open.spotify.com/track/7H0ya83CMmgFcOhw0UB6ow' },
    { id: 'a2', name: 'Slowdive',        popularity: 68, genres: ['shoegaze', 'dream pop'],        image: null, spotify_url: 'https://open.spotify.com/track/0eVz3hV2xOXdneGpnWDFpb' },
    { id: 'a3', name: 'Sufjan Stevens',  popularity: 81, genres: ['chamber pop', 'ambient folk'],  image: null, spotify_url: 'https://open.spotify.com/track/0MNNKSUU9OOQ8DSGWduw79' },
    { id: 'a4', name: 'Sampha',          popularity: 64, genres: ['neo-soul', 'melancholic r&b'],  image: null, spotify_url: 'https://open.spotify.com/track/3D1VUmjj0IlhdHqGConc7C' },
    { id: 'a5', name: 'Beach Fossils',   popularity: 59, genres: ['lo-fi indie', 'dream pop'],     image: null, spotify_url: 'https://open.spotify.com/track/6XyjwF7CAwuEaW77noJr6I' },
    { id: 'a6', name: 'Sade',            popularity: 55, genres: ['neo-soul', 'melancholic r&b'],  image: null, spotify_url: 'https://open.spotify.com/track/7H3ojI1BsVy0dEJENqMt1k' },
    { id: 'a7', name: 'Grouper',         popularity: 62, genres: ['ambient folk', 'slowcore'],     image: null, spotify_url: 'https://open.spotify.com/track/1nJV1JGWf61WRJy851LO34' },
    { id: 'a8', name: 'Alex G',          popularity: 48, genres: ['lo-fi indie', 'slowcore'],      image: null, spotify_url: 'https://open.spotify.com/track/4p9iQNEmsIGkB6eG8Val8n' },
    { id: 'a9', name: 'DIIV',            popularity: 74, genres: ['shoegaze', 'dream pop'],        image: null, spotify_url: 'https://open.spotify.com/track/30uvCVEYqgktyLfDcI76Hx', metrics: { isSurge: true } },
    { id:'a10', name: 'Cocteau Twins',   popularity: 44, genres: ['dream pop', 'shoegaze'],        image: null, spotify_url: 'https://open.spotify.com/track/37pKTyMwalomKCZjxTc2QZ', metrics: { isGhost: true } },
  ],

  // ── Top tracks ──────────────────────────────────────────────────────────────
  // Each carries a real spotify_url → the track satellite plays the actual song
  // on star-open via the Spotify Embed. audio_features stay low/introspective to
  // preserve the galaxy's sonic color + mood-region mapping.
  topTracks: [
    { id: 't1',  title: 'Space Song',                          artist: 'Beach House',    album_art: null, audio_features: { energy: 0.22, valence: 0.33 }, spotify_url: 'https://open.spotify.com/track/7H0ya83CMmgFcOhw0UB6ow' },
    { id: 't2',  title: 'Sugar for the Pill',                  artist: 'Slowdive',       album_art: null, audio_features: { energy: 0.30, valence: 0.45 }, spotify_url: 'https://open.spotify.com/track/0eVz3hV2xOXdneGpnWDFpb' },
    { id: 't3',  title: 'Mystery of Love',                     artist: 'Sufjan Stevens', album_art: null, audio_features: { energy: 0.35, valence: 0.40 }, spotify_url: 'https://open.spotify.com/track/0MNNKSUU9OOQ8DSGWduw79' },
    { id: 't4',  title: '(No One Knows Me) Like the Piano',    artist: 'Sampha',         album_art: null, audio_features: { energy: 0.19, valence: 0.28 }, spotify_url: 'https://open.spotify.com/track/3D1VUmjj0IlhdHqGConc7C' },
    { id: 't5',  title: 'Sleep Apnea',                         artist: 'Beach Fossils',  album_art: null, audio_features: { energy: 0.25, valence: 0.36 }, spotify_url: 'https://open.spotify.com/track/6XyjwF7CAwuEaW77noJr6I' },
    { id: 't6',  title: 'By Your Side',                        artist: 'Sade',           album_art: null, audio_features: { energy: 0.26, valence: 0.41 }, spotify_url: 'https://open.spotify.com/track/7H3ojI1BsVy0dEJENqMt1k' },
    { id: 't7',  title: 'Living Room',                         artist: 'Grouper',        album_art: null, audio_features: { energy: 0.32, valence: 0.38 }, spotify_url: 'https://open.spotify.com/track/1nJV1JGWf61WRJy851LO34' },
    { id: 't8',  title: 'Mary',                                artist: 'Alex G',         album_art: null, audio_features: { energy: 0.18, valence: 0.24 }, spotify_url: 'https://open.spotify.com/track/4p9iQNEmsIGkB6eG8Val8n' },
  ],

  // ── Analytics ───────────────────────────────────────────────────────────────
  analyticsMetrics: {
    energyScore:      28,
    valenceScore:     38,
    tempoAvg:         88,
    danceabilityScore:42,
    nostalgiaIndex:   74,
    diversityScore:   58,
    sonicBrightness:  34,
    mood:             'introspective',
    metricConfidence: { energyScore: { label: 'high' } },
    sampleSizes:      { energyScore: 8, nostalgiaIndex: 8 },
  },
  canComputeAnalytics: true,
  canComputeIdentity:  true,
  canRenderGalaxy:     true,

  // ── Personality (canonical 6-archetype system) ─────────────────────────────
  personality: [
    {
      archetype:   'Dreamy',
      label:       'Dreamy',
      description: 'You live inside the music. Atmosphere, texture, and feeling matter more than structure or rhythm.',
      traits:      ['introspective', 'atmospheric', 'tender'],
      color:       '#B994FF',
      weight:      0.72,
    },
    {
      archetype:   'Melancholic',
      label:       'Melancholic',
      description: 'There is something you keep returning to in quieter songs. A feeling that does not need a name.',
      traits:      ['nostalgic', 'reflective', 'still'],
      color:       '#9DB7FF',
      weight:      0.55,
    },
  ],
  personalityMeta: {
    confidence:  0.74,
    description: 'A pattern of returning to soft, textured sound. The listening signal leans quiet, slow, and far away.',
    color:       '#B994FF',
    traits:      ['introspective', 'atmospheric', 'tender'],
  },

  // ── MBTI ────────────────────────────────────────────────────────────────────
  mbti: {
    type:        'INFP',
    description: 'Your listening pattern leans inward — you reach for music that confirms a feeling rather than introduces one.',
  },
  mbtiMeta: { confidence: 0.68 },

  // ── Confidence ──────────────────────────────────────────────────────────────
  confidence: {
    overall:   0.74,
    analytics: { score: 0.72, label: 'high'   },
    identity:  { score: 0.74, label: 'high'   },
    galaxy:    { score: 0.68, label: 'medium' },
    soulmate:  { score: 0.45, label: 'low'    },
  },

  // ── Data quality ─────────────────────────────────────────────────────────────
  dataQuality: {
    provider:               'demo',
    topArtistsCount:        10,
    topTracksCount:         8,
    genresCount:            8,
    audioFeaturesRequested: 8,
    audioFeaturesCount:     8,
    audioCoverage:          1.0,
    hasAudioProfile:        true,
    degradedReasons:        [],
  },
  isDegraded: false,

  // ── Readiness ───────────────────────────────────────────────────────────────
  analyticsReadiness:   { ready: true,  confidence: { score: 0.72, label: 'high'   } },
  identityReadiness:    { ready: true,  confidence: { score: 0.74, label: 'high'   } },
  soulmateReadiness:    { ready: false, confidence: { score: 0.45, label: 'low'    }, mode: 'degraded' },
}

/**
 * Returns a pre-built galaxy model from the demo profile.
 * Import lazily — only needed on /demo.
 */
export function buildDemoGalaxyModel() {
  // Dynamic import so the full galaxyBuilder is not pulled into the demo bundle
  // synchronously.  Callers should await this.
  return import('../features/galaxy/galaxyBuilder').then(({ buildGalaxyModel }) =>
    buildGalaxyModel(DEMO_PROFILE),
  )
}
