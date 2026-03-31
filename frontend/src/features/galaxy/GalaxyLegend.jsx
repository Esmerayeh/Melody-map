import { motion } from 'framer-motion'
import { MOTION_TOKENS } from '../motion/motionTokens'

export default function GalaxyLegend({
  clusters = [],
  regions = [],
  density = null,
  profileTier = 'rich',
  onSelectCluster,
  onSelectRegion,
}) {
  const topClusters = clusters.slice(0, 4)
  const topRegions = regions.slice(0, 4)

  return (
    <motion.div layout transition={MOTION_TOKENS.focus} className="absolute bottom-5 left-5 flex max-w-sm flex-col gap-3">
      {density && (
        <motion.div layout transition={MOTION_TOKENS.panel} className="noire-info-card px-3.5 py-3 text-[11px] text-gray-300">
          <div className="flex flex-wrap items-center gap-2">
            <span>{density.anchors} anchors</span>
            <span>/</span>
            <span>{density.artistStars} artist stars</span>
            <span>/</span>
            <span>{density.trackSatellites} satellites</span>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-gray-500">{profileTier} profile mode</p>
        </motion.div>
      )}

      {!!topClusters.length && (
        <div className="space-y-2">
          {topClusters.map((cluster) => (
            <motion.button
              key={cluster.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              transition={MOTION_TOKENS.chip}
              onClick={() => onSelectCluster?.(cluster.id)}
              className="noire-info-card pointer-events-auto flex w-full items-start gap-2 px-3.5 py-3 text-left text-xs text-gray-300 transition-all hover:border-white/20 hover:bg-[#0b1025]/80"
            >
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_18px_currentColor]" style={{ background: cluster.color, color: cluster.color }} />
              <div className="min-w-0">
                <p className="font-semibold text-white">{cluster.label}</p>
                <p className="truncate text-gray-400">{cluster.dominantGenres.slice(0, 3).join(' / ')}</p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {!!topRegions.length && (
        <motion.div layout transition={MOTION_TOKENS.panel} className="noire-info-card px-3.5 py-3 text-[11px] text-gray-400">
          <p className="mb-2 uppercase tracking-[0.22em] text-gray-500">Mood Nebula</p>
          <div className="space-y-2">
            {topRegions.map((region) => (
              <motion.button
                key={region.id}
                type="button"
                onClick={() => onSelectRegion?.(region.id)}
                whileHover={{ x: 1, opacity: 1 }}
                whileTap={{ scale: 0.99 }}
                transition={MOTION_TOKENS.chip}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-all hover:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]" style={{ background: region.color, color: region.color }} />
                  <span className="truncate text-gray-200">{region.title || region.label}</span>
                </div>
                <span>{Math.round((region.coverage || 0) * 100)}%</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
