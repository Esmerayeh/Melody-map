import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Heart, Users, Music, RefreshCw, Star, Zap, ChevronRight, AlertCircle, Sparkles, ExternalLink, Link2 } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { soulmateAPI, aestheticAPI, publicProfileAPI } from '../services/api'
import { musicService } from '../services/musicService'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import MusicSourceCard from '../components/MusicSourceCard'
import SoulmateMap from '../components/SoulmateMap'
import VibeEmitter from '../components/VibeEmitter'
import CompatibilityCard from '../components/CompatibilityCard'
import { computeAdvancedCompatibility } from '../utils/personalityEngine'

// ── Shared Aesthetic Board ─────────────────────────────────────────────────────
function SharedAestheticBoard({ comparison }) {
  const [shared, setShared]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)

  const load = useCallback(async () => {
    if (shared || loading) return
    setLoading(true)
    try {
      const res = await aestheticAPI.shared({
        tags_a:         comparison.tags_a || [],
        tags_b:         comparison.tags_b || [],
        shared_genres:  comparison.shared_genres || [],
        shared_artists: comparison.shared_artists || [],
      })
      setShared(res.data)
    } catch {
      toast.error('Could not load shared aesthetic')
    } finally {
      setLoading(false)
    }
  }, [comparison, shared, loading])

  const handleOpen = () => {
    setOpen(true)
    load()
  }

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 overflow-hidden">
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-purple-500/10 transition-all"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-sm">Shared Aesthetic Board</span>
          <span className="text-xs text-gray-500">· your combined vibe</span>
        </div>
        <span className="text-xs text-purple-400">{open ? 'Hide' : 'Reveal'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {loading && (
            <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-sm">
              <VibeEmitter bpm={120} size={40} label="Generating shared aesthetic..." />
            </div>
          )}

          {shared && !loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Shared name */}
              <div className="text-center py-4">
                <p className="text-xs text-purple-400 uppercase tracking-widest mb-1">Your Shared Aesthetic</p>
                <h3 className="text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent">
                  {shared.shared_aesthetic_name}
                </h3>
                <p className="text-gray-400 text-sm mt-2 italic">"{shared.shared_vibe}"</p>
              </div>

              {/* Shared tags */}
              <div className="flex flex-wrap gap-2">
                {(shared.shared_tags || []).map((tag, i) => (
                  <motion.a
                    key={i}
                    href={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(tag)}`}
                    target="_blank" rel="noopener noreferrer"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="px-3 py-1 rounded-full text-xs bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all flex items-center gap-1"
                  >
                    {tag} <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                  </motion.a>
                ))}
              </div>

              {/* Shared images grid */}
              {shared.images?.length > 0 && (
                <div className="columns-2 md:columns-3 gap-2 space-y-2">
                  {shared.images.slice(0, 9).map((img, i) => (
                    <motion.a
                      key={img.id || i}
                      href={img.unsplash_url}
                      target="_blank" rel="noopener noreferrer"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                      whileHover={{ scale: 1.03 }}
                      className="break-inside-avoid mb-2 block rounded-xl overflow-hidden group relative"
                    >
                      <img
                        src={img.thumb || img.url}
                        alt={img.description}
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <p className="absolute bottom-1 left-2 right-2 text-xs text-white/80 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        📷 {img.photographer}
                      </p>
                    </motion.a>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r    = 54
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#a78bfa' : score >= 50 ? '#60a5fa' : '#f472b6'

  return (
    <motion.div className="relative w-36 h-36 flex items-center justify-center"
      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-full blur-xl pointer-events-none"
        style={{ background: `${color}20` }} />
      <svg className="absolute inset-0 -rotate-90" width="144" height="144">
        <defs>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" filter="url(#ringGlow)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
      </svg>
      <div className="text-center z-10">
        <motion.div className="text-4xl font-black" style={{ color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {score}
        </motion.div>
        <div className="text-xs text-gray-500 mt-0.5">/ 100</div>
      </div>
    </motion.div>
  )
}

// ── Breakdown bar ──────────────────────────────────────────────────────────────
function BreakdownBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  )
}

// ── Match card ─────────────────────────────────────────────────────────────────
function MatchCard({ match, onSelect, isSelected }) {
  const score = match.match_score
  const accentColor = score >= 75 ? '#a78bfa' : score >= 50 ? '#60a5fa' : '#f472b6'

  return (
    <motion.button onClick={() => onSelect(match)}
      whileHover={{ x: 3, scale: 1.01 }} whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left relative overflow-hidden"
      style={{
        background: isSelected ? `${accentColor}12` : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isSelected ? accentColor + '50' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isSelected ? `0 0 24px ${accentColor}15` : 'none',
      }}>
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 20% 50%, ${accentColor}08 0%, transparent 70%)` }} />
      )}
      {/* Avatar planet */}
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-lg font-black text-white relative z-10"
        style={{ background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`, boxShadow: `0 0 16px ${accentColor}30` }}>
        {match.username?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <p className="font-semibold text-white">{match.username}</p>
        {match.shared_artists?.length > 0 && (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            Shares: {match.shared_artists.slice(0, 2).join(', ')}
          </p>
        )}
        {match.shared_genres?.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {match.shared_genres.slice(0, 3).map((g) => (
              <span key={g} className="text-xs px-1.5 py-0.5 rounded-md text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)' }}>{g}</span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right relative z-10">
        <div className="text-2xl font-black" style={{ color: accentColor }}>{score}</div>
        <div className="text-xs text-gray-600">match</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 shrink-0 relative z-10" />
    </motion.button>
  )
}

// ── Shared pill list ───────────────────────────────────────────────────────────
function PillList({ items, color }) {
  if (!items?.length) return <p className="text-gray-600 text-xs">None yet</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item}
          className="text-xs px-2.5 py-1 rounded-full border font-medium"
          style={{ borderColor: `${color}40`, color, background: `${color}10` }}>
          {item}
        </span>
      ))}
    </div>
  )
}

// ── Animated SVG skeleton for Soulmate empty state ────────────────────────────
function SoulmateSkeleton() {
  return (
    <div className="space-y-3 pointer-events-none select-none" aria-hidden="true">
      <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Preview</p>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-4 p-4 rounded-xl border border-white/6"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="skeleton w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 rounded" style={{ width: '45%' }} />
            <div className="skeleton h-2.5 rounded" style={{ width: '65%' }} />
          </div>
          <div className="skeleton h-8 w-10 rounded-lg shrink-0" />
        </motion.div>
      ))}
      {/* Score ring preview */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="mt-4 p-6 rounded-2xl border border-white/6 flex items-center gap-6"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="skeleton w-36 h-36 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-4 rounded" style={{ width: '55%' }} />
          <div className="skeleton h-3 rounded" style={{ width: '80%' }} />
          {['Artists', 'Genres', 'Audio', 'Tracks'].map((l) => (
            <div key={l} className="flex items-center gap-3">
              <div className="skeleton h-2 rounded-full" style={{ width: 48 }} />
              <div className="flex-1 skeleton h-1.5 rounded-full" />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ── Invite link system ────────────────────────────────────────────────────────
function InviteLink({ publicSlug, userId, username }) {
  const [copied, setCopied] = useState(false)
  const [pasteLink, setPasteLink] = useState('')
  const preferredIdentifier = (publicSlug || userId || username || '').trim()
  const link = preferredIdentifier
    ? `${window.location.origin}/soulmate/${encodeURIComponent(preferredIdentifier)}`
    : ''

  const copy = () => {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Extract user param from a pasted link
  const extractUser = (url) => {
    try {
      const u = new URL(url)
      const pathMatch = u.pathname.match(/\/soulmate\/([^/?#]+)/)
      return pathMatch?.[1] || u.searchParams.get('user')
    } catch {
      return null
    }
  }

  const pastedUser = extractUser(pasteLink)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl relative overflow-hidden space-y-4"
      style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.05))', border: '1px solid rgba(168,85,247,0.2)' }}>
      {/* Your link */}
      <div>
        <p className="text-xs text-purple-400 uppercase tracking-[0.2em] mb-2">Share your profile</p>
        <p className="text-sm text-gray-300 mb-3">Send this link to a friend — they can compare their taste with yours.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-xl text-xs font-mono text-gray-400 truncate"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            {link || 'Sync your profile to generate a shareable soulmate link'}
          </div>
          <motion.button onClick={copy} whileHover={link ? { scale: 1.05 } : undefined} whileTap={link ? { scale: 0.95 } : undefined}
            disabled={!link}
            className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all"
            style={{ background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(168,85,247,0.15)',
                     color: copied ? '#34d399' : '#c084fc',
                     border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(168,85,247,0.3)'}`,
                     opacity: link ? 1 : 0.45,
                     cursor: link ? 'pointer' : 'not-allowed' }}>
            {copied ? 'Copied' : 'Copy'}
          </motion.button>
        </div>
      </div>

      {/* Paste a friend's link */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-[0.15em] mb-2">Or paste a friend's link</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={pasteLink}
            onChange={(e) => setPasteLink(e.target.value)}
            placeholder="https://melodymap.site/soulmate/your-public-slug"
            className="flex-1 px-3 py-2 rounded-xl text-xs font-mono text-gray-300 bg-white/4 border border-white/10 outline-none focus:border-purple-500/50 placeholder-gray-600 transition-colors"
          />
          {pastedUser && (
            <a
              href={`/soulmate/${encodeURIComponent(pastedUser)}`}
              className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all"
              style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
            >
              Compare →
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── URL-based comparison — delegates to advanced engine ───────────────────────
function computeLocalSimilarity(profileA, profileB) {
  const result = computeAdvancedCompatibility(profileA, profileB)
  if (!result) return null
  return {
    match_score:    result.score,
    shared_artists: result.sharedArtists,
    shared_genres:  result.sharedGenres,
    breakdown:      result.breakdown,
    _advanced:      result,
  }
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MusicSoulmate() {
  const { identifier: routeIdentifier } = useParams()
  const musicProvider = useStore((s) => s.musicProvider)
  const vibeFeatures  = useStore((s) => s.vibeFeatures)
  const myUsername    = useStore((s) => s.spotifyProfile?.name || s.lastfmUsername || 'You')
  const myUserId      = useStore((s) => s.spotifyProfile?.id || s.lastfmUsername || '')
  const [myPublicSlug, setMyPublicSlug] = useState('')
  const [syncing,    setSyncing]    = useState(false)
  const [synced,     setSynced]     = useState(false)
  const [matches,    setMatches]    = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [comparison, setComparison] = useState(null)
  const [loadingCmp, setLoadingCmp] = useState(false)
  // Invite link comparison (URL-based)
  const [inviteComparison, setInviteComparison] = useState(null)

  const { profile, loading: profileLoading } = useMusicProfile({ autoFetch: true })

  useEffect(() => {
    soulmateAPI.getMyProfile()
      .then(({ data }) => setMyPublicSlug(data?.public_slug || ''))
      .catch(() => setMyPublicSlug(''))
  }, [])

  // Handle ?user= invite link — wait for profile to load before fetching
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteUser = routeIdentifier || params.get('user')
    // Don't run until profile has finished loading (or we know there's no profile)
    if (!inviteUser) return
    if (profileLoading) return  // wait for auth + profile to settle

    let cancelled = false
    setInviteComparison({ inviteUser, loading: true, result: null, error: null })

    publicProfileAPI.get(inviteUser)
      .then(({ data: otherProfile }) => {
        if (cancelled) return
        // Normalise the public profile to match local profile shape
        const normalised = {
          topArtists:    otherProfile.topArtists    || [],
          topTracks:     otherProfile.topTracks     || [],
          genres:        otherProfile.genres        || [],
          audioFeatures: otherProfile.audioFeatures || {},
        }
        const result = computeAdvancedCompatibility(profile, normalised)
        setInviteComparison({
          inviteUser,
          otherUsername: otherProfile.username || inviteUser,
          loading: false,
          result: result ? { ...result, _advanced: result } : null,
          error: null,
        })
      })
      .catch(() => {
        if (cancelled) return
        setInviteComparison({
          inviteUser,
          otherUsername: inviteUser,
          loading: false,
          result: null,
          error: `Could not load ${inviteUser}'s profile. They may need to sync first.`,
        })
      })

    return () => { cancelled = true }
  }, [profile, profileLoading, routeIdentifier])

  // ── Sync profile ─────────────────────────────────────────────────────────────
  const syncProfile = useCallback(async () => {
    if (!musicProvider) {
      toast.error('Connect a music source first')
      return
    }
    setSyncing(true)
    try {
      let topArtists, topTracks, genres, audioFeatures = {}, userProfile

      // Prefer central profile data — avoids redundant API calls
      if (profile?.topArtists?.length) {
        topArtists = profile.topArtists.map((a) => a.name)
        topTracks  = profile.topTracks.map((t) => t.title || t.name)
        genres     = profile.genres.slice(0, 50).map((g) => g.genre)
        const af   = profile.audioFeatures || {}
        audioFeatures = {
          energy: af.energy, valence: af.valence, danceability: af.danceability,
          acousticness: af.acousticness, instrumentalness: af.instrumentalness,
          speechiness: af.speechiness,
        }
        userProfile = profile.userProfile
      } else {
        // Fallback: fetch directly
        const [tracks, artists] = await Promise.all([
          musicService.getTopTracks({ limit: 50 }),
          musicService.getTopArtists({ limit: 50 }),
        ])
        const genreSet = new Set()
        artists.forEach((a) => a.genres?.forEach((g) => genreSet.add(g)))
        topArtists = artists.map((a) => a.name)
        topTracks  = tracks.map((t) => t.title || t.name)
        genres     = [...genreSet].slice(0, 50)

        if (musicProvider === 'spotify' && tracks.length) {
          try {
            const feats = await musicService.getAudioFeatures(tracks.map((t) => t.id))
            if (feats.length) {
              const keys = ['energy', 'valence', 'danceability', 'acousticness', 'instrumentalness', 'speechiness']
              const sums = {}
              keys.forEach((k) => { sums[k] = 0 })
              feats.forEach((f) => keys.forEach((k) => { sums[k] += f[k] || 0 }))
              keys.forEach((k) => { audioFeatures[k] = sums[k] / feats.length })
            }
          } catch { /* optional */ }
        }
        userProfile = await musicService.getProfile()
      }

      const { data } = await soulmateAPI.syncProfile({
        top_artists:    topArtists,
        top_tracks:     topTracks,
        genres,
        audio_features: audioFeatures,
        username:       userProfile?.name || userProfile?.username,
        avatar:         userProfile?.image,
      })

      setMyPublicSlug(data?.public_slug || '')
      setSynced(true)
      toast.success('Music profile synced!')
      loadMatches()
    } catch (err) {
      toast.error('Sync failed — try again')
    } finally {
      setSyncing(false)
    }
  }, [musicProvider, profile])

  // ── Load matches ──────────────────────────────────────────────────────────────
  const loadMatches = useCallback(async () => {
    setLoadingMatches(true)
    try {
      const { data } = await soulmateAPI.getMatches()
      setMatches(data || [])
    } catch {
      setMatches([])
    } finally {
      setLoadingMatches(false)
    }
  }, [])

  useEffect(() => {
    if (synced) loadMatches()
  }, [synced, loadMatches])

  // ── Select a match → load comparison ─────────────────────────────────────────
  const handleSelect = useCallback(async (match) => {
    setSelected(match)
    setComparison(null)
    setLoadingCmp(true)
    try {
      const { data } = await soulmateAPI.compare(match.user_id)
      setComparison(data)
    } catch {
      toast.error('Could not load comparison')
    } finally {
      setLoadingCmp(false)
    }
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="mb-8">
        <p className="text-xs text-gray-600 uppercase tracking-[0.25em] mb-1">Cosmic connection</p>
        <h1 className="text-4xl font-black text-white">Music Soulmate</h1>
        <p className="text-gray-400 text-sm mt-1">Find users who share your sonic universe</p>
      </motion.div>

      {/* Step 1 — connect source */}
      {!musicProvider && (
        <div className="max-w-lg">
          <p className="text-gray-400 text-sm mb-4">Connect a music source to find your soulmates.</p>
          <MusicSourceCard />
        </div>
      )}

      {/* Invite link — visible as soon as provider is connected */}
      {musicProvider && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6 max-w-xl">
          <InviteLink publicSlug={myPublicSlug} userId={myUserId} username={myUsername} />
        </motion.div>
      )}

      {/* Invite comparison result */}
      {inviteComparison && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-purple-400 uppercase tracking-widest">Invite link detected</p>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            Comparing with: <span className="text-white font-semibold">{inviteComparison.otherUsername || inviteComparison.inviteUser}</span>
          </p>
          {inviteComparison.loading && (
            <div className="flex items-center gap-3 py-6">
              <VibeEmitter bpm={120} size={48} label="Fetching their profile…" />
            </div>
          )}
          {!inviteComparison.loading && inviteComparison.result?._advanced && (
            <>
              <CompatibilityCard
                result={inviteComparison.result._advanced}
                userAName={myUsername}
                userBName={inviteComparison.otherUsername || inviteComparison.inviteUser}
              />
              {inviteComparison.result.note && (
                <p className="text-xs text-amber-400/80 mt-3">{inviteComparison.result.note}</p>
              )}
            </>
          )}
          {!inviteComparison.loading && !inviteComparison.result && (
            <p className="text-xs text-gray-500">
              {inviteComparison.error || 'Sync your profile first to compute compatibility.'}
            </p>
          )}
        </motion.div>
      )}

      {/* Step 2 — sync profile */}
      {musicProvider && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex items-center gap-4 p-5 rounded-2xl max-w-xl relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.05))', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(168,85,247,0.08) 0%, transparent 60%)' }} />
          <div className="flex-1 relative z-10">
            <p className="font-semibold text-sm text-white">{synced ? 'Profile synced' : 'Sync your music taste'}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {synced ? 'Your taste profile is up to date. Re-sync anytime.' : "We'll analyse your top artists, tracks, and genres."}
            </p>
          </div>
          <motion.button onClick={syncProfile} disabled={syncing} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 relative z-10 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #9333ea, #ec4899)', boxShadow: '0 0 24px rgba(147,51,234,0.3)' }}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : synced ? 'Re-sync' : 'Sync Now'}
          </motion.button>
        </motion.div>
      )}

      {/* Main content — two columns */}
      {synced && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — match list */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h2 className="font-semibold text-sm">Top Soulmates</h2>
              </div>
              <button onClick={loadMatches} disabled={loadingMatches}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-all">
                <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loadingMatches ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingMatches && (
              <div className="flex items-center justify-center py-8">
                <VibeEmitter bpm={vibeFeatures?.tempo ?? 120} size={56} label="Finding soulmates…" />
              </div>
            )}

            {!loadingMatches && matches.length === 0 && (
              <SoulmateSkeleton />
            )}

            {matches.map((m) => (
              <MatchCard key={m.user_id} match={m}
                onSelect={handleSelect}
                isSelected={selected?.user_id === m.user_id} />
            ))}

            {/* Demo hint when no real matches */}
            {!loadingMatches && matches.length === 0 && (
              <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80">
                    Soulmate matching requires multiple users to sync their profiles. Share Melody Map with friends to see matches here.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right — comparison panel */}
          <div className="lg:col-span-2">
            {!selected && (
              <div className="py-8">
                <SoulmateSkeleton />
                <p className="text-center text-xs text-gray-600 mt-4">Select a soulmate to see your shared music universe</p>
              </div>
            )}

            {selected && loadingCmp && (
              <div className="flex items-center justify-center py-20">
                <VibeEmitter bpm={vibeFeatures?.tempo ?? 120} size={72} label="Loading comparison…" />
              </div>
            )}

            {selected && comparison && !loadingCmp && (
              <div className="space-y-5">
                {/* Advanced compatibility card */}
                <CompatibilityCard
                  result={{
                    score:          comparison.match_score,
                    sharedGenres:   comparison.shared_genres  || [],
                    sharedArtists:  comparison.shared_artists || [],
                    breakdown: {
                      genres:         comparison.breakdown?.genres         ?? 0,
                      artists:        comparison.breakdown?.artists        ?? 0,
                      audio:          comparison.breakdown?.audio          ?? 0,
                      moodAlignment:  comparison.breakdown?.mood_alignment ?? comparison.breakdown?.moodAlignment ?? 0,
                      discoveryMatch: comparison.breakdown?.discovery_match ?? comparison.breakdown?.discoveryMatch ?? 0,
                      eraMatch:       comparison.breakdown?.era_match       ?? comparison.breakdown?.eraMatch       ?? null,
                    },
                  }}
                  userAName={myUsername}
                  userBName={comparison.user_b?.username || selected.username}
                />

                {/* Constellation map */}
                {comparison.graph?.nodes?.length > 0 && (
                  <div className="bg-[#050810] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">Shared Constellation</h3>
                        <p className="text-gray-500 text-xs mt-0.5">Drag nodes · scroll to zoom</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Shared</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> {myUsername}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" /> {comparison.user_b?.username}</span>
                      </div>
                    </div>
                    <SoulmateMap
                      graph={comparison.graph}
                      userAName={myUsername}
                      userBName={comparison.user_b?.username}
                      height={420}
                    />
                  </div>
                )}

                {/* Shared aesthetic board */}
                <SharedAestheticBoard comparison={comparison} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
