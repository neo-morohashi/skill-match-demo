import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import type { SkillsData, SK } from '../data/types'
import { NODE_COLOR, DL, dv, COG_LABEL } from '../lib/constants'

const DIMS_IDX = [4, 5, 6, 7, 8] as const
const DIM_NAMES = ['verb', 'output', 'partner', 'horizon', 'stakes']
const MAX_PER_GROUP = 25
const MAX_EDGES = 300

const EDGE_HEX: Record<string, string> = {
  stakes: '#92400e', horizon: '#db2777',
  partner: '#7c3aed', output: '#059669', verb: '#ea580c',
}

function sharedCount(a: SK, b: SK) {
  let n = 0; for (const d of DIMS_IDX) if (a[d] === b[d]) n++; return n
}

function rarestEdge(a: SK, b: SK, freq: Map<string, number>): { color: string; dimKey: string } {
  let rarest = '', min = Infinity
  for (let di = 0; di < DIMS_IDX.length; di++) {
    const d = DIMS_IDX[di]
    if (a[d] !== b[d]) continue
    const f = freq.get(`${DIM_NAMES[di]}:${a[d] as string}`) ?? 0
    if (f < min) { min = f; rarest = DIM_NAMES[di] }
  }
  return { color: EDGE_HEX[rarest] ?? '#475569', dimKey: rarest || '' }
}

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string; label: string; fullName: string; type: 'current' | 'target' | 'shared'
  cog: string; dims: Record<string, string>; color: string; r: number
}
interface EdgeDatum extends d3.SimulationLinkDatum<NodeDatum> {
  width: number; color: string; dimKey: string
}

interface Tooltip { x: number; y: number; node: NodeDatum }

function buildGraph(curJob: string, tgtJob: string, data: SkillsData) {
  const cj = data.jobs[curJob], tj = data.jobs[tgtJob]
  if (!cj || !tj) return null

  const curSet = new Set(cj.skills), tgtSet = new Set(tj.skills)
  const shared  = tj.skills.filter(i => curSet.has(i))
  const tgtOnly = tj.skills.filter(i => !curSet.has(i))
  const curOnly = cj.skills.filter(i => !tgtSet.has(i))

  const freq = new Map<string, number>()
  for (const s of data.skills)
    for (let di = 0; di < DIMS_IDX.length; di++) {
      const k = `${DIM_NAMES[di]}:${s[DIMS_IDX[di]] as string}`
      freq.set(k, (freq.get(k) ?? 0) + 1)
    }

  const allTgt = [...shared, ...tgtOnly].map(i => data.skills[i]).filter(Boolean)
  const allCur = [...shared, ...curOnly].map(i => data.skills[i]).filter(Boolean)

  const topTgt = [...tgtOnly]
    .map(i => ({ i, s: allCur.filter(c => sharedCount(data.skills[i], c) >= 2).length }))
    .sort((a, b) => b.s - a.s).slice(0, MAX_PER_GROUP).map(x => x.i)
  const topCur = [...curOnly]
    .map(i => ({ i, s: allTgt.filter(t => sharedCount(data.skills[i], t) >= 2).length }))
    .sort((a, b) => b.s - a.s).slice(0, MAX_PER_GROUP).map(x => x.i)

  type E = { idx: number; type: NodeDatum['type'] }
  const entries: E[] = [
    ...shared.map(i => ({ idx: i, type: 'shared' as const })),
    ...topTgt.map(i => ({ idx: i, type: 'target' as const })),
    ...topCur.map(i => ({ idx: i, type: 'current' as const })),
  ]

  const nodes: NodeDatum[] = entries.map(({ idx, type }) => {
    const s = data.skills[idx]
    return {
      id: `s${idx}`, label: s[1].length > 16 ? s[1].slice(0, 14) + '…' : s[1],
      fullName: s[1], type, cog: s[3], color: NODE_COLOR[type], r: 10,
      dims: { verb: s[4], output: s[5], partner: s[6], horizon: s[7], stakes: s[8] },
    }
  })

  type EC = { src: number; tgt: number; cnt: number; color: string; dimKey: string }
  const cands: EC[] = []
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const cnt = sharedCount(data.skills[entries[i].idx], data.skills[entries[j].idx])
      if (cnt < 2) continue
      const { color, dimKey } = rarestEdge(data.skills[entries[i].idx], data.skills[entries[j].idx], freq)
      cands.push({ src: entries[i].idx, tgt: entries[j].idx, cnt, color, dimKey })
    }
  cands.sort((a, b) => b.cnt - a.cnt)

  const idMap = new Map(nodes.map(n => [n.id, n]))
  const edges: EdgeDatum[] = cands.slice(0, MAX_EDGES).map((e, i) => ({
    id: `e${i}`,
    source: idMap.get(`s${e.src}`) ?? `s${e.src}`,
    target: idMap.get(`s${e.tgt}`) ?? `s${e.tgt}`,
    width: e.cnt === 2 ? 2.2 : e.cnt === 3 ? 5 : e.cnt === 4 ? 9 : 14,
    color: e.color,
    dimKey: e.dimKey,
  }))

  return { nodes, edges }
}

export function NetworkView({ curJob, tgtJob, data }: { curJob: string; tgtJob: string; data: SkillsData }) {
  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const linkRef      = useRef<d3.Selection<SVGLineElement, EdgeDatum, SVGGElement, unknown> | null>(null)
  const activeDimsRef = useRef<Set<string>>(new Set(Object.keys(EDGE_HEX)))

  const [tooltip, setTooltip]       = useState<Tooltip | null>(null)
  const [activeDims, setActiveDims]  = useState<Set<string>>(new Set(Object.keys(EDGE_HEX)))
  const [svgHeight, setSvgHeight]    = useState(420)

  // Track container height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const h = e.contentRect.height
        if (h > 100) setSvgHeight(h)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()
    setTooltip(null)
    linkRef.current = null

    const W = svgRef.current!.clientWidth || 600
    const H = svgRef.current!.clientHeight || svgHeight

    const graph = buildGraph(curJob, tgtJob, data)
    if (!graph) return

    const { nodes, edges } = graph

    const g = svg.append('g')

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr('transform', e.transform.toString())
          setTooltip(null)
        })
    )

    const sim = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, EdgeDatum>(edges).id(d => d.id).distance(60).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(14))
      .force('radial', d3.forceRadial<NodeDatum>(
        d => d.type === 'shared' ? 40 : d.type === 'target' ? 120 : 230,
        W / 2, H / 2
      ).strength(0.35))

    const link = g.append('g').selectAll<SVGLineElement, EdgeDatum>('line')
      .data(edges).join('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.width)
      .attr('stroke-opacity', d => activeDimsRef.current.has(d.dimKey) ? 0.5 : 0.05)

    linkRef.current = link

    const node = g.append('g').selectAll<SVGGElement, NodeDatum>('g')
      .data(nodes).join('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, NodeDatum>()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
          .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    node.append('circle')
      .attr('r', 9)
      .attr('fill', d => d.color)
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1.5)

    node.append('text')
      .attr('dy', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#64748b')
      .text(d => d.label)

    node
      .on('mouseover', (_, d) => {
        const connected = new Set<string>([d.id])
        edges.forEach(e => {
          const s = (e.source as NodeDatum).id, t = (e.target as NodeDatum).id
          if (s === d.id) connected.add(t)
          if (t === d.id) connected.add(s)
        })
        node.attr('opacity', n => connected.has(n.id) ? 1 : 0.1)
        link.attr('opacity', e => {
          const s = (e.source as NodeDatum).id, t = (e.target as NodeDatum).id
          if (s !== d.id && t !== d.id) return 0.03
          return activeDimsRef.current.has(e.dimKey) ? 0.8 : 0.03
        })
      })
      .on('mouseout', () => {
        node.attr('opacity', 1)
        link.attr('opacity', (e: EdgeDatum) => activeDimsRef.current.has(e.dimKey) ? 0.5 : 0.05)
      })
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation()
        const rect = svgRef.current!.getBoundingClientRect()
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d })
      })

    svg.on('click', () => setTooltip(null))

    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as NodeDatum).x ?? 0)
        .attr('y1', d => (d.source as NodeDatum).y ?? 0)
        .attr('x2', d => (d.target as NodeDatum).x ?? 0)
        .attr('y2', d => (d.target as NodeDatum).y ?? 0)
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop() }
  }, [curJob, tgtJob, data, svgHeight])

  // Update link opacity when activeDims changes (without restarting sim)
  useEffect(() => {
    activeDimsRef.current = activeDims
    if (!linkRef.current) return
    linkRef.current.attr('opacity', (e: EdgeDatum) => activeDims.has(e.dimKey) ? 0.5 : 0.05)
  }, [activeDims])

  const TYPE_COLOR = { current: NODE_COLOR.current, target: NODE_COLOR.target, shared: NODE_COLOR.shared }
  const TYPE_LABEL = { current: '現在Job', target: '候補Job', shared: '共通' }

  const toggleDim = (k: string) => setActiveDims(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden m-5" style={{ background: '#1e293b', border: '1px solid #334155' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid #334155' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="font-semibold text-sm" style={{ color: '#94a3b8' }}>スキルネットワーク</div>
          {(['current', 'target', 'shared'] as const).map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
              <span className="text-xs" style={{ color: '#64748b' }}>
                {t === 'current' ? curJob : t === 'target' ? tgtJob : TYPE_LABEL[t]}
              </span>
            </div>
          ))}
        </div>
        {/* Dim toggle buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(EDGE_HEX).map(([k, c]) => (
            <button
              key={k}
              onClick={() => toggleDim(k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 6,
                background: activeDims.has(k) ? '#0f172a' : 'transparent',
                border: `1px solid ${activeDims.has(k) ? c : '#334155'}`,
                opacity: activeDims.has(k) ? 1 : 0.4,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ width: 12, height: 2, borderRadius: 1, background: c }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{DL[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-0" style={{ background: '#0f172a' }}>
        <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }} />

        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none rounded-xl shadow-xl overflow-hidden"
            style={{
              left: tooltip.x + (tooltip.x > 380 ? -230 : 14),
              top:  tooltip.y + (tooltip.y > 300 ? -170 : -10),
              width: 220,
              border: `2px solid ${TYPE_COLOR[tooltip.node.type]}`,
            }}
          >
            <div className="px-3 py-2" style={{ background: TYPE_COLOR[tooltip.node.type] }}>
              <div className="font-semibold text-xs leading-tight" style={{ color: '#fff' }}>{tooltip.node.fullName}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {TYPE_LABEL[tooltip.node.type]} · {COG_LABEL[tooltip.node.cog] ?? tooltip.node.cog}
              </div>
            </div>
            <div className="px-3 py-2 space-y-1" style={{ background: '#1e293b' }}>
              {Object.entries(tooltip.node.dims).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-xs w-14" style={{ color: '#475569' }}>{DL[k]}</span>
                  <span className="text-xs font-medium" style={{ color: '#f1f5f9' }}>{dv(k, v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-xs" style={{ borderTop: '1px solid #334155', color: '#334155' }}>
        スクロール: ズーム ・ ドラッグ: 移動 ・ ノードクリック: 詳細
      </div>
    </div>
  )
}
