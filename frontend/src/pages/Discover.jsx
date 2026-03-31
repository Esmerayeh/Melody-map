import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
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
  if (h >= 5  && h < 9)  return { label: 'Early Morning', hint: 'Soft, slow, and awakening' }
  if (h >= 9  && h < 12) return { label: 'Morning',       hint: 'Bright and focused' }
  if (h >= 12 && h < 17) return { label: 'Afternoon',     hint: 'Warm and flowing' }
  if (h >= 17 && h < 20) return { label: 'Evening',       hint: 'Golden and reflective' }
  if (h >= 20 && h < 23) return { label: 'Night',         hint: 'Deep and atmospheric' }
  return { label: 'Late Night', hint: 'Liminal and introspective' }
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
    { id: 'forYou', label: 'Found for you', icon: Sparkles },
    { id: 'browse', label: 'Wander',  icon: Radio },
  ]
  return (
    <div className="flex gap-1 p-1 rounded-2xl w-fit mb-8 noire-panel-soft">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === id ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30' : 'text-slate-500 hover:text-slate-300'
          }`}>
          <Icon className="w-3.5 h-3.5" />{label}
        </button>
      ))}
    </div>
  )
}

function TagPill({ label, color }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ borderColor: `${color}40`, color, background: `${color}12` }}>
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
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0 group">
      <span className="text-xs text-gray-600 w-5 text-center shrink-0">{index + 1}</span>
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5">
        {image ? <img src={image} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-gray-600" /></div>}
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
        <button onClick={() => onLike(song.id || title)}
          className={`p-1.5 rounded-lg transition-all ${liked ? 'text-brand-pink' : 'text-gray-600 hover:text-pink-400'}`}>
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
              const era  = year ? (year < 1980 ? '70s' : year < 1990 ? '80s' : year < 2000 ? '90s' : year < 2010 ? '2000s' : year < 2020 ? '2010s' : '2020s') : '2010s'
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: `0 12px 40px ${playlist.color}20` }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl border border-white/8 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${playlist.color}10, rgba(255,255,255,0.02))` }}>
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
          <span className="text-xs text-gray-500">Mood current:</span>
            <span className="text-xs font-medium text-indigo-300">{playlist.harmonic_mood_vector.name}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {playlist.aesthetic_tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-md bg-white/4 text-gray-500 border border-white/6">{t}</span>
          ))}
        </div>
        <button onClick={handleExpand} className="flex items-center gap-2 text-sm font-medium transition-all" style={{ color: playlist.color }}>
          {expanded ? 'Let it fade' : spotifyConnected ? 'Bring in the songs' : 'Follow the seeds'}
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
      whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(124,111,255,0.18)' }}
      className="group relative glass-hover rounded-2xl overflow-hidden cursor-pointer">
      <div className="relative aspect-square overflow-hidden bg-surface-3">
        {item.image
          ? <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-10 h-10 text-slate-600" /></div>
        }
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
        <button className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200">
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
      whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(124,111,255,0.15)' }}
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
      <p className="text-gray-400 text-sm mb-4">Connect a music source and something found its way to you.</p>
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
      <h2 className="text-xl font-bold text-white mb-2">Shape a new sequence</h2>
      <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
        Tell Melody Map the mood you want to live in, and it will shape a sequence around your listening world.
      </p>
      <motion.button onClick={() => generate(0, serendipity)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-purple to-pink-500 text-white font-semibold shadow-lg shadow-brand-purple/30">
        <Sparkles className="w-4 h-4" /> Shape the sequence
      </motion.button>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 rounded-full border-2 border-brand-purple/30 border-t-brand-purple" />
      <p className="text-gray-400 text-sm animate-pulse">
        {serendipity ? 'drifting past your usual orbit...' : 'shaping a sequence for this mood...'}
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
            <RefreshCw className="w-3.5 h-3.5" /> Shape again
          </button>
        </div>
      </div>
      {serendipity && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <Shuffle className="w-3.5 h-3.5 shrink-0" />
          Serendipity mode — these sequences drift toward the farther edge of your taste.
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

function BrowseSkeleton() {
  return (
    <div>
      <div className="skeleton h-10 w-full max-w-lg rounded-xl mb-8" />
      <div className="space-y-10">
        <section>
          <div className="skeleton h-3 w-20 rounded mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="skeleton aspect-square w-full" style={{ borderRadius: '12px 12px 0 0' }} />
                <div className="p-3 space-y-2 bg-white/2 border border-white/6 border-t-0" style={{ borderRadius: '0 0 12px 12px' }}>
                  <div className="skeleton h-3.5 rounded" style={{ width: '75%' }} />
                  <div className="skeleton h-3 rounded" style={{ width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="skeleton h-3 w-20 rounded mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 flex items-center gap-3 border border-white/6 bg-white/2">
                <div className="skeleton w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 rounded" style={{ width: '70%' }} />
                  <div className="skeleton h-3 rounded" style={{ width: '45%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function BrowseTab({ spotifyConnected, lastfmConnected, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery)
  const [liked, setLiked] = useState(new Set())
  const debouncedQuery    = useDebounce(query, 400)
  const isConnected       = spotifyConnected || lastfmConnected
  const { profile, loading } = useMusicProfile({ autoFetch: true })

  const tracks = (profile?.topTracks || []).map((t) => ({
    id:     t.id,
    title:  t.name || t.title,
    artist: t.artists?.[0]?.name || t.artist,
    image:  t.album?.images?.[0]?.url || t.album_art,
    url:    t.external_urls?.spotify || t.spotify_url,
  }))
  const artists = (profile?.topArtists || []).map((a) => ({
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
    if (next.has(item.id)) { next.delete(item.id); toast('Drift released') }
    else { next.add(item.id); toast.success('Held close') }
    return next
  })

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery)
    }
  }, [initialQuery, query])

  if (!isConnected) return (
    <div className="max-w-lg">
      <p className="text-gray-400 text-sm mb-4">Connect a music source and the shelves begin to glow.</p>
      <MusicSourceCard />
    </div>
  )

  if (loading) return <BrowseSkeleton />

  return (
    <div>
      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input type="text" placeholder="Search tracks, artists, moods..." value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass border-white/8 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 transition-all" />
      </div>
      <div className="space-y-10">
        {filteredTracks.length > 0 && (
          <section>
            <p className="section-label mb-4">Songs closest to hand</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredTracks.map((t, i) => <AlbumCard key={t.id || i} item={t} index={i} onLike={toggleLike} liked={liked.has(t.id)} />)}
            </div>
          </section>
        )}
        {filteredArtists.length > 0 && (
          <section>
            <p className="section-label mb-4">The voices you orbit</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredArtists.map((a, i) => <ArtistCard key={a.id || i} artist={a} index={i} />)}
            </div>
          </section>
        )}
        {filteredTracks.length === 0 && filteredArtists.length === 0 && debouncedQuery && (
          <div className="text-center py-16 text-slate-500"><p>nothing surfaced for "{debouncedQuery}" just yet</p></div>
        )}
      </div>
    </div>
  )
}

export default function Discover() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('forYou')
  const spotifyConnected = useStore((s) => s.spotifyConnected)
  const lastfmConnected  = useStore((s) => s.lastfmConnected)
  const seededQuery = searchParams.get('q') || ''

  useEffect(() => {
    if (seededQuery) {
      setActiveTab('browse')
    }
  }, [seededQuery])

  return (
    <div className="cosmic-page">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="page-header-kicker mb-2">The Signal Stream</p>
        <h1 className="page-header-title">Drift</h1>
        <p className="page-header-copy mt-3">Signals, sequences, and quiet detours shaped by your listening gravity.</p>
      </motion.div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Link
          to="/galaxy?mode=song"
          className="rounded-[24px] p-4 glass-hover"
          style={{ background: 'rgba(124,111,255,0.08)', border: '1px solid rgba(124,111,255,0.16)' }}
        >
          <p className="section-label mb-2">See it in space</p>
          <p className="text-sm font-semibold text-white">Open these sequences inside the galaxy</p>
          <p className="mt-1 text-xs text-slate-500">Move from songs and shelves into a denser field of relationships.</p>
        </Link>
        <Link
          to="/auralith?mode=playlist&prompt=shape%20a%20sequence%20from%20what%20just%20drifted%20toward%20me"
          className="rounded-[24px] p-4 glass-hover"
          style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.16)' }}
        >
          <p className="section-label mb-2">Ask Auralith to continue</p>
          <p className="text-sm font-semibold text-white">Turn a drift into a sequence</p>
          <p className="mt-1 text-xs text-slate-500">Carry what surfaced here into a more deliberate listening shape.</p>
        </Link>
        <Link
          to="/identity"
          className="rounded-[24px] p-4 glass-hover"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.16)' }}
        >
          <p className="section-label mb-2">Inner reading</p>
          <p className="text-sm font-semibold text-white">See why these signals fit</p>
          <p className="mt-1 text-xs text-slate-500">Hold your steadier listening self nearby while you wander.</p>
        </Link>
      </div>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'forYou' && <ForYouTab spotifyConnected={spotifyConnected} lastfmConnected={lastfmConnected} />}
      {activeTab === 'browse' && <BrowseTab spotifyConnected={spotifyConnected} lastfmConnected={lastfmConnected} initialQuery={seededQuery} />}
    </div>
  )
}
