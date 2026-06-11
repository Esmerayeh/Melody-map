/**
 * demoPlanet.js
 * -------------
 * A fully self-contained seed profile that powers the /demo route.
 * Every property intentionally resembles a real profile object so the
 * Soul Orb, Galaxy, and identity pages render without modification.
 *
 * All data is CLEARLY fictional — labels use evocative but non-real names.
 * Nothing claims to be from a real Spotify account.
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
  topArtists: [
    { id: 'a1', name: 'Velvet Collapse',    popularity: 72, genres: ['dream pop', 'shoegaze'],      image: null },
    { id: 'a2', name: 'Pale Shore',         popularity: 68, genres: ['dream pop', 'ambient folk'],  image: null },
    { id: 'a3', name: 'Glass Meridian',     popularity: 81, genres: ['shoegaze', 'chamber pop'],    image: null },
    { id: 'a4', name: 'Hollow Archive',     popularity: 64, genres: ['neo-soul', 'slowcore'],       image: null },
    { id: 'a5', name: 'The Quiet Radius',   popularity: 59, genres: ['lo-fi indie', 'ambient folk'],image: null },
    { id: 'a6', name: 'Moth Signal',        popularity: 55, genres: ['melancholic r&b'],            image: null },
    { id: 'a7', name: 'Crestfall',          popularity: 62, genres: ['dream pop'],                  image: null },
    { id: 'a8', name: 'Sunken Hymns',       popularity: 48, genres: ['slowcore', 'ambient folk'],   image: null },
    { id: 'a9', name: 'Neon Bruise',        popularity: 74, genres: ['shoegaze', 'neo-soul'],       image: null, metrics: { isSurge: true }  },
    { id:'a10', name: 'Porcelain Distance', popularity: 44, genres: ['chamber pop'],                image: null, metrics: { isGhost: true } },
  ],

  // ── Top tracks ──────────────────────────────────────────────────────────────
  topTracks: [
    { id: 't1',  title: 'Everything Softens',   artist: 'Velvet Collapse',  album_art: null, audio_features: { energy: 0.22, valence: 0.33 } },
    { id: 't2',  title: 'Coastline Memory',     artist: 'Pale Shore',       album_art: null, audio_features: { energy: 0.30, valence: 0.45 } },
    { id: 't3',  title: 'Glass Meridian',       artist: 'Glass Meridian',   album_art: null, audio_features: { energy: 0.35, valence: 0.40 } },
    { id: 't4',  title: 'Low Tide Dispatch',    artist: 'Hollow Archive',   album_art: null, audio_features: { energy: 0.19, valence: 0.28 } },
    { id: 't5',  title: 'Quiet Radius',         artist: 'The Quiet Radius', album_art: null, audio_features: { energy: 0.25, valence: 0.36 } },
    { id: 't6',  title: 'Signal Moth',          artist: 'Moth Signal',      album_art: null, audio_features: { energy: 0.26, valence: 0.41 } },
    { id: 't7',  title: 'After the Crest',      artist: 'Crestfall',        album_art: null, audio_features: { energy: 0.32, valence: 0.38 } },
    { id: 't8',  title: 'Hymn for the Drowned', artist: 'Sunken Hymns',     album_art: null, audio_features: { energy: 0.18, valence: 0.24 } },
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
