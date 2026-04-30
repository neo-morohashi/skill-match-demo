import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import type { SkillsData, Candidate } from './data/types'
import { scoreJob } from './lib/scoring'
import { jfc } from './lib/constants'
import { CandidateRow } from './components/CandidateRow'
import { GapPanel } from './components/GapPanel'

const NetworkView = lazy(() =>
  import('./components/NetworkView').then(m => ({ default: m.NetworkView }))
)

// ── Raw JSON → SkillsData ──────────────────────────────────────────────────
interface RawSkill {
  skill_id: string; job_family: string; major_category: string
  category: string; sub_category: string; skill: string
  primary_jobs: string; cognitive_primary: string
}
interface RawMapping { job: string; skill_id: string }
interface RawData {
  skills: RawSkill[]
  job_skill_mapping: RawMapping[]
}

const COG_V: Record<string, string> = {
  strategic:'design', creative:'create', interpersonal:'collaborate',
  quantitative:'analyze', structural:'structure', execution:'execute',
}
const MC_O: Record<string, string> = {
  'App Development':'system','Business Intelligence':'insight','Business Operations':'process',
  'Clinical Operations':'service','Compensation & Benefits':'talent','Corporate Strategy':'strategy',
  'Customer Success':'service','Cybersecurity':'system','Data Science & AI':'insight',
  'Finance & Control':'report','Governance':'policy','Labor Relations':'talent',
  'Leadership & Strategy':'strategy','Legal & Compliance':'policy','Manufacturing':'process',
  'Marketing Strategy':'campaign','Organizational Dev.':'talent','People Analytics':'insight',
  'Procurement':'logistics','Product Management':'product','Quality Assurance':'process',
  'Sales Excellence':'campaign','Software Engineering':'system','Supply Chain Ops.':'logistics',
  'Supply Chain Planning':'logistics','Talent Management':'talent','UX & Design':'product',
}
const JF_P: Record<string, string> = {
  'Consulting & Project Mgmt':'cross-functional','Data & Analytics':'cross-functional',
  'Finance & Accounting':'stakeholder','Healthcare & Medical':'individual',
  'Human Resources':'individual','Leadership & Executive':'organization',
  'Legal & Compliance':'stakeholder','Marketing & Communications':'external',
  'Operations & Supply Chain':'team','Product & Design':'cross-functional',
  'Sales & Business Dev.':'external','Technology & Engineering':'system',
}
const LONG_KW  = ['strategy','vision','architect','planning','governance','roadmap','leadership','portfolio']
const SHORT_KW = ['operation','execution','automat','analytics','reporting','testing','sourcing']
function toHorizon(s: string) {
  const l = s.toLowerCase()
  if (LONG_KW.some(k => l.includes(k)))  return 'long'
  if (SHORT_KW.some(k => l.includes(k))) return 'short'
  return 'medium'
}
function toStakes(pj: string) {
  const l = pj.toLowerCase()
  if (/ceo|coo|cfo|cto|chro|cmo|chief|board|director|vp/.test(l)) return 'critical'
  if (/\bmanager\b|\blead\b|\bhead\b|principal/.test(l)) return 'high'
  if (/specialist|analyst|engineer|developer|designer|architect/.test(l)) return 'medium'
  return 'low'
}

function transform(raw: RawData): SkillsData {
  const idToIdx: Record<string, number> = {}
  const skills = raw.skills.map((s, i) => {
    idToIdx[s.skill_id] = i
    return [
      i, s.skill, s.job_family, s.cognitive_primary,
      COG_V[s.cognitive_primary] ?? 'execute',
      MC_O[s.major_category]     ?? 'output',
      JF_P[s.job_family]         ?? 'team',
      toHorizon(s.sub_category),
      toStakes(s.primary_jobs),
    ] as SkillsData['skills'][number]
  })

  const jobMap: Record<string, { jf: string; cog: string; skills: Set<number> }> = {}
  for (const m of raw.job_skill_mapping) {
    const idx = idToIdx[m.skill_id]
    if (idx === undefined) continue
    if (!jobMap[m.job]) {
      const sk = raw.skills[idx]
      jobMap[m.job] = { jf: sk.job_family, cog: sk.cognitive_primary, skills: new Set() }
    }
    jobMap[m.job].skills.add(idx)
  }

  const jobs: SkillsData['jobs'] = {}
  for (const [name, { jf, cog, skills: s }] of Object.entries(jobMap)) {
    jobs[name] = { jf, cog, skills: [...s].sort((a, b) => a - b) }
  }
  return { jobs, skills }
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData]       = useState<SkillsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [curJob, setCurJob]   = useState('')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [activeTab, setActiveTab] = useState<'gap' | 'network'>('gap')

  useEffect(() => {
    fetch('/skills.json')
      .then(r => r.json())
      .then((raw: unknown) => {
        const d = (raw as { jobs?: unknown }).jobs
          ? (raw as SkillsData)
          : transform(raw as RawData)
        setData(d)
        const first = Object.keys(d.jobs).sort()[0]
        if (first) setCurJob(first)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Reset tab when selection changes
  useEffect(() => { setActiveTab('gap') }, [selected])

  const candidates = useMemo(() => {
    if (!data || !curJob) return []
    return Object.keys(data.jobs)
      .filter(j => j !== curJob)
      .map(j => scoreJob(curJob, j, data))
      .filter((r): r is Candidate => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  }, [data, curJob])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ color: '#475569' }}>読み込み中…</div>
  )
  if (!data) return (
    <div className="flex items-center justify-center h-screen" style={{ color: '#ef4444' }}>データ読み込み失敗</div>
  )

  const jobList = Object.keys(data.jobs).sort()

  return (
    <div className="flex h-screen" style={{ background: '#0f172a' }}>

      {/* ── Left panel ── */}
      <div className="w-72 flex flex-col shrink-0" style={{ background: '#0a0f1a', borderRight: '1px solid #1e293b' }}>

        {/* Header */}
        <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #3b1f4a 100%)' }}>
          <div className="font-bold text-base" style={{ color: '#f1f5f9' }}>Career Explorer</div>
          <div className="text-xs mt-0.5" style={{ color: '#f9a8d4' }}>美容・デザイン・ビジネス… あらゆるキャリアを探索</div>
        </div>

        {/* Job selector */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #1e293b' }}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#475569' }}>
            現在のJob
          </label>
          <select
            value={curJob}
            onChange={e => { setCurJob(e.target.value); setSelected(null) }}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f1f5f9',
              focusRingColor: '#3b82f6',
            } as React.CSSProperties}
          >
            {jobList.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          {curJob && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: jfc(data.jobs[curJob]?.jf) }} />
              <span className="text-xs" style={{ color: '#475569' }}>
                {data.jobs[curJob]?.jf} · {data.jobs[curJob]?.skills.length} スキル
              </span>
            </div>
          )}
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto">
          {candidates.length === 0
            ? <p className="text-sm text-center mt-10" style={{ color: '#475569' }}>Jobを選択してください</p>
            : candidates.map(c => (
                <CandidateRow
                  key={c.jobName}
                  c={c}
                  selected={selected?.jobName === c.jobName}
                  onClick={() => setSelected(c)}
                />
              ))
          }
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Job header + metric cards */}
            <div className="px-6 pt-5 pb-4 shrink-0" style={{ background: '#0a0f1a', borderBottom: '1px solid #1e293b' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>{selected.jobName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: jfc(selected.jp.jf) }} />
                    <span className="text-sm" style={{ color: '#94a3b8' }}>{selected.jp.jf}</span>
                    {selected.isAltJF && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#4c1d95', color: '#c4b5fd' }}>⟂ 異JF</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  {[
                    { label: '総合',      val: selected.score, color: '#818cf8' },
                    { label: '近接度',    val: selected.np,    color: '#2dd4bf' },
                    { label: 'GAP実現性', val: selected.gf,    color: '#fbbf24' },
                    { label: '一致率',    val: selected.so,    color: '#4ade80' },
                  ].map(m => (
                    <div
                      key={m.label}
                      className="text-center px-3 py-2 rounded-lg"
                      style={{ background: '#0f172a', border: '1px solid #334155', minWidth: 64 }}
                    >
                      <div className="font-bold" style={{ color: m.color, fontSize: 18 }}>{Math.round(m.val * 100)}</div>
                      <div style={{ color: '#475569', fontSize: 10 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex shrink-0" style={{ background: '#0a0f1a', borderBottom: '1px solid #1e293b' }}>
              {(['gap', 'network'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? '#f1f5f9' : '#94a3b8',
                    background: activeTab === tab ? '#1e293b' : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'gap' ? 'GAP分析' : 'スキルネットワーク'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className={`flex-1 min-h-0 ${activeTab === 'network' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
              {activeTab === 'gap' && (
                <GapPanel curJob={curJob} candidate={selected} data={data} />
              )}
              {activeTab === 'network' && (
                <Suspense fallback={
                  <div className="h-16 flex items-center justify-center text-sm" style={{ color: '#475569' }}>
                    ネットワーク読み込み中…
                  </div>
                }>
                  <NetworkView curJob={curJob} tgtJob={selected.jobName} data={data} />
                </Suspense>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: '#475569' }}>
            <div className="text-5xl mb-4">🎨</div>
            <p className="text-lg font-medium" style={{ color: '#94a3b8' }}>候補Jobを選択してください</p>
            <p className="text-sm mt-1">デザイン・美容・マーケティングなど、あらゆる職種間のスキル距離を可視化します</p>
          </div>
        )}
      </div>

    </div>
  )
}
