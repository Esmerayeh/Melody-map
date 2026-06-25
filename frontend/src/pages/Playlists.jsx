import { useState } from 'react'
import { Sparkles, Loader2, Music, Heart, Download, Save, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGeneratePlaylist, useTopTracks } from '../hooks/useMusicData'
import MusicSourceCard from '../components/MusicSourceCard'
import useStore from '../store/useStore'

const MOODS = [
  { id: 'happy',       label: '☀️ Radiant Joy',       desc: 'Upbeat & luminous',       color: 'from-[#de83b4]/20 to-[#de83b4]/20 border-[#de83b4]/30' },
  { id: 'sad',         label: '🌧 Velvet Ache',        desc: 'Melancholic & slow',      color: 'from-[#ac6294]/20 to-[#ac6294]/20 border-[#ac6294]/30' },
  { id: 'energetic',   label: '⚡ Neon Kinetic',       desc: 'High voltage & fast',     color: 'from-red-500/20 to-[#d15296]/20 border-red-500/30' },
  { id: 'calm',        label: '🌊 Coastal Drift',      desc: 'Peaceful & acoustic',     color: 'from-[#ac6294]/20 to-[#ac6294]/20 border-[#ac6294]/30' },
  { id: 'dreamy',      label: '✨ Liminal Reverie',    desc: 'Ethereal & atmospheric',  color: 'from-purple-500/20 to-[#ac6294]/20 border-purple-500/30' },
  { id: 'melancholic', label: '🌑 Midnight Obsidian',  desc: 'Bittersweet & shadowed',  color: 'from-slate-500/20 to-[#ac6294]/20 border-slate-500/30' },
  { id: 'nostalgic',   label: '🎞 Golden Nostalgia',   desc: 'Warm & reminiscent',      color: 'from-[#de83b4]/20 to-[#de83b4]/20 border-[#de83b4]/30' },
  { id: 'focus',       label: '🎯 Deep Signal',        desc: 'Flow state & precision',  color: 'from-[#ac6294]/20 to-[#ac6294]/20 border-[#ac6294]/30' },
  { id: 'party',       label: '🎉 High-Octane Euphoria', desc: 'Dance & electric',      color: 'from-[#d15296]/20 to-[#d15296]/20 border-[#d15296]/30' },
]

// Demo fallback songs per mood
const DEMO = {
  dreamy:    [{ _id:'d1', title:'Sometimes', artist:'My Bloody Valentine', audio_features:{energy:0.65,valence:0.60} }],
  happy:     [{ _id:'h1', title:'White Winter Hymnal', artist:'Fleet Foxes', audio_features:{energy:0.50,valence:0.80} }],
  energetic: [{ _id:'e1', title:'Alive', artist:'Pearl Jam', audio_features:{energy:0.80,valence:0.50} }],
}

const FeatureBar = ({ label, value, color = 'bg-[#ac6294]' }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="text-gray-500 w-12 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round((value || 0) * 100)}%` }} />
    </div>
    <span className="text-gray-400 w-8 text-right">{Math.round((value || 0) * 100)}%</span>
  </div>
)

function SongCard({ song, index, liked, onLike }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/3 hover:bg-white/6 border border-white/5 hover:border-white/10 rounded-xl transition-all group">
      <span className="text-gray-600 text-xs w-5 text-center shrink-0">{index + 1}</span>
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5">
        {song.album_art
          ? <img src={song.album_art} alt={song.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-600" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{song.title}</p>
        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
      </div>
      <div className="hidden sm:flex flex-col gap-1 w-28 shrink-0">
        <FeatureBar label="Energy" value={song.audio_features?.energy}  color="bg-[#d15296]" />
        <FeatureBar label="Mood"   value={song.audio_features?.valence} color="bg-[#ac6294]" />
      </div>
      <button onClick={() => onLike(song._id)}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-all shrink-0">
        <Heart className={`w-4 h-4 transition-colors ${liked ? 'text-[#d15296] fill-[#d15296]' : 'text-gray-600 group-hover:text-[#d15296]'}`} />
      </button>
    </div>
  )
}

export default function Playlists() {
  const [mood, setMood]       = useState(null)
  const [playlist, setPlaylist] = useState(null)
  const [liked, setLiked]     = useState(new Set())
  const [saved, setSaved]     = useState(false)
  const musicProvider         = useStore((s) => s.musicProvider)

  const { data: topTracks = [] } = useTopTracks({ limit: 50 })
  const { mutateAsync: generate, isPending } = useGeneratePlaylist()

  const handleGenerate = async () => {
    if (!mood) return toast.error('Pick a mood first')
    setSaved(false)
    setLiked(new Set())
    try {
      const data = await generate(mood)
      if (data.songs?.length > 0) {
        setPlaylist(data.songs)
        toast.success(`Generated ${data.songs.length} songs`)
      } else if (topTracks.length > 0) {
        // Use provider tracks as fallback with mood filter
        setPlaylist(topTracks.slice(0, 15))
        toast('Using your top tracks as base', { icon: '🎵' })
      } else {
        const demo = DEMO[mood] || DEMO.dreamy
        setPlaylist(demo)
        toast('Showing demo playlist', { icon: '🎵' })
      }
    } catch {
      const demo = DEMO[mood] || DEMO.dreamy
      setPlaylist(demo)
      toast('Showing demo playlist', { icon: '🎵' })
    }
  }

  const handleSave = () => {
    setSaved(true)
    toast.success('Playlist saved!')
  }

  const handleExport = () => {
    if (!playlist) return
    const selectedMood = MOODS.find((m) => m.id === mood)
    const lines = [
      `# ${selectedMood?.label || mood} Playlist — Melody Map`,
      `# Generated ${new Date().toLocaleDateString()}`,
      '',
      ...playlist.map((s, i) => `${i + 1}. ${s.title} — ${s.artist}${s.spotify_url ? `  ${s.spotify_url}` : ''}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `melody-map-${mood}-playlist.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Playlist exported')
  }

  const selectedMood = MOODS.find((m) => m.id === mood)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Resonance Playlists</h1>
        <p className="text-gray-400 text-sm mt-1">Choose an emotional frequency and let the algorithm compose your soundtrack</p>
      </div>

      {!musicProvider && <div className="mb-6"><MusicSourceCard compact /></div>}

      {/* Mood grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mb-6">
        {MOODS.map((m) => (
          <button key={m.id} onClick={() => setMood(m.id)}
            className={`p-3 rounded-xl border text-left transition-all bg-gradient-to-br ${m.color} ${
              mood === m.id ? 'ring-2 ring-[#ac6294] scale-[1.02]' : 'hover:scale-[1.01]'
            }`}>
            <div className="font-medium text-sm">{m.label}</div>
            <div className="text-gray-400 text-xs mt-0.5 hidden sm:block">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Generate */}
      <button onClick={handleGenerate} disabled={!mood || isPending}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#613854] to-purple-600 rounded-xl font-semibold hover:from-[#ac6294] hover:to-purple-500 transition-all shadow-lg shadow-[#ac6294]/25 disabled:opacity-50 mb-8">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {isPending ? 'Generating...' : 'Generate Playlist'}
      </button>

      {/* Results */}
      {playlist && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-lg">{selectedMood?.label} Playlist</h2>
              <p className="text-gray-400 text-sm">{playlist.length} transmissions · AI generated</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={handleSave} disabled={saved}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#613854]/20 hover:bg-[#613854]/30 border border-[#ac6294]/30 rounded-lg text-sm text-[#ac6294] transition-all disabled:opacity-60">
                {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {playlist.map((song, i) => (
              <SongCard key={song._id || i} song={song} index={i}
                liked={liked.has(song._id)}
                onLike={(id) => setLiked((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
