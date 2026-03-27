import { motion } from 'framer-motion'

export default function GalaxyLegend({ clusters = [], regions = [], density = null, onSelectCluster }) {
  const topClusters = clusters.slice(0, 5)
  const topRegions = regions.slice(0, 3)

  return (
    <div className="absolute bottom-4 left-4 flex max-w-sm flex-col gap-3">
      {density && (
        <div className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-[11px] text-gray-400 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span>{density.anchors} anchors</span>
            <span>•</span>
            <span>{density.artistStars} artist stars</span>
            <span>•</span>
            <span>{density.trackSatellites} satellites</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {topClusters.map((cluster) => (
          <motion.button
            key={cluster.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onSelectCluster?.(cluster.id)}
            className="pointer-events-auto flex w-full items-start gap-2 rounded-lg border border-white/10 bg-black/55 px-3 py-2 text-left text-xs text-gray-300 backdrop-blur transition-all hover:bg-black/70"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: cluster.color }} />
            <div>
              <p className="font-semibold text-white">{cluster.label}</p>
              <p className="text-gray-400">{cluster.dominantGenres.slice(0, 3).join(' · ')}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {!!topRegions.length && (
        <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[11px] text-gray-400 backdrop-blur">
          <p className="mb-2 uppercase tracking-[0.2em] text-gray-500">Mood Nebulae</p>
          <div className="space-y-1.5">
            {topRegions.map((region) => (
              <div key={region.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: region.color }} />
                  <span className="capitalize text-gray-300">{region.label}</span>
                </div>
                <span>{Math.round((region.coverage || 0) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
