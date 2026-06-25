/**
 * UniverseEventFeed
 * -----------------
 * Quiet, collapsible signal feed in the upper-right of /universe.
 *
 * Rules:
 *   - Max 4 visible rows
 *   - Older rows fade toward 40% opacity
 *   - Collapsible — stays out of the way
 *   - Emitted events auto-appear; user can dismiss individually
 *   - Not a notification centre — no sounds, no alerts, no badges on nav
 */
import { forwardRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Radio, X } from 'lucide-react'
import { MOTION_TOKENS } from '../motion/motionTokens'
import useUniverseEvents from './useUniverseEvents'

const EVENT_COLORS = {
  'new live signal':       '#ac6294',
  'former orbit detected': '#ccd6ff',
  'new surge star':        '#f1c68a',
  'comet decoded':         '#b9f5c8',
  'passport exported':     '#b59cff',
  'semantic map locked':   '#ac6294',
  'Auralith found a bridge': '#f1aacb',
  'obsession field active':  '#f1c68a',
}

const ROW_OPACITIES = [1, 0.76, 0.52, 0.36]

const EventRow = forwardRef(function EventRow({ event, onDismiss, age }, ref) {
  const color   = EVENT_COLORS[event.type] || '#ac6294'
  const opacity = ROW_OPACITIES[age] ?? 0.36

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: 10, height: 0 }}
      animate={{ opacity, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 10, height: 0 }}
      transition={MOTION_TOKENS.panel}
      className="flex min-h-[36px] items-center gap-2 px-3 py-1.5"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 5px ${color}88` }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] leading-tight text-white/80">{event.label}</p>
        {event.detail && (
          <p className="truncate text-[9px] text-white/36">{event.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(event.id)}
        className="shrink-0 rounded p-0.5 text-white/24 transition-colors hover:text-white/60 min-h-[44px] min-w-[24px] flex items-center justify-center"
        aria-label="Dismiss event"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </motion.div>
  )
})

export default function UniverseEventFeed({ className = '' }) {
  const events  = useUniverseEvents((s) => s.events)
  const dismiss = useUniverseEvents((s) => s.dismiss)
  const [collapsed, setCollapsed] = useState(false)

  const visible = events.slice(0, 4)
  if (visible.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={MOTION_TOKENS.panel}
      className={`overflow-hidden rounded-[16px] border border-white/10 bg-[#080c1e]/85 backdrop-blur-xl ${className}`}
      style={{ width: 240 }}
    >
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex min-h-[36px] w-full items-center justify-between gap-2 px-3 py-2"
        aria-expanded={!collapsed}
        aria-label="Toggle signal feed"
      >
        <div className="flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-[#ac6294]/60" />
          <span className="text-[9px] uppercase tracking-[0.22em] text-white/36">Signal feed</span>
          <span className="rounded-full bg-[#ac6294]/14 px-1.5 py-0.5 text-[9px] text-[#ac6294]/80">
            {visible.length}
          </span>
        </div>
        <motion.span animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-white/28" />
        </motion.span>
      </button>

      {/* Event rows */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="rows"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-white/6"
          >
            <AnimatePresence mode="popLayout">
              {visible.map((event, index) => (
                <EventRow key={event.id} event={event} onDismiss={dismiss} age={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
