/**
 * useUniverseEvents
 * -----------------
 * Lightweight Zustand store for the Universe signal feed.
 *
 * Emit from anywhere:
 *   import { emitUniverseEvent, EVENT_TYPES } from './useUniverseEvents'
 *   emitUniverseEvent(EVENT_TYPES.COMET_DECODED, 'Comet decoded', 'Artist X')
 *
 * Read in components:
 *   const events  = useUniverseEvents((s) => s.events)
 *   const dismiss = useUniverseEvents((s) => s.dismiss)
 */
import { create } from 'zustand'

let _nextId = 1

export const EVENT_TYPES = {
  LIVE_SIGNAL:      'new live signal',
  FORMER_ORBIT:     'former orbit detected',
  SURGE_STAR:       'new surge star',
  COMET_DECODED:    'comet decoded',
  PASSPORT_EXPORT:  'passport exported',
  SEMANTIC_LOCKED:  'semantic map locked',
  AURALITH_BRIDGE:  'Auralith found a bridge',
  OBSESSION_FIELD:  'obsession field active',
}

const useUniverseEvents = create((set) => ({
  events: [],

  emit: (type, label, detail = null) => set((state) => {
    const event = { id: _nextId++, type, label, detail, timestamp: Date.now() }
    // Keep max 12 in the queue; UI shows 4
    return { events: [event, ...state.events].slice(0, 12) }
  }),

  dismiss: (id) => set((state) => ({
    events: state.events.filter((e) => e.id !== id),
  })),

  clearAll: () => set({ events: [] }),
}))

/** Emit an event from outside React (event handlers, effects, etc.) */
export function emitUniverseEvent(type, label, detail) {
  useUniverseEvents.getState().emit(type, label, detail)
}

export default useUniverseEvents
