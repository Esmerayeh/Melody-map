/**
 * AuralithNodeExplainer.jsx
 * -------------------------
 * Shows a contextual Auralith explanation whenever a Galaxy node, region,
 * edge, or cluster is focused.
 *
 * Data sources (in priority order):
 *   1. LLM-grounded:  POST /api/auralith/agent-turn with node context
 *   2. Template:      deterministic sentence built from profile data
 *
 * The result is always labeled with its source so the user knows
 * how confident to be.
 *
 * Usage: mount alongside GalaxyInspector in Universe.jsx and MusicMap.jsx.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion }      from 'framer-motion'
import { Brain, Loader2 }               from 'lucide-react'
import { auralithAPI }                  from '../../services/api'
import useAuthStore                     from '../../store/useAuthStore'
import { MOTION_TOKENS }                from '../motion/motionTokens'
import { explainProximity }             from '../galaxy/galaxyScoring'

// ─────────────────────────────────────────────────────────────────────────────
// Template explanations (used when no LLM and as fast fallback)
// ─────────────────────────────────────────────────────────────────────────────
function buildTemplateExplanation(entity, profile) {
  const { node, region, edge, cluster } = entity
  const topGenre   = profile?.genres?.[0]?.genre  || 'your core genre'
  const topArtist  = profile?.topArtists?.[0]?.name || 'your most listened artist'
  const mood       = profile?.analyticsMetrics?.mood || 'reflective'
  const archetype  = profile?.personality?.[0]?.archetype || 'Sonic Explorer'
  const profileAF  = profile?.audioFeatures || {}

  if (edge) {
    // Use semantic coordinate explanation when both endpoints have audio features
    const sourceMeta = entity.node?.audioFeatures
    const targetMeta = edge._targetFeatures
    if (sourceMeta && targetMeta) {
      return explainProximity(sourceMeta, targetMeta)
    }
    return `This bridge connects two voices that share ${edge.type === 'bridge_lane' ? 'a sonic neighbourhood' : 'audio-feature overlap'} — the signal between them is real, not decorative.`
  }
  if (cluster) {
    return `This neighbourhood clusters around ${cluster.label}. It exists in your galaxy because multiple listening threads converge here.`
  }
  if (region) {
    const coverage = Math.round((region.coverage || 0) * 100)
    return `The ${region.title || region.label} nebula spans ${coverage}% of your galaxy. It is the gravitational field your ${topGenre} listening lives inside.`
  }
  if (node) {
    const af  = node.audioFeatures || {}
    const sig = Math.round((node.metrics?.significance || 0) * 100)

    if (node.type === 'genre') {
      // Explain genre position using its audio features if available
      if (af.valence != null && af.energy != null) {
        const brightness = af.valence > 0.6 ? 'bright' : af.valence < 0.4 ? 'dark' : 'mid-range'
        const intensity  = af.energy  > 0.6 ? 'intense' : af.energy  < 0.4 ? 'quiet' : 'moderate'
        return `This nebula sits here because its artists average ${brightness} valence and ${intensity} energy. That places it in the ${brightness === 'dark' ? 'melancholic/atmospheric' : brightness === 'bright' ? 'uplifting/energetic' : 'versatile'} quadrant of the galaxy.`
      }
      return `This genre nebula shapes ${sig}% of your listening identity. Your ${archetype} archetype pulls most strongly through sound like this.`
    }
    if (node.role === 'surge-star') {
      return `${node.label} entered your orbit recently and is not yet in your long-term history. The galaxy marks it as a surge — new gravity forming.`
    }
    if (node.role === 'ghost-star') {
      return `${node.label} is a former orbit. It appears in your long-term listening but not your recent activity. The Memory Belt holds it at the outer rim.`
    }
    // Semantic position explanation using the galaxy coordinate system
    if (af.valence != null && af.energy != null) {
      const brightness = af.valence > 0.6 ? 'bright' : af.valence < 0.4 ? 'dark' : 'mid-range'
      const intensity  = af.energy  > 0.6 ? 'intense' : af.energy  < 0.4 ? 'quiet' : 'moderate'
      const prox       = explainProximity(af, profileAF)
      return `${node.label} sits here because its audio signature is ${brightness} and ${intensity} (valence ${+(af.valence || 0.5).toFixed(2)}, energy ${+(af.energy || 0.5).toFixed(2)}). ${prox}`
    }
    if (node.metrics?.significance > 0.7) {
      return `${node.label} sits near your core because your listening keeps returning here. Significance: ${sig}%. This is not casual — it is anchored.`
    }
    return `${node.label} occupies this region of your galaxy because it shares sonic weight with ${topArtist}. The distance between them is real.`
  }
  return 'Touch a star, nebula, or bridge to see why it belongs here.'
}

function buildEntityContext(entity) {
  const { node, region, edge, cluster } = entity
  if (node)    return `${node.type}: ${node.label}. Role: ${node.role || node.type}. Significance: ${Math.round((node.metrics?.significance || 0) * 100)}%.`
  if (region)  return `Genre region: ${region.title || region.label}. Coverage: ${Math.round((region.coverage || 0) * 100)}%.`
  if (cluster) return `Cluster: ${cluster.label}. Size: ${cluster.size || 0} bodies.`
  if (edge)    return `Connection: ${edge.type.replace(/_/g, ' ')}. Weight: ${Math.round((edge.weight || 0) * 100)}%.`
  return ''
}

function entityKey(entity) {
  const { node, region, edge, cluster } = entity
  if (node)    return `node:${node.id || node.label}`
  if (region)  return `region:${region.id}`
  if (cluster) return `cluster:${cluster.id}`
  if (edge)    return `edge:${edge.id}`
  return 'empty'
}

function hasEntity(entity) {
  return !!(entity?.node || entity?.region || entity?.edge || entity?.cluster)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function AuralithNodeExplainer({ entity, profile }) {
  const sessionToken  = useAuthStore((s) => s.sessionToken)
  const providers     = useAuthStore((s) => s.providers)
  const isAuthed      = Boolean(sessionToken || providers?.spotify?.connected || providers?.lastfm?.connected)

  const [explanation, setExplanation] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [mode, setMode]               = useState('template') // 'llm' | 'semantic' | 'template'
  const [provider, setProvider]       = useState(null)       // 'groq' | 'anthropic' | 'openai_compatible' | null

  // Key the effect on a STABLE string, not the `entity` object. The parent
  // (MusicMap/Universe) rebuilds `entity` whenever the galaxy model identity
  // churns, so depending on the object reference caused
  // setState → re-render → new entity object → setState … = "Maximum update
  // depth exceeded" (the crash the boundary was swallowing). The string key
  // only changes when the actual selection changes.
  const entityHasData = hasEntity(entity)
  const key           = entityHasData ? entityKey(entity) : null

  useEffect(() => {
    if (!entityHasData) { setExplanation(null); return }

    // Show template immediately; mark as 'semantic' if it uses audio-feature coordinates
    const template  = buildTemplateExplanation(entity, profile)
    const hasAF     = !!(entity.node?.audioFeatures?.valence != null || entity.node?.audioFeatures?.energy != null)
    const initMode  = hasAF ? 'semantic' : 'template'
    setExplanation({ text: template, mode: initMode })
    setMode(initMode)

    // If authed, also try the LLM path
    if (!isAuthed) return
    const entityContext = buildEntityContext(entity)
    if (!entityContext) return

    setLoading(true)

    // Extract semantic coordinates and nearby artists from the entity node
    const node       = entity?.node || {}
    const af         = node.audioFeatures || {}
    const coords     = {
      x: af.valence   ?? node.x ?? null,
      y: af.energy    ?? node.y ?? null,
      z: af.acousticness != null ? af.acousticness * 0.6 + (1 - (af.danceability ?? 0)) * 0.4 : node.z ?? null,
    }
    const nearbyArtists = (node.nearbyArtists || node.neighbors || [])
      .slice(0, 5)
      .map((a) => (typeof a === 'string' ? a : a?.name || a?.id || ''))
      .filter(Boolean)

    auralithAPI.agentTurn({
      prompt:   `Explain this galaxy element in one poetic but grounded sentence: ${entityContext}`,
      profile:  {
        topArtists:      (profile?.topArtists || []).slice(0, 5).map((a) => ({ name: a.name, genres: a.genres || [] })),
        genres:          (profile?.genres || []).slice(0, 6),
        audioFeatures:   profile?.audioFeatures || {},
        analyticsMetrics:profile?.analyticsMetrics || {},
        personality:     profile?.personality || [],
        mbti:            profile?.mbti || {},
      },
      // Grounding context for the backend LLM prompt
      entity:        { name: node.artistName || node.name || node.id, genre: node.genre, ...af },
      coords:        coords,
      nearbyArtists: nearbyArtists,
      mode:          'explain',
      thread_id:     `galaxy-explainer-${key}`,
      limit:         1,
    }).then((res) => {
      const data    = res?.data
      const llmText = data?.llm_answer || data?.vibe_summary
      if (llmText && llmText.length > 20) {
        setExplanation({ text: llmText, mode: data?.modelVersion || 'llm-grounded' })
        setMode('llm')
        setProvider(data?.provider || null)
      }
    }).catch(() => {
      // template already set — just leave it
    }).finally(() => {
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isAuthed])

  if (!hasEntity(entity) || !explanation) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={entityKey(entity)}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{ opacity: 0, y: -6 }}
        transition={MOTION_TOKENS.panel}
        className="relative overflow-hidden rounded-[22px] border border-[#ac6294]/16 bg-[#060c1e]/88 p-4 backdrop-blur-xl"
        style={{ boxShadow: '0 0 40px rgba(172,98,148,0.06)' }}
      >
        {/* Scanner line decoration */}
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#ac6294]/30 to-transparent" />

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#ac6294]/22 bg-[#ac6294]/10">
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ac6294]" />
              : <Brain className="h-3.5 w-3.5 text-[#ac6294]" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ac6294]/60">
                Auralith
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]"
                style={{
                  background: mode === 'llm'
                    ? 'rgba(172,98,148,0.10)'
                    : mode === 'semantic'
                      ? 'rgba(209,82,150,0.10)'
                      : 'rgba(255,255,255,0.05)',
                  color: mode === 'llm'
                    ? '#ac6294'
                    : mode === 'semantic'
                      ? '#b59cff'
                      : 'rgba(255,255,255,0.35)',
                  border: mode === 'llm'
                    ? '1px solid rgba(172,98,148,0.24)'
                    : mode === 'semantic'
                      ? '1px solid rgba(209,82,150,0.20)'
                      : '1px solid rgba(255,255,255,0.08)',
                }}
                title={
                  mode === 'llm'
                    ? `LLM-grounded via ${provider || 'language model'} — based on your profile and retrieved songs`
                    : mode === 'semantic'
                      ? 'Derived from audio-feature coordinates — deterministic'
                      : 'Rule-based template from profile data'
                }
              >
                {mode === 'llm'
                  ? (provider === 'groq'
                      ? 'Groq · LLM-grounded'
                      : provider
                        ? `${provider} · LLM-grounded`
                        : 'LLM-grounded')
                  : mode === 'semantic'
                    ? 'Semantic mode'
                    : 'Retrieval mode'}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/84 italic">
              "{explanation.text}"
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
