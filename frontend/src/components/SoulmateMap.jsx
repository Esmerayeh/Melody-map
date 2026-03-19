/**
 * SoulmateMap — D3 force-directed constellation visualisation.
 *
 * Node types:
 *   shared  → bright purple star (centre cluster)
 *   user_a  → blue orbit nodes
 *   user_b  → pink orbit nodes
 */
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const TYPE_CONFIG = {
  shared: { color: '#a78bfa', glow: '#7c3aed', r: 10, emissive: 1.4 },
  user_a: { color: '#60a5fa', glow: '#2563eb', r:  7, emissive: 0.8 },
  user_b: { color: '#f472b6', glow: '#db2777', r:  7, emissive: 0.8 },
}

export default function SoulmateMap({ graph, userAName = 'You', userBName = 'Soulmate', height = 500 }) {
  const svgRef = useRef()

  useEffect(() => {
    if (!graph?.nodes?.length) return
    const el  = svgRef.current
    const W   = el.parentElement.clientWidth || 800
    const H   = height

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('width', W).attr('height', H)

    // ── Defs: glow filters + radial gradient bg ──────────────────────────────
    const defs = svg.append('defs')

    // Background gradient
    const bgGrad = defs.append('radialGradient').attr('id', 'sm-bg')
    bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0f0c29')
    bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#050810')
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'url(#sm-bg)')

    // Glow filter per type
    Object.entries(TYPE_CONFIG).forEach(([type, cfg]) => {
      const f = defs.append('filter').attr('id', `glow-${type}`)
      f.append('feGaussianBlur').attr('stdDeviation', type === 'shared' ? 5 : 3).attr('result', 'blur')
      const merge = f.append('feMerge')
      merge.append('feMergeNode').attr('in', 'blur')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')
    })

    // Starfield
    for (let i = 0; i < 120; i++) {
      svg.append('circle')
        .attr('cx', Math.random() * W).attr('cy', Math.random() * H)
        .attr('r', Math.random() * 1.2)
        .attr('fill', 'white').attr('opacity', Math.random() * 0.35 + 0.05)
    }

    // ── D3 force simulation ──────────────────────────────────────────────────
    const nodes = graph.nodes.map((n) => ({ ...n }))
    const links = graph.links.map((l) => ({ ...l }))

    const sim = d3.forceSimulation(nodes)
      .force('link',   d3.forceLink(links).id((d) => d.id).distance((l) => l.strength > 0.5 ? 80 : 140).strength((l) => l.strength))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(22))
      // Pull shared nodes toward centre
      .force('x', d3.forceX(W / 2).strength((d) => d.type === 'shared' ? 0.15 : 0.03))
      .force('y', d3.forceY(H / 2).strength((d) => d.type === 'shared' ? 0.15 : 0.03))

    // ── Zoom / pan ───────────────────────────────────────────────────────────
    const g    = svg.append('g')
    const zoom = d3.zoom().scaleExtent([0.4, 4]).on('zoom', (e) => g.attr('transform', e.transform))
    svg.call(zoom)

    // ── Links ────────────────────────────────────────────────────────────────
    const linkSel = g.append('g').selectAll('line').data(links).enter().append('line')
      .attr('stroke', (l) => {
        const src = nodes.find((n) => n.id === (l.source?.id ?? l.source))
        return src?.type === 'shared' ? '#7c3aed' : src?.type === 'user_a' ? '#2563eb' : '#db2777'
      })
      .attr('stroke-opacity', (l) => l.strength > 0.5 ? 0.35 : 0.15)
      .attr('stroke-width', (l) => l.strength > 0.5 ? 1.5 : 0.8)

    // ── Tooltip ──────────────────────────────────────────────────────────────
    const tooltip = d3.select('body').selectAll('.sm-tooltip').data([1])
      .join('div').attr('class', 'sm-tooltip')
      .style('position', 'fixed').style('background', 'rgba(10,8,30,0.95)')
      .style('border', '1px solid rgba(167,139,250,0.4)').style('border-radius', '10px')
      .style('padding', '8px 12px').style('pointer-events', 'none')
      .style('font-size', '12px').style('color', '#fff').style('opacity', 0)
      .style('z-index', 9999).style('backdrop-filter', 'blur(8px)')

    // ── Nodes ────────────────────────────────────────────────────────────────
    const nodeSel = g.append('g').selectAll('g.sm-node').data(nodes).enter()
      .append('g').attr('class', 'sm-node').style('cursor', 'pointer')

    // Outer glow ring for shared nodes
    nodeSel.filter((d) => d.type === 'shared')
      .append('circle')
      .attr('r', (d) => TYPE_CONFIG[d.type].r + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => TYPE_CONFIG[d.type].glow)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 2)

    // Main circle
    nodeSel.append('circle')
      .attr('r', (d) => TYPE_CONFIG[d.type].r)
      .attr('fill', (d) => TYPE_CONFIG[d.type].color)
      .attr('filter', (d) => `url(#glow-${d.type})`)
      .attr('opacity', 0.9)
      .on('mouseover', function (event, d) {
        d3.select(this).transition().duration(120).attr('r', TYPE_CONFIG[d.type].r + 4).attr('opacity', 1)
        const typeLabel = d.type === 'shared' ? '⭐ Shared' : d.type === 'user_a' ? `🔵 ${userAName}` : `🩷 ${userBName}`
        tooltip.style('opacity', 1)
          .html(`<div style="font-weight:600">${d.label}</div><div style="color:#a78bfa;font-size:10px;margin-top:2px">${typeLabel}</div>`)
          .style('left', (event.clientX + 12) + 'px').style('top', (event.clientY - 10) + 'px')
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.clientX + 12) + 'px').style('top', (event.clientY - 10) + 'px')
      })
      .on('mouseout', function (event, d) {
        d3.select(this).transition().duration(120).attr('r', TYPE_CONFIG[d.type].r).attr('opacity', 0.9)
        tooltip.style('opacity', 0)
      })

    // Labels
    nodeSel.append('text')
      .text((d) => d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label)
      .attr('text-anchor', 'middle').attr('dy', (d) => TYPE_CONFIG[d.type].r + 13)
      .attr('fill', (d) => TYPE_CONFIG[d.type].color)
      .attr('font-size', (d) => d.type === 'shared' ? 11 : 9)
      .attr('font-weight', (d) => d.type === 'shared' ? 600 : 400)
      .attr('opacity', 0.85)

    // Drag
    nodeSel.call(
      d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end',   (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    )

    // ── Tick ─────────────────────────────────────────────────────────────────
    sim.on('tick', () => {
      linkSel
        .attr('x1', (l) => l.source.x).attr('y1', (l) => l.source.y)
        .attr('x2', (l) => l.target.x).attr('y2', (l) => l.target.y)
      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop(); tooltip.remove() }
  }, [graph, userAName, userBName, height])

  return <svg ref={svgRef} className="w-full" style={{ background: 'transparent' }} />
}
