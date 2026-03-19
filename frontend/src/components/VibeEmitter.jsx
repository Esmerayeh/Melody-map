/**
 * VibeEmitter — Smart loading indicator that pulses to BPM.
 * Replaces the generic spinner with an SVG animation that breathes
 * at the rhythm of the track currently being processed.
 *
 * Props:
 *   bpm     {number}  BPM of the current track (default 120)
 *   color   {string}  Accent color (default brand purple CSS var)
 *   label   {string}  Optional label below the emitter
 *   size    {number}  SVG size in px (default 64)
 */
export default function VibeEmitter({ bpm = 120, color = 'var(--color-brand-purple, #7C6FFF)', label, size = 64 }) {
  // Convert BPM to animation duration in seconds
  const beatDuration = `${(60 / bpm).toFixed(2)}s`
  const ringDuration = `${(60 / bpm * 2).toFixed(2)}s`

  const cx = size / 2
  const r1 = size * 0.14   // inner dot
  const r2 = size * 0.28   // mid ring
  const r3 = size * 0.42   // outer ring

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {/* Outer pulsing ring */}
        <circle
          cx={cx} cy={cx} r={r3}
          stroke={color} strokeWidth="1" strokeDasharray="188" strokeDashoffset="0"
          style={{
            animation: `vibe-ring ${ringDuration} ease-in-out infinite`,
            transformOrigin: `${cx}px ${cx}px`,
          }}
        />
        {/* Mid ring */}
        <circle
          cx={cx} cy={cx} r={r2}
          stroke={color} strokeWidth="1.5" opacity="0.4"
          style={{
            animation: `vibe-ring ${ringDuration} ease-in-out infinite`,
            animationDelay: `${(60 / bpm * 0.5).toFixed(2)}s`,
            transformOrigin: `${cx}px ${cx}px`,
          }}
        />
        {/* Core dot */}
        <circle
          cx={cx} cy={cx} r={r1}
          fill={color}
          style={{
            animation: `vibe-pulse ${beatDuration} ease-in-out infinite`,
            transformOrigin: `${cx}px ${cx}px`,
          }}
        />
      </svg>
      {label && (
        <p className="text-xs text-gray-400 animate-pulse">{label}</p>
      )}
    </div>
  )
}
