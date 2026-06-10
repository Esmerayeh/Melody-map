/**
 * galaxyAudio.js
 * --------------
 * Tiny, isolated Web Audio engine for the galaxy's ambient layer.
 *
 *   • A soft warm drone pad (a few detuned oscillators → lowpass → slow tremolo).
 *   • Short, gentle one-shot tones for hover and click-select (distinct).
 *
 * Autoplay policy: the AudioContext is created ONLY from a real user gesture
 * (see resumeOnGesture) — never on import or mount — so no "AudioContext was
 * not allowed to start" console warnings. Everything no-ops until then.
 *
 * Volume is intentionally low and the whole thing is mutable + reduced-motion
 * gated by the controller. No purple involved — it's sound. :)
 */

let ctx = null
let master = null
let padGain = null
let padNodes = []
let gestured = false
let padStarted = false
let muted = false

function ensureContext() {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)
  return ctx
}

function startPad() {
  if (!ctx || padStarted) return
  padStarted = true
  const now = ctx.currentTime

  padGain = ctx.createGain()
  padGain.gain.value = 0
  padGain.connect(master)

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 720
  lp.Q.value = 0.4
  lp.connect(padGain)

  // Warm low chord (A2 / E3 / A3) — sine + triangle, gently detuned.
  const voices = [
    { f: 110.0,  type: 'sine',     g: 0.5,  detune: -4 },
    { f: 164.81, type: 'triangle', g: 0.26, detune: 5 },
    { f: 220.0,  type: 'triangle', g: 0.22, detune: -7 },
  ]
  voices.forEach(({ f, type, g, detune }) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = f
    osc.detune.value = detune
    const vg = ctx.createGain()
    vg.gain.value = g
    osc.connect(vg)
    vg.connect(lp)
    osc.start(now)
    padNodes.push(osc, vg)
  })

  // Slow tremolo on the pad gain so it breathes (not a static tone).
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.07
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.05
  lfo.connect(lfoGain)
  lfoGain.connect(padGain.gain)
  lfo.start(now)
  padNodes.push(lfo, lfoGain)

  // Fade the pad in over a few seconds — "ambient pad fading in".
  padGain.gain.setValueAtTime(0, now)
  padGain.gain.setTargetAtTime(0.12, now, 2.4)
}

// Call from a genuine user gesture (pointerdown / keydown / click).
export function resumeOnGesture() {
  const c = ensureContext()
  if (!c) return
  gestured = true
  if (c.state === 'suspended') c.resume().catch(() => {})
  if (!muted) startPad()
}

export function setMuted(next) {
  muted = !!next
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.08)
  // Unmuting after the first gesture should bring the pad up if it never started.
  if (!muted && ctx && gestured && !padStarted) startPad()
}

// Short, low one-shot tone. No-ops unless audio is actually running + unmuted.
function blip({ freq, dur, type = 'sine', vol }) {
  if (!ctx || muted || ctx.state !== 'running') return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  g.connect(master)
  g.gain.setValueAtTime(0.0001, now)
  g.gain.linearRampToValueAtTime(vol, now + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.start(now)
  osc.stop(now + dur + 0.03)
  osc.onended = () => { try { osc.disconnect(); g.disconnect() } catch { /* already gone */ } }
}

// Hover: a single soft high bell. Very quiet.
export function playHover() {
  blip({ freq: 880, dur: 0.13, type: 'sine', vol: 0.05 })
}

// Select: a gentle two-note rise — distinct from hover, still soft.
export function playSelect() {
  blip({ freq: 523.25, dur: 0.22, type: 'triangle', vol: 0.09 })
  setTimeout(() => blip({ freq: 783.99, dur: 0.26, type: 'triangle', vol: 0.08 }), 70)
}
