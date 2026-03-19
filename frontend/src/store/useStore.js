import { create } from 'zustand'

const useStore = create((set) => ({
  // App auth — authenticated if we have either an app token OR a music provider token
  user: null,
  isAuthenticated: !!(
    localStorage.getItem('token') ||
    localStorage.getItem('spotify_token') ||
    localStorage.getItem('lastfm_session')
  ),

  // Spotify
  spotifyToken:     localStorage.getItem('spotify_token') || null,
  spotifyProfile:   null,
  spotifyConnected: !!localStorage.getItem('spotify_token'),

  // Last.fm
  lastfmSession:   localStorage.getItem('lastfm_session') || null,
  lastfmUsername:  localStorage.getItem('lastfm_username') || null,
  lastfmConnected: !!localStorage.getItem('lastfm_session'),

  // Active music provider: 'spotify' | 'lastfm' | null
  musicProvider: localStorage.getItem('music_provider') || null,

  // Selected map node
  selectedSong: null,

  // Cinema mode (full-screen galaxy)
  cinemaMode: false,
  setCinemaMode: (val) => set({ cinemaMode: val }),

  setUser: (user) => set({ user, isAuthenticated: true }),

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('spotify_token')
    localStorage.removeItem('spotify_refresh_token')
    localStorage.removeItem('lastfm_session')
    localStorage.removeItem('lastfm_username')
    localStorage.removeItem('music_provider')
    localStorage.removeItem('music_profile_time_range')
    localStorage.removeItem('vibe_features')
    localStorage.removeItem('sonic_identity')
    localStorage.removeItem('aesthetic_state')
    localStorage.removeItem('emotional_cluster')
    set({
      user: null, isAuthenticated: false,
      spotifyToken: null, spotifyProfile: null, spotifyConnected: false,
      lastfmSession: null, lastfmUsername: null, lastfmConnected: false,
      musicProvider: null,
      musicProfile: null, musicProfileLoading: false, musicProfileError: null,
      vibeFeatures: null, sonicIdentity: null, aestheticState: null, emotionalCluster: null,
    })
  },

  // Spotify actions
  setSpotifyToken: (token, refreshToken) => {
    localStorage.setItem('spotify_token', token)
    localStorage.setItem('music_provider', 'spotify')
    if (refreshToken) localStorage.setItem('spotify_refresh_token', refreshToken)
    set({ spotifyToken: token, spotifyConnected: true, musicProvider: 'spotify', isAuthenticated: true })
  },

  setSpotifyProfile: (profile) => set({ spotifyProfile: profile }),

  disconnectSpotify: () => {
    localStorage.removeItem('spotify_token')
    localStorage.removeItem('spotify_refresh_token')
    const provider = localStorage.getItem('music_provider')
    if (provider === 'spotify') {
      localStorage.removeItem('music_provider')
      set({ spotifyToken: null, spotifyProfile: null, spotifyConnected: false, musicProvider: null })
    } else {
      set({ spotifyToken: null, spotifyProfile: null, spotifyConnected: false })
    }
  },

  // Last.fm actions
  setLastfm: (session, username) => {
    localStorage.setItem('lastfm_session', session)
    localStorage.setItem('lastfm_username', username)
    localStorage.setItem('music_provider', 'lastfm')
    set({ lastfmSession: session, lastfmUsername: username, lastfmConnected: true, musicProvider: 'lastfm', isAuthenticated: true })
  },

  disconnectLastfm: () => {
    localStorage.removeItem('lastfm_session')
    localStorage.removeItem('lastfm_username')
    const provider = localStorage.getItem('music_provider')
    if (provider === 'lastfm') {
      localStorage.removeItem('music_provider')
      set({ lastfmSession: null, lastfmUsername: null, lastfmConnected: false, musicProvider: null })
    } else {
      set({ lastfmSession: null, lastfmUsername: null, lastfmConnected: false })
    }
  },

  setSelectedSong: (song) => set({ selectedSong: song }),

  // Aesthetic state — persists the active aesthetic palette for dynamic theming
  aestheticState: JSON.parse(localStorage.getItem('aesthetic_state') || 'null'),
  setAestheticState: (state) => {
    if (state) localStorage.setItem('aesthetic_state', JSON.stringify(state))
    else localStorage.removeItem('aesthetic_state')
    set({ aestheticState: state })
  },

  // Vibe features — average audio features used by the generative theme engine
  vibeFeatures: JSON.parse(localStorage.getItem('vibe_features') || 'null'),
  setVibeFeatures: (features) => {
    if (features) localStorage.setItem('vibe_features', JSON.stringify(features))
    else localStorage.removeItem('vibe_features')
    set({ vibeFeatures: features })
  },

  // Sonic Identity — derived personality + emotional cluster from Auditory DNA
  sonicIdentity: JSON.parse(localStorage.getItem('sonic_identity') || 'null'),
  setSonicIdentity: (identity) => {
    if (identity) localStorage.setItem('sonic_identity', JSON.stringify(identity))
    else localStorage.removeItem('sonic_identity')
    set({ sonicIdentity: identity })
  },

  // Emotional Resonance Cluster — e.g. "Liminal Nostalgia", "High-Octane Euphoria"
  emotionalCluster: localStorage.getItem('emotional_cluster') || null,
  setEmotionalCluster: (cluster) => {
    if (cluster) localStorage.setItem('emotional_cluster', cluster)
    else localStorage.removeItem('emotional_cluster')
    set({ emotionalCluster: cluster })
  },

  // ── Central Music Profile (from /api/music-profile) ───────────────────────
  // Single source of truth for all pages. Fetched once, shared everywhere.
  musicProfile: null,
  musicProfileLoading: false,
  musicProfileError: null,
  musicProfileTimeRange: localStorage.getItem('music_profile_time_range') || 'medium_term',

  setMusicProfile: (profile) => set({ musicProfile: profile, musicProfileError: null }),
  setMusicProfileLoading: (loading) => set({ musicProfileLoading: loading }),
  setMusicProfileError: (error) => set({ musicProfileError: error }),
  setMusicProfileTimeRange: (range) => {
    localStorage.setItem('music_profile_time_range', range)
    set({ musicProfileTimeRange: range, musicProfile: null }) // clear cache on range change
  },
  clearMusicProfile: () => set({ musicProfile: null, musicProfileError: null }),
}))

export default useStore
