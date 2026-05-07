import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HeartHandshake, Link2, RefreshCw, Sparkles, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { soulmateAPI } from '../services/api'
import { musicService } from '../services/musicService'
import useStore from '../store/useStore'
import useMusicProfile from '../hooks/useMusicProfile'
import { useRouteReadiness } from '../hooks/useRouteReadiness'
import MusicSourceCard from '../components/MusicSourceCard'
import CompatibilityCard from '../components/CompatibilityCard'
import SoulmateMap from '../components/SoulmateMap'
import VibeEmitter from '../components/VibeEmitter'
import RouteStatusBanner from '../components/RouteStatusBanner'
import { normalizeListResponse, normalizeSoulmateResponse } from '../services/dataAdapters'
import useAuthStore from '../store/useAuthStore'

function parseSoulmateIdentifier(input) {
  const trimmed = String(input || '').trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/soulmate\/([^/?#]+)/i)
    return decodeURIComponent(pathMatch?.[1] || '').trim()
  } catch {
    return trimmed.replace(/^\/?soulmate\//i, '').trim()
  }
}

function MatchCard({ match, selected, onSelect }) {
  const score = match.overallCompatibility ?? match.match_score ?? 0
  return (
    <button
      onClick={() => onSelect(match)}
      className="w-full rounded-[24px] p-4 text-left transition-all"
      style={{
        background: selected ? 'rgba(143,117,255,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(143,117,255,0.34)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: selected ? '0 0 28px rgba(143,117,255,0.12)' : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{match.username}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{match.relationshipArchetype || 'shared orbit'}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-brand-purple">{score}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{match.compatibilityTier || 'aligned'}</p>
        </div>
      </div>
      {(match.sharedArtists || match.shared_artists || []).length > 0 && (
        <p className="mt-3 truncate text-xs text-slate-400">
          shared pull: {(match.sharedArtists || match.shared_artists || []).slice(0, 2).join(', ')}
        </p>
      )}
    </button>
  )
}

function InviteLink({ publicSlug }) {
  const [value, setValue] = useState('')
  const [copied, setCopied] = useState(false)
  const slug = String(publicSlug || '').trim()
  const link = slug ? `${window.location.origin}/soulmate/${encodeURIComponent(slug)}` : ''

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const pastedUser = parseSoulmateIdentifier(value)

  return (
    <div className="noire-action-card rounded-[28px] p-5">
      <p className="section-label mb-2">Share Your Orbit</p>
      <p className="mb-4 text-sm text-slate-400">Send your public link to someone you trust and let the overlap come into focus.</p>
      <div className="flex gap-2">
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-400">
          {link || 'your share link will appear after sync'}
        </div>
        <button onClick={handleCopy} disabled={!link} className="noire-chip px-4 py-3 text-xs text-white disabled:opacity-50">
          {copied ? 'held close' : 'copy link'}
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a soulmate link or public name"
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white outline-none placeholder:text-slate-600"
        />
        {pastedUser && (
          <Link to={`/soulmate/${encodeURIComponent(pastedUser)}`} className="noire-chip px-4 py-3 text-xs text-white">
            open orbit
          </Link>
        )}
      </div>
    </div>
  )
}

export default function MusicSoulmate() {
  const { identifier } = useParams()
  const { profile, loading: profileLoading, phase, readiness, tier } = useMusicProfile()
  const musicProvider = useStore((state) => state.musicProvider)
  const vibeFeatures = useStore((state) => state.vibeFeatures)
  const hasAppToken = useAuthStore((state) => Boolean(state.sessionToken))

  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)
  const [myPublicSlug, setMyPublicSlug] = useState('')
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [selected, setSelected] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [inviteComparison, setInviteComparison] = useState(null)
  const [networkState, setNetworkState] = useState(null)

  const myUsername = profile?.userProfile?.name || profile?.userProfile?.username || 'you'
  const normalizedIdentifier = useMemo(() => parseSoulmateIdentifier(identifier), [identifier])

  useEffect(() => {
    if (!musicProvider || !hasAppToken) return
    let cancelled = false
    soulmateAPI.getMyProfile()
      .then(({ data }) => {
        if (cancelled || !data) return
        setMyPublicSlug(data.public_slug || '')
        setSynced(Boolean(data.top_artists?.length || data.top_tracks?.length))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [hasAppToken, musicProvider])

  const syncProfile = useCallback(async () => {
    if (!musicProvider) {
      toast.error('connect a music source first')
      return
    }
    if (!hasAppToken) {
      toast.error('sign in to melody map to sync your orbit')
      return
    }
    setSyncing(true)
    try {
      let topArtists = profile?.topArtists || []
      let topTracks = profile?.topTracks || []
      let genres = profile?.genres || []
      let audioFeatures = profile?.audioFeatures || {}
      let userProfile = profile?.userProfile

      if (!topArtists.length || !topTracks.length) {
        const [tracks, artists] = await Promise.all([
          musicService.getTopTracks({ limit: 50 }),
          musicService.getTopArtists({ limit: 50 }),
        ])
        topArtists = artists
        topTracks = tracks
        genres = profile?.genres || []
        userProfile = await musicService.getProfile()
      }

      const dominantPersonality = (profile?.personality || [])[0]
      const personalityTraits = (profile?.personality || profile?.personalityTraits || []).slice(0, 8)
      const aestheticTags = profile?.aestheticTags || []
      const atmosphereLabels = [
        profile?.analyticsMetrics?.mood,
        ...aestheticTags.slice(0, 3),
        ...genres.slice(0, 3).map((genre) => genre.genre || genre),
      ].filter(Boolean)

      const payload = {
        top_artists: topArtists.slice(0, 50),
        top_tracks: topTracks.slice(0, 50),
        genres: genres.slice(0, 50),
        audio_features: audioFeatures,
        username: userProfile?.name || userProfile?.username,
        avatar: userProfile?.image,
        mbti_type: profile?.mbti?.type || null,
        mbti_profile: profile?.mbti || null,
        sonic_personality_title: profile?.mbti?.name || dominantPersonality?.label || null,
        personality_traits: personalityTraits,
        personality_meta: profile?.personalityMeta || {},
        archetype: dominantPersonality?.label || null,
        emotional_signature: profile?.analyticsMetrics?.mood || null,
        listening_style: profile?.mbti?.name || null,
        trait_scores: Object.fromEntries(personalityTraits.map((trait) => [trait.label || trait.id, trait.pct || trait.score || 0])),
        music_identity_summary: profile?.mbti?.desc || null,
        mood_tags: [profile?.analyticsMetrics?.mood, ...aestheticTags.slice(0, 5)].filter(Boolean),
        aesthetic_tags: aestheticTags.slice(0, 12),
        atmosphere_labels: atmosphereLabels.slice(0, 12),
        region_labels: genres.slice(0, 6).map((genre) => genre.genre || genre),
        orb_state_descriptors: [dominantPersonality?.label, profile?.analyticsMetrics?.mood, profile?.mbti?.type].filter(Boolean),
        time_of_day_patterns: [],
        era_preferences: topTracks.slice(0, 8).map((track) => track.release_date?.slice(0, 4)).filter(Boolean),
        analytics_metrics: profile?.analyticsMetrics || {},
        data_quality: profile?.dataQuality || {},
        confidence: profile?.confidence || {},
        representations: profile?.representations || {},
        galaxy_topology: profile?.galaxyTopology || {},
        profile_tier: profile?.isDegraded ? 'partial' : 'full',
        audio_coverage: profile?.dataQuality?.audioCoverage || 0,
        genre_coverage: (genres.length || 0) / 12,
        soulmate_readiness: profile?.soulmateReadiness || {},
        identity_readiness: profile?.identityReadiness || {},
      }

      const { data } = await soulmateAPI.syncProfile(payload)
      setMyPublicSlug(data?.public_slug || '')
      setSynced(true)
      toast.success('your orbit is in sync')
    } catch (error) {
      const status = error?.response?.status
      if (status === 401) {
        toast.error('sign in to sync this orbit')
      } else {
        toast.error('something slipped through the static')
      }
    } finally {
      setSyncing(false)
    }
  }, [hasAppToken, musicProvider, profile])

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true)
    try {
      const res = await soulmateAPI.getMatches()
      const normalized = normalizeListResponse(res?.data, [])
      setMatches(normalized.data || [])
    } catch {
      setMatches([])
    } finally {
      setLoadingMatches(false)
    }
  }, [])

  useEffect(() => {
    if (synced && hasAppToken) {
      loadMatches()
      soulmateAPI.getNetwork().then((res) => setNetworkState(res?.data || null)).catch(() => {})
    }
  }, [hasAppToken, synced, loadMatches])

  const handleSelect = useCallback(async (match) => {
    if (!hasAppToken) {
      toast.error('sign in to explore a full comparison')
      return
    }
    setSelected(match)
    setComparison(null)
    setComparisonLoading(true)
    try {
      const res = await soulmateAPI.compare(match.user_id)
      const normalized = normalizeSoulmateResponse(res?.data)
      setComparison(normalized.data || null)
    } catch {
      toast.error('the dual orbit drifted out of reach')
    } finally {
      setComparisonLoading(false)
    }
  }, [hasAppToken])

  useEffect(() => {
    if (!normalizedIdentifier || !profile || profileLoading || !hasAppToken) return
    if (normalizedIdentifier === myPublicSlug) {
      setInviteComparison({
        otherUsername: myUsername,
        result: null,
        error: 'this link already leads back to your own orbit',
        loading: false,
      })
      return
    }

    let cancelled = false
    setInviteComparison({ loading: true, result: null, error: null, otherUsername: normalizedIdentifier })

    soulmateAPI.comparePublic(normalizedIdentifier)
      .then((res) => {
        if (cancelled) return
        const normalized = normalizeSoulmateResponse(res?.data)
        const result = normalized.data
        setInviteComparison({
          loading: false,
          result,
          error: result ? null : 'the bridge is still too thin to read clearly',
          otherUsername: result?.user_b?.username || normalizedIdentifier,
          otherProfile: result?.profile_b,
        })
      })
      .catch(() => {
        if (cancelled) return
        setInviteComparison({
          loading: false,
          result: null,
          error: 'no public orbit surfaced for that link',
          otherUsername: normalizedIdentifier,
        })
      })

    return () => {
      cancelled = true
    }
  }, [hasAppToken, myPublicSlug, myUsername, normalizedIdentifier, profile, profileLoading])

  const boot = useRouteReadiness({
    phase,
    profile,
    readiness,
    tier,
    require: { profile: true },
    copy: {
      loading: {
        title: 'Holding the dual orbit.',
        subtitle: 'We are pulling your listening field into alignment before the comparison ritual begins.',
        detail: 'This should settle shortly.',
      },
      error: {
        title: 'The orbit failed to load.',
        subtitle: 'We could not reach your listening profile just yet.',
        detail: 'Refresh once and the signal should return.',
      },
      empty: {
        title: 'Connect a music source to compare soulmates.',
        subtitle: 'The compatibility ritual begins once your listening signal is present.',
        detail: 'No signal is present yet.',
      },
      partial: {
        title: 'Partial signal detected.',
        subtitle: 'Enough signal exists to begin, but the comparison will deepen as your profile matures.',
        detail: 'Some sections may stay quiet until more data lands.',
      },
      sparse: {
        title: 'Sparse signal mode.',
        subtitle: 'We are rendering a lighter soulmate ritual while your profile continues to form.',
        detail: 'This is intentional, not an error.',
      },
    },
  })

  return (
    <div className="cosmic-page space-y-6">
      <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="noire-panel relative overflow-hidden rounded-[34px] p-6 lg:p-8">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_24%_18%,rgba(143,117,255,0.18),transparent_34%),radial-gradient(ellipse_at_78%_72%,rgba(242,141,223,0.12),transparent_30%)]" />
        <div className="relative z-10">
          <p className="page-header-kicker mb-2">The Dual Orbit</p>
          <h1 className="page-header-title">Soulmates</h1>
          <p className="page-header-copy mt-3 max-w-3xl">
            Two listening selves placed into the same field and read through overlap, discovery, and beautiful tension.
          </p>
        </div>
      </motion.section>

      {boot.variant !== 'ready' && (
        <RouteStatusBanner
          variant={boot.variant}
          title={boot.title}
          subtitle={boot.subtitle}
          detail={boot.detail}
        />
      )}

      {!musicProvider && (
        <div className="max-w-lg">
          <p className="mb-4 text-sm text-slate-400">Connect a music source and the other orbit can begin to appear.</p>
          <MusicSourceCard />
        </div>
      )}

      {musicProvider && !hasAppToken && (
        <div className="noire-action-card rounded-[28px] p-5">
          <p className="section-label mb-2">Soulmates needs a Melody Map account</p>
          <p className="text-sm text-slate-400">
            Your Spotify signal is connected, but the soulmate vault requires a signed Melody Map session to store and compare orbits.
          </p>
          <Link to="/login" className="noire-chip mt-4 inline-flex px-4 py-2 text-xs text-white">
            Sign in to sync
          </Link>
        </div>
      )}

      {musicProvider && hasAppToken && (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <InviteLink publicSlug={myPublicSlug} />
          <div className="noire-action-card rounded-[28px] p-5">
            <p className="section-label mb-2">Sync Your Listening Field</p>
            <p className="mb-4 text-sm text-slate-400">
              We pull in your artists, songs, identity read, atmosphere labels, and signal confidence before comparing two worlds.
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                clarity: {profile?.confidence?.labels?.soulmate || 'still forming'}
              </div>
              <button
                onClick={syncProfile}
                disabled={syncing}
                className="noire-chip flex items-center gap-2 px-4 py-3 text-xs text-white disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'tuning...' : synced ? 'tune again' : 'sync now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {musicProvider && hasAppToken && !readiness?.soulmate && (
        <div className="noire-panel-soft rounded-[24px] p-5 text-sm text-slate-400">
          The soulmate field is still forming. You can sync now, preview your own orbit, and open invite links immediately while the deeper overlap model keeps filling in.
        </div>
      )}

      {musicProvider && hasAppToken && synced && networkState && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="noire-info-card rounded-[24px] p-4">
            <p className="section-label mb-2">Privacy posture</p>
            <p className="text-sm text-white capitalize">{networkState.privacy?.visibility || 'private'}</p>
            <p className="mt-2 text-xs text-slate-500">Matching: {networkState.privacy?.allow_matching === false ? 'off' : 'on'} • Co-curation: {networkState.privacy?.allow_co_curation === false ? 'off' : 'on'}</p>
          </div>
          <div className="noire-info-card rounded-[24px] p-4">
            <p className="section-label mb-2">Taste graph</p>
            <p className="text-sm text-white">{(networkState.edges || []).length} relationship edges</p>
            <p className="mt-2 text-xs text-slate-500">Soulmate comparisons and co-curation links are now persisted as graph edges instead of disappearing after one read.</p>
          </div>
          <div className="noire-info-card rounded-[24px] p-4">
            <p className="section-label mb-2">Co-curation vault</p>
            <p className="text-sm text-white">{(networkState.coCurationArtifacts || []).length} shared artifacts</p>
            <p className="mt-2 text-xs text-slate-500">Each ritual can now become a saved social artifact rather than a temporary comparison state.</p>
          </div>
        </div>
      )}

      {inviteComparison && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand-purple" />
            <p className="section-label">Invite Orbit</p>
          </div>
          {inviteComparison.loading && (
            <div className="py-8">
              <VibeEmitter bpm={vibeFeatures?.tempo ?? 112} size={56} label="tuning into their orbit..." />
            </div>
          )}
          {!inviteComparison.loading && inviteComparison.result && (
            <CompatibilityCard
              result={inviteComparison.result}
              userAName={myUsername}
              userBName={inviteComparison.otherUsername}
              userAProfile={profile}
              userBProfile={inviteComparison.otherProfile}
              shareHref={`${window.location.origin}/soulmate/${encodeURIComponent(normalizedIdentifier)}`}
            />
          )}
          {!inviteComparison.loading && !inviteComparison.result && (
            <p className="text-sm text-slate-400">{inviteComparison.error}</p>
          )}
        </div>
      )}

      {synced && hasAppToken && (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-purple" />
              <p className="section-label">Closest Orbits</p>
            </div>

            {loadingMatches && (
              <div className="py-8">
                <VibeEmitter bpm={vibeFeatures?.tempo ?? 112} size={56} label="listening for nearby worlds..." />
              </div>
            )}

            {!loadingMatches && matches.length === 0 && (
              <div className="noire-panel-soft rounded-[24px] p-5 text-sm text-slate-400">
                No nearby orbits have synced yet. Share Melody Map with someone and this field will begin to glow.
              </div>
            )}

            {matches.map((match) => (
              <MatchCard key={match.user_id} match={match} selected={selected?.user_id === match.user_id} onSelect={handleSelect} />
            ))}
          </aside>

          <div className="space-y-5">
            {!selected && (
              <div className="space-y-4">
                <div className="noire-panel rounded-[28px] p-6">
                  <div className="flex items-center gap-3">
                    <HeartHandshake className="h-6 w-6 text-brand-purple" />
                    <div>
                      <p className="text-lg font-semibold text-white">Comparison chamber is ready</p>
                      <p className="mt-1 text-sm text-slate-400">Choose an orbit on the left and Melody Map will open the shared field without leaving this page empty first.</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="noire-info-card rounded-[24px] p-4">
                    <p className="section-label mb-2">How it works</p>
                    <p className="text-sm text-white">Overlap, tension, discovery</p>
                    <p className="mt-2 text-xs text-slate-500">Soulmates are read through shared artists, emotional climate, and where your worlds bridge or resist each other.</p>
                  </div>
                  <div className="noire-info-card rounded-[24px] p-4">
                    <p className="section-label mb-2">Your visible orbit</p>
                    <p className="text-sm text-white">{profile?.mbti?.type || profile?.analyticsMetrics?.mood || 'Listening self'}</p>
                    <p className="mt-2 text-xs text-slate-500">Your own identity orb is already present, even before a dual comparison is selected.</p>
                  </div>
                  <div className="noire-info-card rounded-[24px] p-4">
                    <p className="section-label mb-2">Sync posture</p>
                    <p className="text-sm text-white">{synced ? 'Orbit synced' : 'Ready to sync'}</p>
                    <p className="mt-2 text-xs text-slate-500">Invite links, recent sync state, and the comparison canvas stay visible instead of collapsing into a waiting message.</p>
                  </div>
                </div>
              </div>
            )}

            {selected && comparisonLoading && (
              <div className="py-12">
                <VibeEmitter bpm={vibeFeatures?.tempo ?? 112} size={64} label="holding the overlap in view..." />
              </div>
            )}

            {selected && comparison && !comparisonLoading && (
              <>
                <CompatibilityCard
                  result={comparison}
                  userAName={myUsername}
                  userBName={comparison.user_b?.username || selected.username}
                  userAProfile={comparison.profile_a || profile}
                  userBProfile={comparison.profile_b}
                  shareHref={`${window.location.origin}/soulmate/${encodeURIComponent(comparison.user_b?.username || selected.username || selected.user_id)}`}
                />

                {comparison.graph?.nodes?.length > 0 && (
                  <div className="noire-panel rounded-[28px] overflow-hidden">
                    <div className="px-5 pt-5">
                      <p className="section-label mb-2">Shared Constellation</p>
                      <p className="text-sm text-slate-400">See where your artist worlds overlap and where they keep their distance.</p>
                    </div>
                    <SoulmateMap
                      graph={comparison.graph}
                      userAName={myUsername}
                      userBName={comparison.user_b?.username}
                      height={420}
                    />
                  </div>
                )}

                <Link to={`/galaxy?mode=artist${comparison.sharedArtists?.[0] ? `&q=${encodeURIComponent(comparison.sharedArtists[0])}` : ''}`} className="noire-action-card block rounded-[28px] p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-purple" />
                    <p className="section-label">Shared Field</p>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-white">See where your stars overlap inside the galaxy</p>
                  <p className="mt-2 text-sm text-slate-400">Follow the shared voices back into the map and let the same anchors hold both orbits at once.</p>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
