import { Compass, GitBranch, Maximize2, Minimize2, Radar, RotateCcw, Search, Sparkles, Waves } from 'lucide-react'

const MODE_META = {
  identity: { label: 'Identity', icon: Sparkles },
  constellation: { label: 'Constellation', icon: GitBranch },
  mood: { label: 'Mood', icon: Waves },
  discovery: { label: 'Discovery', icon: Radar },
  genre: { label: 'Genre', icon: Compass },
}

export default function GalaxyControls({
  isDemo,
  loading,
  cinemaMode,
  onToggleCinema,
  onRefresh,
  viewMode,
  onChangeViewMode,
  showTracks,
  onToggleTracks,
  showMoodRegions,
  onToggleMoodRegions,
  onFocusPreset,
  searchQuery,
  onSearchChange,
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isDemo && <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-xs text-amber-400">Demo</span>}

      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
        <Search className="h-3.5 w-3.5 text-gray-500" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Find artist or region"
          className="w-32 bg-transparent text-xs text-gray-300 outline-none placeholder:text-gray-600"
        />
      </div>

      <button onClick={onRefresh} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 p-2 transition-all hover:bg-white/10" title="Refresh">
        <RotateCcw className="h-3.5 w-3.5 text-gray-400" />
      </button>

      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {Object.entries(MODE_META).map(([mode, meta]) => {
          const Icon = meta.icon
          const active = viewMode === mode
          return (
            <button
              key={mode}
              onClick={() => onChangeViewMode(mode)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                active
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          onClick={onToggleTracks}
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
            showTracks ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          Satellites
        </button>
        <button
          onClick={onToggleMoodRegions}
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
            showMoodRegions ? 'bg-pink-500/20 text-pink-300' : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          Nebulae
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        <button onClick={() => onFocusPreset('coreTaste')} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-300 transition-all hover:bg-white/5">
          Core
        </button>
        <button onClick={() => onFocusPreset('bridgeArtists')} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-300 transition-all hover:bg-white/5">
          Bridges
        </button>
        <button onClick={() => onFocusPreset('discoveryFrontier')} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-300 transition-all hover:bg-white/5">
          Frontier
        </button>
      </div>

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
