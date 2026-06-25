import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MOTION_TOKENS } from '../motion/motionTokens'
import SpotifyEmbedPlayer from '../../components/SpotifyEmbedPlayer'

// 30s Spotify preview playback for "the open" (Path A). Self-contained: owns its
// own <audio>, and stops on unmount — since the inspector content remounts per
// node (AnimatePresence keyed by node id), opening another star unmounts this and
// kills the clip, so two previews never overlap. Warm, calm affordance. Only
// rendered when a node actually has a previewUrl (tracks only; null-safe).
function PreviewPlayer({ url, color }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause() }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.currentTime = 0
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="mt-3">
      <audio ref={audioRef} src={url} preload="none" onEnded={() => setPlaying(false)} />
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        style={{ borderColor: `${color}55`, background: `${color}1f`, color: '#f4dcb4' }}
      >
        <span aria-hidden>{playing ? '❚❚' : '▶'}</span>
        {playing ? 'Playing preview' : 'Play preview'}
      </button>
    </div>
  )
}

function MetricPill({ label, value }) {
  return (
    <motion.span
      layout
      transition={MOTION_TOKENS.chip}
      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300"
    >
      {label}: {value}
    </motion.span>
  )
}

export default function GalaxyInspector({ node, edge, cluster, region }) {
  const reduceMotion = useReducedMotion()
  let content

  if (!node && !edge && !cluster && !region) {
    content = (
      <div className="noire-info-card mt-4 p-5 text-sm text-gray-400">
        Touch a star, region, bridge, or satellite to see why it belongs to this part of your listening sky.
      </div>
    )
  } else if (edge) {
    content = (
      <div className="noire-info-card mt-4 p-5">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gray-500">Bridge</p>
        <h3 className="text-lg font-bold capitalize text-white">{edge.type.replace(/_/g, ' ')}</h3>
        <p className="mt-2 text-sm text-gray-300">{edge.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Weight" value={`${Math.round((edge.weight || 0) * 100)}%`} />
          <MetricPill label="Confidence" value={`${Math.round((edge.confidence || 0) * 100)}%`} />
        </div>
      </div>
    )
  } else if (cluster) {
    content = (
      <div className="noire-info-card mt-4 p-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: cluster.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Neighborhood</p>
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{cluster.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{cluster.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Bodies" value={cluster.size || 0} />
          <MetricPill label="Bridge" value={`${Math.round((cluster.metrics?.bridgeScore || 0) * 100)}%`} />
          <MetricPill label="Discovery" value={`${Math.round((cluster.metrics?.discoveryScore || 0) * 100)}%`} />
        </div>
        {!!cluster.dominantGenres?.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cluster.dominantGenres.slice(0, 5).map((genre) => (
              <motion.span key={genre} layout transition={MOTION_TOKENS.chip} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                {genre}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    )
  } else if (region) {
    content = (
      <div className="noire-info-card mt-4 p-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: region.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Mood Region</p>
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{region.title || region.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{region.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Coverage" value={`${Math.round((region.coverage || 0) * 100)}%`} />
          <MetricPill label="Bodies" value={region.members?.length || 0} />
        </div>
      </div>
    )
  } else {
    content = (
      <div className="noire-info-card mt-4 p-5">
        <div className="flex items-start gap-4">
      {/* The art "blooms" on open: scales up from 0.9 + fades in over ~450ms
          (calm ease, no bounce) with a soft glow in the node's own warm light —
          turns the old static thumbnail into a reveal. Remounts per node (parent
          AnimatePresence is keyed by node id), so it re-blooms each star you open.
          prefers-reduced-motion → appears instantly, no scale/fade. */}
      <motion.div
        key={`art-${node.id || node.label}`}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl"
        style={{ background: `${node.color}22`, boxShadow: `0 0 20px 1px ${node.color}55, inset 0 0 16px ${node.color}1f` }}
      >
        {node.image
          ? <img src={node.image} alt={node.label} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-3xl text-[#f4dcb4]/70">♪</div>}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: node.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{node.type}</p>
          {node.role && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-400">
              {node.role.replace(/-/g, ' ')}
            </span>
          )}
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{node.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{node.explanation}</p>
        {node.previewUrl && <PreviewPlayer url={node.previewUrl} color={node.color} />}
        {/* Show a metric pill ONLY when its value is a real number. An absent
            metric (the server doesn't compute confidence/bridge for these nodes)
            is hidden rather than faked as 0% — no invented values. A genuine 0
            is finite, so it still shows. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {Number.isFinite(node.confidence) && (
            <MetricPill label="Confidence" value={`${Math.round(node.confidence * 100)}%`} />
          )}
          {Number.isFinite(node.metrics?.bridgeScore) && (
            <MetricPill label="Bridge" value={`${Math.round(node.metrics.bridgeScore * 100)}%`} />
          )}
          {Number.isFinite(node.metrics?.discoveryScore) && (
            <MetricPill label="Discovery" value={`${Math.round(node.metrics.discoveryScore * 100)}%`} />
          )}
          {Number.isFinite(node.metrics?.centrality) && (
            <MetricPill label="Centrality" value={`${Math.round(node.metrics.centrality * 100)}%`} />
          )}
        </div>
        {node.genres?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {node.genres.slice(0, 5).map((genre) => (
              <motion.span key={genre} layout transition={MOTION_TOKENS.chip} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                {genre}
              </motion.span>
            ))}
          </div>
        )}
      </div>
        </div>
        {/* The song actually plays: the official Spotify Embed renders inline on
            star-open — real track, no API/scopes/token. Replaces the old external
            "Open" link and the dead preview_url clip. Remounts per node (parent
            AnimatePresence keyed by node id), so opening another star swaps tracks. */}
        {node.spotifyUrl && (
          <div className="mt-4">
            <SpotifyEmbedPlayer url={node.spotifyUrl} label={node.label} />
          </div>
        )}
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={edge ? `edge-${edge.type}` : cluster ? `cluster-${cluster.id || cluster.label}` : region ? `region-${region.id || region.label}` : node ? `node-${node.id || node.label}` : 'empty'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={MOTION_TOKENS.panel}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  )
}
