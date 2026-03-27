import { GitBranch, Maximize2, Minimize2, RotateCcw } from 'lucide-react'

export default function GalaxyControls({
  isDemo,
  loading,
  constellationMode,
  onRefresh,
  onToggleConstellation,
  cinemaMode,
  onToggleCinema,
}) {
  return (
    <div className="flex items-center gap-2">
      {isDemo && <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-xs text-amber-400">Demo</span>}
      <button onClick={onRefresh} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 p-2 transition-all hover:bg-white/10" title="Refresh">
        <RotateCcw className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <button
        onClick={onToggleConstellation}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
          constellationMode
            ? 'border-purple-500/40 bg-purple-500/20 text-purple-300'
            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
        }`}
      >
        <GitBranch className="h-3.5 w-3.5" />
        {constellationMode ? 'Constellation ON' : 'Constellation'}
      </button>
      <button
        onClick={onToggleCinema}
        className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-400 transition-all hover:bg-indigo-500/20"
      >
        {cinemaMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {cinemaMode ? 'Windowed' : 'Cinema'}
      </button>
    </div>
  )
}
