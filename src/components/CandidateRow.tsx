import type { Candidate } from '../data/types'
import { DC, DL, dv, jfc } from '../lib/constants'

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 60 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#475569'
  return (
    <div
      className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0"
      style={{ borderColor: color, color }}
    >
      {pct}
    </div>
  )
}

export function CandidateRow({
  c, selected, onClick,
}: {
  c: Candidate
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
      style={{
        borderBottom: '1px solid #1e293b',
        borderLeft: selected ? '3px solid #3b82f6' : '3px solid transparent',
        background: selected ? '#1e3a5f' : 'transparent',
      }}
    >
      <ScoreRing score={c.score} />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" style={{ color: '#f1f5f9' }}>{c.jobName}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: jfc(c.jp.jf) }} />
          <span className="text-xs truncate" style={{ color: '#94a3b8' }}>{c.jp.jf}</span>
        </div>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {c.isAltJF && (
            <span
              className="px-1.5 rounded text-xs font-semibold"
              style={{ lineHeight: '20px', background: '#4c1d95', color: '#c4b5fd' }}
            >
              ⟂異JF
            </span>
          )}
          {c.topDims.slice(0, 2).map(d => (
            <span
              key={d.key}
              className={`px-1.5 rounded text-xs font-semibold text-white ${DC[d.key]?.bg ?? 'bg-gray-500'}`}
              style={{ lineHeight: '20px' }}
              title={`${DL[d.key]}: ${dv(d.key, d.value)} — ${d.count}件`}
            >
              {DL[d.key]}
            </span>
          ))}
        </div>
      </div>

      <div className="text-xs text-right shrink-0 leading-5" style={{ color: '#475569' }}>
        <div>共有 {c.ownedN}</div>
        <div>GAP {c.gapN}</div>
      </div>
    </button>
  )
}
