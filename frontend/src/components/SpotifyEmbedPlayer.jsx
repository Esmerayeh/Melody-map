import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

/**
 * Parse any Spotify reference (open.spotify.com URL or spotify: URI) into the
 * { type, id } pair the official Embed iframe needs. No API, no scopes, no token —
 * the embed plays the real track for anyone. preview_url is dead; this is the
 * replacement sensory beat for star-open.
 */
export function parseSpotifyTarget(input) {
  if (!input || typeof input !== 'string') return null
  const value = input.trim()

  // spotify:track:ID  /  spotify:artist:ID
  const uri = value.match(/^spotify:(track|album|artist|playlist|episode|show):([A-Za-z0-9]+)/i)
  if (uri) return { type: uri[1].toLowerCase(), id: uri[2] }

  // https://open.spotify.com/[intl-xx/]track/ID?si=...
  const url = value.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|artist|playlist|episode|show)\/([A-Za-z0-9]+)/i)
  if (url) return { type: url[1].toLowerCase(), id: url[2] }

  return null
}

const EMBEDDABLE = new Set(['track', 'album', 'artist', 'playlist'])

/**
 * Renders the official Spotify Embed for a focused star. Mounts only when a
 * playable URL is present, so there is zero idle cost — the iframe and its
 * player JS load on star-open and unmount on deselect.
 */
export default function SpotifyEmbedPlayer({ url, label }) {
  const target = useMemo(() => parseSpotifyTarget(url), [url])

  if (!target || !EMBEDDABLE.has(target.type)) return null

  const src = `https://open.spotify.com/embed/${target.type}/${target.id}?utm_source=generator&theme=0`
  const title = label ? `Spotify player — ${label}` : 'Spotify player'

  return (
    <motion.div
      key={`${target.type}:${target.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={MOTION_TOKENS.panel}
      className="w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
    >
      <iframe
        title={title}
        src={src}
        width="100%"
        height="152"
        frameBorder="0"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        style={{ borderRadius: 12, display: 'block' }}
      />
    </motion.div>
  )
}
