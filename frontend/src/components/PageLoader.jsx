import { motion } from 'framer-motion'
import { Music2 } from 'lucide-react'

export default function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-surface z-50">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center shadow-glow-md"
        >
          <Music2 className="w-7 h-7 text-white" />
        </motion.div>
        <motion.div
          className="flex gap-1.5"
          initial="hidden"
          animate="visible"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-purple"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
