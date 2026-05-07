import { motion } from 'framer-motion'

export default function NebulaLoader({
  label = 'Gathering signal',
  detail = 'Please hold while the next layer settles.',
  compact = false,
}) {
  return (
    <div className={`nebula-loader ${compact ? 'nebula-loader-compact' : ''}`}>
      <div className="nebula-loader-orb">
        <motion.div
          className="nebula-loader-core"
          animate={{ scale: [0.92, 1.05, 0.94], opacity: [0.72, 1, 0.78] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="nebula-loader-copy">
        <p className="nebula-loader-label">{label}</p>
        {!compact ? <p className="nebula-loader-detail">{detail}</p> : null}
      </div>
    </div>
  )
}
