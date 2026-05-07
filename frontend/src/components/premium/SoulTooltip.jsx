import { motion, AnimatePresence } from 'framer-motion'

export default function SoulTooltip({ open = true, title, detail, accent = 'lavender', children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={`soul-tooltip soul-${accent}`}
        >
          {title ? <p className="soul-tooltip-title">{title}</p> : null}
          {detail ? <p className="soul-tooltip-detail">{detail}</p> : null}
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
