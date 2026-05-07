import { motion } from 'framer-motion'

export default function AuraCard({
  children,
  className = '',
  accent = 'lavender',
  interactive = false,
  glow = true,
  ...props
}) {
  return (
    <motion.div
      whileHover={interactive ? { y: -4, scale: 1.01 } : undefined}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={`aura-card aura-${accent} ${glow ? 'aura-glow' : ''} ${interactive ? 'aura-interactive' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </motion.div>
  )
}
