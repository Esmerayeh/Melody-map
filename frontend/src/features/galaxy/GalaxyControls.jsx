import { Compass, GitBranch, Maximize2, Minimize2, Radar, RotateCcw, Search, Sparkles, Waves } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION_TOKENS } from '../motion/motionTokens'

const GALAXY_MODE_META = {
  universal: { label: 'Universal' },
  genre: { label: 'Genre' },
  artist: { label: 'Artist' },
  song: { label: 'Song' },
}

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
  galaxyMode,
  onChangeGalaxyMode,
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
    <motion.div
      layout
      transition={MOTION_TOKENS.focus}
      className="flex w-full flex-wrap items-center justify-start gap-2 sm:justify-end"
    >
      {isDemo && <span className="rounded-full border border-[#c1337f]/35 bg-[#c1337f]/20 px-2.5 py-1 text-xs text-[#f1eaee]">Demo</span>}

      <motion.div layout transition={MOTION_TOKENS.focus} className="noire-toolbar flex min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:min-w-[220px] sm:flex-initial">
        <Search className="h-3.5 w-3.5 text-gray-500" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search artists, moods, regions..."
          className="w-full bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-600 sm:w-40"
        />
      </motion.div>

      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.985 }} transition={MOTION_TOKENS.hoverIn} onClick={onRefresh} disabled={loading} className="noire-toolbar rounded-2xl p-2 transition-all hover:bg-white/10" title="Refresh">
        <RotateCcw className="h-3.5 w-3.5 text-gray-300" />
      </motion.button>

      <motion.div layout transition={MOTION_TOKENS.focus} className="noire-toolbar flex items-center gap-1 p-1">
        {Object.entries(GALAXY_MODE_META).map(([mode, meta]) => {
          const active = galaxyMode === mode
          return (
            <motion.button
              key={mode}
              onClick={() => onChangeGalaxyMode(mode)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              transition={MOTION_TOKENS.hoverIn}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all ${
                active
                  ? 'bg-[#c1337f]/35 text-[#faf5f8] shadow-[0_0_24px_rgba(193,19,127,0.30)]'
                  : 'text-[#ebccdc] hover:bg-white/10'
              }`}
            >
              {meta.label}
            </motion.button>
          )
        })}
      </motion.div>

      <motion.div layout transition={MOTION_TOKENS.focus} className="noire-toolbar flex items-center gap-1 p-1">
        {Object.entries(MODE_META).map(([mode, meta]) => {
          const Icon = meta.icon
          const active = viewMode === mode
          return (
            <motion.button
              key={mode}
              onClick={() => onChangeViewMode(mode)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              transition={MOTION_TOKENS.hoverIn}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                active
                  ? 'bg-[#ac6294]/35 text-[#f1eaee] shadow-[0_0_24px_rgba(172,98,148,0.30)]'
                  : 'text-[#ebccdc] hover:bg-white/10'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </motion.button>
          )
        })}
      </motion.div>

      <motion.div layout transition={MOTION_TOKENS.focus} className="noire-toolbar flex items-center gap-1 p-1">
        <motion.button
          onClick={onToggleTracks}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          transition={MOTION_TOKENS.hoverIn}
          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all ${
            showTracks ? 'bg-[#ac6294]/30 text-[#f1eaee]' : 'text-[#ebccdc] hover:bg-white/10'
          }`}
        >
          Satellites
        </motion.button>
        <motion.button
          onClick={onToggleMoodRegions}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          transition={MOTION_TOKENS.hoverIn}
          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all ${
            showMoodRegions ? 'bg-pink-500/18 text-pink-100' : 'text-[#ebccdc] hover:bg-white/10'
          }`}
        >
          Nebulae
        </motion.button>
      </motion.div>

      <motion.div layout transition={MOTION_TOKENS.focus} className="noire-toolbar flex items-center gap-1 p-1">
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} transition={MOTION_TOKENS.hoverIn} onClick={() => onFocusPreset('coreTaste')} className="rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-gray-200 transition-all hover:bg-white/5">
          Core
        </motion.button>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} transition={MOTION_TOKENS.hoverIn} onClick={() => onFocusPreset('bridgeArtists')} className="rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-gray-200 transition-all hover:bg-white/5">
          Bridges
        </motion.button>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} transition={MOTION_TOKENS.hoverIn} onClick={() => onFocusPreset('discoveryFrontier')} className="rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-gray-200 transition-all hover:bg-white/5">
          Frontier
        </motion.button>
      </motion.div>

      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        transition={MOTION_TOKENS.hoverIn}
        onClick={onToggleCinema}
        className="flex items-center gap-1.5 rounded-2xl border border-[#ac6294]/35 bg-[#ac6294]/15 px-3 py-2 text-xs font-medium text-[#f1eaee] transition-all hover:bg-[#ac6294]/25"
      >
        {cinemaMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {cinemaMode ? 'Windowed' : 'Cinema'}
      </motion.button>
    </motion.div>
  )
}
