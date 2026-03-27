export default function GalaxyInspector({ node, edge }) {
  if (!node && !edge) return null

  if (edge) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gray-500">Connection</p>
        <h3 className="text-lg font-bold text-white">{edge.type.replace(/_/g, ' ')}</h3>
        <p className="mt-2 text-sm text-gray-300">{edge.explanation}</p>
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span>Weight: {Math.round((edge.weight || 0) * 100)}%</span>
          <span>Confidence: {Math.round((edge.confidence || 0) * 100)}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: `${node.color}22` }}>
        {node.image
          ? <img src={node.image} alt={node.label} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-2xl">+</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: node.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{node.type}</p>
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{node.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{node.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
          <span>Confidence: {Math.round((node.confidence || 0) * 100)}%</span>
          <span>Bridge: {Math.round((node.metrics?.bridgeScore || 0) * 100)}%</span>
          <span>Discovery: {Math.round((node.metrics?.discoveryScore || 0) * 100)}%</span>
        </div>
        {node.spotifyUrl && (
          <a
            href={node.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400"
          >
            Open
          </a>
        )}
      </div>
    </div>
  )
}
