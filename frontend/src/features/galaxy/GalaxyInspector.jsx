function MetricPill({ label, value }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
      {label}: {value}
    </span>
  )
}

export default function GalaxyInspector({ node, edge, cluster, region }) {
  if (!node && !edge && !cluster && !region) return null

  if (edge) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gray-500">Connection</p>
        <h3 className="text-lg font-bold capitalize text-white">{edge.type.replace(/_/g, ' ')}</h3>
        <p className="mt-2 text-sm text-gray-300">{edge.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Weight" value={`${Math.round((edge.weight || 0) * 100)}%`} />
          <MetricPill label="Confidence" value={`${Math.round((edge.confidence || 0) * 100)}%`} />
        </div>
      </div>
    )
  }

  if (cluster) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: cluster.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Neighborhood</p>
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{cluster.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{cluster.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Bodies" value={cluster.size || 0} />
          <MetricPill label="Bridge" value={`${Math.round((cluster.metrics?.bridgeScore || 0) * 100)}%`} />
          <MetricPill label="Discovery" value={`${Math.round((cluster.metrics?.discoveryScore || 0) * 100)}%`} />
        </div>
        {!!cluster.dominantGenres?.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cluster.dominantGenres.slice(0, 5).map((genre) => (
              <span key={genre} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (region) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: region.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Mood Region</p>
        </div>
        <h3 className="mt-1 text-lg font-bold capitalize text-white">{region.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{region.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Coverage" value={`${Math.round((region.coverage || 0) * 100)}%`} />
          <MetricPill label="Bodies" value={region.members?.length || 0} />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: `${node.color}22` }}>
        {node.image
          ? <img src={node.image} alt={node.label} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-2xl text-white/70">+</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: node.color }} />
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{node.type}</p>
          {node.role && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-400">
              {node.role.replace(/-/g, ' ')}
            </span>
          )}
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{node.label}</h3>
        <p className="mt-2 text-sm text-gray-300">{node.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label="Confidence" value={`${Math.round((node.confidence || 0) * 100)}%`} />
          <MetricPill label="Bridge" value={`${Math.round((node.metrics?.bridgeScore || 0) * 100)}%`} />
          <MetricPill label="Discovery" value={`${Math.round((node.metrics?.discoveryScore || 0) * 100)}%`} />
          <MetricPill label="Centrality" value={`${Math.round((node.metrics?.centrality || 0) * 100)}%`} />
        </div>
        {node.genres?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {node.genres.slice(0, 5).map((genre) => (
              <span key={genre} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                {genre}
              </span>
            ))}
          </div>
        )}
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
