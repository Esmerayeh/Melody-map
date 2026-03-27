import { motion } from 'framer-motion'

export default function GalaxyLegend({ clusters = [] }) {
  const topClusters = clusters.slice(0, 4)

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 max-w-sm space-y-2">
      {topClusters.map((cluster) => (
        <motion.div
          key={cluster.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/55 px-3 py-2 text-xs text-gray-300 backdrop-blur"
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: cluster.color }} />
          <div>
            <p className="font-semibold text-white">{cluster.label}</p>
            <p className="text-gray-400">{cluster.dominantGenres.slice(0, 3).join(' · ')}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
