import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Heart, Play, Loader2, RefreshCw, Music2,
  Sparkles, ChevronRight, ExternalLink, Wand2, Radio,
  Shuffle, Clock,
} from 'lucide-react'
import { spotifyAPI, discoverAPI } from '../services/api'
import useMusicProfile from '../hooks/useMusicProfile'
import useStore from '../store/useStore'
import { useDebounce } from '../hooks/useDebounce'
import MusicSourceCard from '../components/MusicSourceCard'
import toast from 'react-hot-toast'

function getTimeContext() {
  const h = new Date().getHours()
  if (h >= 5  && h < 9)  return { label: 'Early Morning', emoji: '??', hint: 'Soft, slow, and awakening' }
  if (h >= 9  && h < 12) return { label: 'Morning',       emoji: '??', hint: 'Bright and focused' }
  if (h >= 12 && h < 17) return { label: 'Afternoon',     emoji: '???', hint: 'Warm and flowing' }
  if (h >= 17 && h < 20) return { label: 'Evening',       emoji: '??', hint: 'Golden and reflective' }
  if (h >= 20 && h < 23) return { label: 'Night',         emoji: '??', hint: 'Deep and atmospheric' }
  return { label: 'Late Night', emoji: '??', hint: 'Liminal and introspective' }
}

function applyTimeNudge(energy, valence) {
  const h = new Date().getHours()
  if (h >= 5  && h < 9)  return { energy: energy * 0.85, valence: Math.min(valence + 0.1, 1) }
  if (h >= 17 && h < 20) return { energy: energy * 0.9,  valence: Math.min(valence + 0.05, 1) }
  if (h >= 20 && h < 23) return { energy: energy * 0.8,  valence: valence * 0.9 }
  if (h >= 23 || h < 5)  return { energy: energy * 0.65, valence: valence * 0.75 }
  return { energy, valence }
}

function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'forYou', label: 'For You', icon: Sparkles },
    { id: 'browse', label: 'Browse',  icon: Radio },
  ]
  return (
    <div className="flex gap-1 p-1 bg-white/3 border border-white/8 rounded-xl w-fit mb-8">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === id
              ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function TagPill({ label, color }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ borderColor: `${color}40`, color, background: `${color}12` }}
    >
      {label}
    </span>
  )
}

function SongRow({ song, index, liked, onLike }) {
  const title  = song.name  || song.title
  const artist = song.artists?.[0]?.name || song.artist
  const image  = song.album?.images?.[0]?.url || song.album_art
  const url    = song.external_urls?.spotify || song.spotify_url
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0 group"
    >
      <span className="text-xs text-gray-600 w-5 text-center shrink-0">{index + 1}</span>
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5">
        {image
          ? <img src={image} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-gray-600" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{artist}</p>
      </div>
      {song._tags && (
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {song._tags.mood && <TagPill label={song._tags.mood} color="#a78bfa" />}
          {song._tags.era  && <TagPill label={song._tags.era}  color="#60a5fa" />}
        </div>
      )}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onLike(song.id || title)}
          className={`p-1.5 rounded-lg transition-all ${liked ? 'text-brand-pink' : 'text-gray-600 hover:text-pink-400'}`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-brand-pink' : ''}`} />
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-gray-600 hover:text-green-400 transition-all opacity-0 group-hover:opacity-100">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  )
}

function PlaylistCard({ playlist, index, liked, onLike, spotifyConnected }) {
  const [expanded, setExpanded]           = useState(false)
  const [tracks, setTracks]               = useState([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const fetchedRef = useRef(false)

  const fetchTracks = useCallback(async () => {
    if (fetchedRef.current || !spotifyConnected) return
    fetchedRef.current = true
    setLoadingTracks(true)
    try {
      const results = [], seen = new Set()
      for (const query of playlist.seed_queries.slice(0, 2)) {
        try {
          const res   = await spotifyAPI.searchTracks(query, 8)
          const items = res.data?.tracks?.items || res.data || []
          for (const t of items) {
            const id = t.id || t.name
            if (!seen.has(id)) {
              seen.add(id)
              const year = t.album?.release_date ? parseInt(t.album.release_date.slice(0, 4)) : null
              const era  = year ? (year < 1970 ? '60s' : year < 1980 ? '70s' : year < 1990 ? '80s' : year < 2000 ? '90s' : year < 2010 ? '2000s' : year < 2020 ? '2010s' : '2020s') : '2010s'
              results.push({ ...t, _tags: { genre: playlist.seed_genres[0] || '', mood: playlist.mood_tags[0] || '', era } })
            }
            if (results.length >= 12) break
          }
        } catch { /* skip */ }
        if (results.length >= 12) break
      }
      setTracks(results.slice(0, 12))
    } catch { toast.error('Could not load tracks') }
    finally { setLoadingTracks(false) }
  }, [playlist, spotifyConnected])

  const handleExpand = () => { setExpanded((v) => !v); if (!expanded) fetchTracks() }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl border border-white/8 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${playlist.color}10, rgba(255,255,255,0.02))` }}
    >
      <div className="p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {playlist.mood_tags.slice(0, 3).map((t) => <TagPill key={t} label={t} color={playlist.color} />)}
          {playlist.era_tags.slice(0, 2).map((t)  => <TagPill key={t} label={t} color="#60a5fa" />)}
        </div>
        <h3 className="text-lg font-bold text-white leading-snug mb-2">{playlist.title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed italic mb-4">"{playlist.description}"</p>
        <div className="flex items-start gap-2.5 p-3 rounded-xl mb-4"
          style={{ background: `${playlist.color}10`, border: `1px solid ${playlist.color}25` }}>
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: playlist.color }} />
          <p className="text-xs leading-relaxed" style={{ color: `${playlist.color}cc` }}>{playlist.why_it_fits}</p>
        </div>
        {playlist.harmonic_mood_vector?.name && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-white/3 border border-white/6 flex items-center gap-2">
            <span className="text-xs text-gray-500">Mood Vector:</span>
            <span className="text-xs font-medium text-indigo-300">{playlist.harmonic_mood_vector.name}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {playlist.aesthetic_tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-md bg-white/4 text-gray-500 border border-white/6">{t}</span>
          ))}
        </div>
        <button onClick={handleExpand} className="flex items-center gap-2 text-sm font-medium transition-all" style={{ color: playlist.color }}>
          {expanded ? 'Hide tracks' : spotifyConnected ? 'Load tracks' : 'View seeds'}
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/6">
            <div className="px-5 py-4">
              {loadingTracks && (
                <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Finding tracks…
                </div>
              )}
              {!loadingTracks && tracks.length > 0 && tracks.map((t, i) => (
                <SongRow key={t.id || i} song={t} index={i} liked={liked.has(t.id || t.name)} onLike={onLike} />
              ))}
              {!loadingTracks && tracks.length === 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Seed artists for this playlist:</p>
                  <div className="flex flex-wrap gap-2">
                    {playlist.seed_artists.map((a) => (
                      <a key={a} href={`https://open.spotify.com/search/${encodeURIComponent(a)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-sm text-gray-300 transition-all">
                        <Music2 className="w-3 h-3" /> {a} <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AlbumCard({ item, index, onLike, liked }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative glass-hover rounded-2xl overflow-hidden cursor-pointer">
      <div className="relative aspect-square overflow-hidden bg-surface-3">
        {item.image
          ? <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-10 h-10 text-slate-600" /></div>
        }
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
        <button className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-glow-sm">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </button>
      </div>
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{item.artist}</p>
        </div>
        <button onClick={() => onLike(item)}
          className={`shrink-0 p-1.5 rounded-lg transition-all ${liked ? 'text-brand-pink' : 'text-slate-600 hover:text-slate-300'}`}>
          <Heart className={`w-4 h-4 ${liked ? 'fill-brand-pink' : ''}`} />
        </button>
      </div>
    </motion.div>
  )
}

function ArtistCard({ artist, index }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="group glass-hover rounded-2xl p-4 flex items-center gap-3 cursor-pointer">
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-surface-3">
        {artist.image
          ? <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-brand-purple">{artist.name[0]}</div>
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate group-hover:text-brand-purple transition-colors">{artist.name}</p>
        <p className="text-xs text-slate-500 truncate">{artist.genres?.[0] || 'Artist'}</p>
      </div>
    </motion.div>
  )
}
function ForYouTab({ spotifyConnected, lastfmConnected }) {
  const [playlists, setPlaylists]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [generated, setGenerated]     = useState(false)
  const [seed, setSeed]               = useState(0)
  const [liked, setLiked]             = useState(new Set())
  const [serendipity, setSerendipity] = useState(false)
  const timeCtx     = getTimeContext()
  const isConnected = spotifyConnected || lastfmConnected

  // Use central profile - no direct Spotify/LastFM calls
  const { profile } = useMusicProfile({ autoFetch: false })

  const generate = useCallback(async (s = 0, sMode = false) => {
    setLoading(true)
    try {
      let genres = [], energy = 0.5, valence = 0.5
      if (profile) {
        genres  = profile.genres || []
        const af = profile.audioFeatures || {}
        energy  = af.energy  ?? 0.5
        valence = af.valence ?? 0.5
      }
      const nudged = applyTimeNudge(energy, valence)
      energy = nudged.energy; valence = nudged.valence
      const res = await discoverAPI.playlists({ genres, energy, valence }, { n: 6, seed: s, serendipity: sMode })
      setPlaylists(res.data || [])
      setGenerated(true)
    } catch { toast.error('Could not generate playlists') }
    finally { setLoading(false) }
  }, [profile])

  const handleRegenerate = () => { const next = seed + 1; setSeed(next); generate(next, serendipity) }
  const toggleLike = (id) => setLiked((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  if (!isConnected) return (
    <div className="max-w-lg">
      <p className="text-gray-400 text-sm mb-4">Connect a music source to generate personalized playlists.</p>
      <MusicSourceCard />
    </div>
  )

  if (!generated && !loading) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <motion.div animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-purple/25 to-pink-500/25 border border-brand-purple/20 flex items-center justify-center mb-6">
        <Wand2 className="w-9 h-9 text-brand-purple" />
      </motion.div>
      <h2 className="text-xl font-bold text-white mb-2">Generate Your Playlists</h2>
      <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
        We will analyze your music taste and craft personalized playlists with poetic descriptions and curated tracks.
      </p>
      <motion.button onClick={() => generate(0, serendipity)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-purple to-pink-500 text-white font-semibold shadow-lg shadow-brand-purple/30">
        <Sparkles className="w-4 h-4" /> Generate My Playlists
      </motion.button>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 rounded-full border-2 border-brand-purple/30 border-t-brand-purple" />
      <p className="text-gray-400 text-sm animate-pulse">
        {serendipity ? 'Venturing beyond your comfort zone...' : 'Crafting your playlists...'}
      </p>
    </div>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeCtx.label}</span>
          <span className="text-gray-500 italic">{timeCtx.hint}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSerendipity((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              serendipity ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-white/4 border-white/8 text-gray-500 hover:text-gray-300'
            }`}>
            <Shuffle className="w-3.5 h-3.5" />
            Serendipity {serendipity ? 'ON' : 'OFF'}
          </button>
          <button onClick={handleRegenerate} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>
      {serendipity && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <Shuffle className="w-3.5 h-3.5 shrink-0" />
          Serendipity mode - these playlists explore the outer edges of your taste space.
        </motion.div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {playlists.map((pl, i) => (
          <PlaylistCard key={pl.id} playlist={pl} index={i} liked={liked} onLike={toggleLike} spotifyConnected={spotifyConnected} />
        ))}
      </div>
    </div>
  )
}

function BrowseTab({ spotifyConnected, lastfmConnected }) {
  const [query, setQuery]   = useState('')
  const [liked, setLiked]   = useState(new Set())
  const debouncedQuery      = useDebounce(query, 400)
  const isConnected         = spotifyConnected || lastfmConnected

  // Use central profile - no direct Spotify/LastFM calls
  const { profile, loading } = useMusicProfile({ autoFetch: true })

  const rawTracks  = profile?.topTracks  || []
  const rawArtists = profile?.topArtists || []

  const tracks = rawTracks.map((t) => ({
    id:     t.id,
    title:  t.name || t.title,
    artist: t.artists?.[0]?.name || t.artist,
    image:  t.album?.images?.[0]?.url || t.album_art,
    url:    t.external_urls?.spotify || t.spotify_url,
  }))
  const artists = rawArtists.map((a) => ({
    id:     a.id,
    name:   a.name,
    image:  a.images?.[0]?.url || a.image,
    genres: a.genres,
    url:    a.external_urls?.spotify,
  }))

  const q = debouncedQuery.toLowerCase()
  const filteredTracks  = q ? tracks.filter((t)  => t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q)) : tracks
  const filteredArtists = q ? artists.filter((a) => a.name?.toLowerCase().includes(q)) : artists

  const toggleLike = (item) => setLiked((prev) => {
    const next = new Set(prev)
    if (next.has(item.id)) { next.delete(item.id); toast('Removed') }
    else { next.add(item.id); toast.success('Added to likes') }
    return next
  })

  if (!isConnected) return (
    <div className="max-w-lg">
      <p className="text-gray-400 text-sm mb-4">Connect a music source to browse your tracks.</p>
      <MusicSourceCard />
    </div>
  )

  return (
    <div>
      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Filter tracks and artists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass border-white/8 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 transition-all"
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />}
      </div>
      <div className="space-y-10">
        {filteredTracks.length > 0 && (
          <section>
            <p className="section-label mb-4">Top Tracks</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredTracks.map((t, i) => <AlbumCard key={t.id || i} item={t} index={i} onLike={toggleLike} liked={liked.has(t.id)} />)}
            </div>
          </section>
        )}
        {filteredArtists.length > 0 && (
          <section>
            <p className="section-label mb-4">Top Artists</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredArtists.map((a, i) => <ArtistCard key={a.id || i} artist={a} index={i} />)}
            </div>
          </section>
        )}
        {filteredTracks.length === 0 && filteredArtists.length === 0 && debouncedQuery && (
          <div className="text-center py-16 text-slate-500"><p>No results for "{debouncedQuery}"</p></div>
        )}
      </div>
    </div>
  )
}

export default function Discover() {
  const [activeTab, setActiveTab] = useState('forYou')
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected  = useStore((s) => s.lastfmConnected)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-black text-white">Discover</h1>
        <p className="text-slate-400 text-sm mt-1">Personalized playlists and your top music, shaped by your taste.</p>
      </motion.div>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'forYou' && <ForYouTab spotifyConnected={spotifyConnected} lastfmConnected={lastfmConnected} />}
      {activeTab === 'browse' && <BrowseTab spotifyConnected={spotifyConnected} lastfmConnected={lastfmConnected} />}
    </div>
  )
}
