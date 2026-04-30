import { useMemo, useState } from 'react'
import type { Candidate, SkillsData, GapSkill } from '../data/types'
import { gapAnalysis } from '../lib/scoring'
import { DC, DL, dv, COG_LABEL, COG_HEX, PRI_LABEL } from '../lib/constants'

function DimBadge({ dimKey, value }: { dimKey: string; value?: string }) {
  const bg = DC[dimKey]?.bg ?? 'bg-gray-500'
  return (
    <span className={`inline-flex items-center px-2 rounded text-xs font-semibold text-white ${bg}`} style={{ height: 20 }}>
      {value ? `${DL[dimKey]}: ${dv(dimKey, value)}` : DL[dimKey]}
    </span>
  )
}

function WhyBar({ c, curJob }: { c: Candidate; curJob: string }) {
  const max = c.topDims[0]?.count ?? 1
  const cogLabel = COG_LABEL[c.jp.cog] ?? c.jp.cog
  return (
    <div className="mb-4 rounded-xl p-4" style={{ background: '#1e293b', border: '1px solid #334155' }}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>なぜこのJobが候補か</div>
      <div className="space-y-2.5">
        {c.topDims.map((d, i) => (
          <div key={d.key} className="flex items-center gap-3">
            <span className="text-xs w-3 shrink-0" style={{ color: '#334155' }}>{i + 1}</span>
            <DimBadge dimKey={d.key} value={d.value} />
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#0f172a' }}>
              <div
                className={`h-full rounded-full ${DC[d.key]?.bg ?? 'bg-gray-500'}`}
                style={{ width: `${Math.round(d.count / max * 100)}%`, opacity: 0.5 }}
              />
            </div>
            <span className="text-xs shrink-0 w-10 text-right" style={{ color: '#475569' }}>{d.count}件</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #334155' }}>
        <span className="text-sm">{c.isAltJF ? '⚡' : '✦'}</span>
        <span className="text-xs" style={{ color: '#94a3b8' }}>
          {c.isAltJF
            ? `異JF（${c.jp.jf}）だが${c.isSameCog ? `認知モード（${cogLabel}）が一致` : 'スキルネットワークで接続'}`
            : `${c.jp.jf} — 同じ領域のポジション（${curJob}の延長線上）`}
        </span>
      </div>
    </div>
  )
}

function GapCard({ g }: { g: GapSkill }) {
  const cog = g.sk[3]
  const bar = g.learnPct >= 60 ? '#4ade80' : g.learnPct >= 30 ? '#fbbf24' : '#475569'
  const priColors: Record<string, { bg: string; text: string }> = {
    A: { bg: '#7f1d1d', text: '#fca5a5' },
    B: { bg: '#78350f', text: '#fcd34d' },
    C: { bg: '#064e3b', text: '#6ee7b7' },
    D: { bg: '#1e293b', text: '#94a3b8' },
  }
  const pc = priColors[g.pri] ?? priColors.D
  return (
    <div className="p-3 rounded-lg" style={{ background: '#1e293b', border: '1px solid #0f172a' }}>
      <div className="flex items-start gap-2">
        <div
          className="rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
          style={{ width: 22, height: 22, background: pc.bg, color: pc.text }}
        >
          {g.pri}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate" style={{ color: '#f1f5f9' }}>{g.sk[1]}</div>
          {/* Cog tag (1 max) */}
          <div
            className="inline-flex items-center pl-2 my-1"
            style={{ borderLeft: `3px solid ${COG_HEX[cog] ?? '#475569'}` }}
          >
            <span className="text-xs" style={{ color: '#94a3b8' }}>{COG_LABEL[cog] ?? cog}</span>
          </div>
          {/* Dim tags (max 2) */}
          {g.sharedKeys.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {g.sharedKeys.slice(0, 2).map(k => <DimBadge key={k} dimKey={k} />)}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs shrink-0" style={{ color: '#475569' }}>習得しやすさ</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#0f172a' }}>
              <div className="h-full rounded-full" style={{ width: `${g.learnPct}%`, background: bar }} />
            </div>
            <span className="text-xs w-7 text-right" style={{ color: '#475569' }}>{g.learnPct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const PRI_HEADER: Record<string, { bg: string; text: string }> = {
  A: { bg: '#fef2f2', text: '#7f1d1d' },
  B: { bg: '#fffbeb', text: '#78350f' },
  C: { bg: '#ecfdf5', text: '#064e3b' },
  D: { bg: '#f9fafb', text: '#374151' },
}

export function GapPanel({
  curJob, candidate, data,
}: {
  curJob: string
  candidate: Candidate
  data: SkillsData
}) {
  const { owned, gaps } = useMemo(
    () => gapAnalysis(curJob, candidate.jobName, data),
    [curJob, candidate.jobName, data]
  )

  const byPri: Record<string, GapSkill[]> = { A: [], B: [], C: [], D: [] }
  for (const g of gaps) byPri[g.pri].push(g)

  const [openPris, setOpenPris] = useState<Set<string>>(new Set(['A', 'B']))
  const togglePri = (p: string) => setOpenPris(prev => {
    const next = new Set(prev)
    if (next.has(p)) next.delete(p); else next.add(p)
    return next
  })

  return (
    <div className="p-5">
      <WhyBar c={candidate} curJob={curJob} />

      <div className="grid grid-cols-2 gap-5">
        {/* Owned skills */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#94a3b8' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            保有スキル <span className="font-normal" style={{ color: '#475569' }}>({owned.length})</span>
          </h3>
          <div className="space-y-2">
            {owned.length === 0
              ? <p className="text-sm" style={{ color: '#475569' }}>共通スキルなし</p>
              : owned.map((o, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg"
                    style={{
                      background: '#1e293b',
                      borderLeft: '3px solid #22c55e',
                      border: '1px solid #0f172a',
                      borderLeftColor: '#22c55e',
                    }}
                  >
                    <div className="font-medium text-sm mb-1" style={{ color: '#f1f5f9' }}>{o.sk[1]}</div>
                    <div className="flex flex-wrap gap-1">
                      {o.resonKeys.slice(0, 2).map(k => <DimBadge key={k} dimKey={k} />)}
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Gap skills accordion */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#94a3b8' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />
            GAPスキル <span className="font-normal" style={{ color: '#475569' }}>({gaps.length})</span>
          </h3>
          {(['A', 'B', 'C', 'D'] as const).map(p =>
            byPri[p].length > 0 ? (
              <div key={p} className="mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid #334155' }}>
                {/* Accordion header */}
                <button
                  onClick={() => togglePri(p)}
                  className="w-full flex items-center justify-between px-3 py-2"
                  style={{ background: PRI_HEADER[p].bg, border: 'none', cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        width: 18, height: 18,
                        background: PRI_HEADER[p].text,
                        color: PRI_HEADER[p].bg,
                      }}
                    >
                      {p}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: PRI_HEADER[p].text }}>
                      {PRI_LABEL[p]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: PRI_HEADER[p].text }}>{byPri[p].length}件</span>
                    <span style={{ color: PRI_HEADER[p].text, fontSize: 10 }}>{openPris.has(p) ? '▲' : '▼'}</span>
                  </div>
                </button>
                {/* Accordion body */}
                {openPris.has(p) && (
                  <div className="p-2 space-y-2" style={{ background: '#0f172a' }}>
                    {byPri[p].map((g, i) => <GapCard key={i} g={g} />)}
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}
