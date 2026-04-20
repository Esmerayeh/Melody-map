import { motion } from 'framer-motion'
import { BrandBackdrop, BrandMark, BrandWordmark } from './brand/BrandSystem'

export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-surface">
      <BrandBackdrop opacity={0.34} />
      <div className="relative flex flex-col items-center gap-5">
        <BrandWordmark className="mb-2" />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-24 w-24 items-center justify-center rounded-full"
        >
          <div className="absolute inset-[-24%] rounded-full bg-[radial-gradient(circle,rgba(170,143,255,0.34),transparent_64%)] blur-2xl" />
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-[-10%] rounded-full border border-white/10"
            style={{ borderStyle: 'dashed' }}
          />
          <BrandMark size={88} />
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
        <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">Attuning the signal</p>
      </div>
    </div>
  )
}
