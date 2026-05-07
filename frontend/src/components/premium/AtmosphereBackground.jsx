import { motion } from 'framer-motion'

const layerMotion = {
  duration: 18,
  repeat: Infinity,
  repeatType: 'reverse',
  ease: [0.22, 1, 0.36, 1],
}

export default function AtmosphereBackground({
  variant = 'default',
  intensity = 'medium',
  className = '',
  anchored = false,
}) {
  const modeClass = `atmosphere-background atmosphere-${variant} atmosphere-${intensity} ${anchored ? 'atmosphere-anchored' : ''} ${className}`.trim()

  return (
    <div className={modeClass} aria-hidden="true">
      <motion.div
        className="atmosphere-veil atmosphere-veil-one"
        animate={{ x: ['-2%', '3%', '-1%'], y: ['0%', '2%', '-1%'], scale: [1, 1.05, 1] }}
        transition={{ ...layerMotion, duration: 22 }}
      />
      <motion.div
        className="atmosphere-veil atmosphere-veil-two"
        animate={{ x: ['1%', '-3%', '2%'], y: ['-2%', '1%', '-1%'], scale: [1.02, 0.98, 1.03] }}
        transition={{ ...layerMotion, duration: 24 }}
      />
      <motion.div
        className="atmosphere-orbs"
        animate={{ opacity: [0.68, 0.9, 0.72] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="atmosphere-stars" />
      <div className="atmosphere-grain" />
    </div>
  )
}
