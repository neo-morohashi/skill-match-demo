import { DIMS } from './constants'
import type { SK, SkillsData, Candidate, GapPri, DimMatch, GapResult, GapSkill, OwnedSkill } from '../data/types'

const DIM_NAMES = ['verb', 'output', 'partner', 'horizon', 'stakes']

function sharedCount(a: SK, b: SK): number {
  let n = 0
  for (const d of DIMS) if (a[d] === b[d]) n++
  return n
}

function highGenerality(idx: number, data: SkillsData): boolean {
  let n = 0
  for (const jp of Object.values(data.jobs)) {
    if (jp.skills.includes(idx)) n++
  }
  return n >= 3
}

function highLearnability(sk: SK, owned: SK[]): boolean {
  if (!owned.length) return false
  return owned.reduce((s, o) => s + sharedCount(o, sk), 0) / owned.length >= 2
}

export function gapPri(sk: SK, owned: SK[], idx: number, data: SkillsData): GapPri {
  const hg = highGenerality(idx, data)
  const hl = highLearnability(sk, owned)
  if (hg && hl)  return 'A'
  if (hg && !hl) return 'B'
  if (!hg && hl) return 'C'
  return 'D'
}

function topDims(owned: SK[], target: SK[], n = 3): DimMatch[] {
  const results: DimMatch[] = []
  for (let di = 0; di < DIMS.length; di++) {
    const d = DIMS[di]
    const ownedByVal = new Map<string, number>()
    for (const o of owned) ownedByVal.set(o[d] as string, (ownedByVal.get(o[d] as string) ?? 0) + 1)

    let best = '', bestCnt = 0
    for (const t of target) {
      const v = t[d] as string
      if (ownedByVal.has(v) && (ownedByVal.get(v) ?? 0) > 0) {
        const cnt = target.filter(x => x[d] === v).length
        if (cnt > bestCnt) { bestCnt = cnt; best = v }
      }
    }
    if (bestCnt > 0) results.push({ key: DIM_NAMES[di], value: best, count: bestCnt })
  }
  return results.sort((a, b) => b.count - a.count).slice(0, n)
}

export function scoreJob(cur: string, tgt: string, data: SkillsData): Candidate | null {
  const cj = data.jobs[cur], tj = data.jobs[tgt]
  if (!cj || !tj || cur === tgt) return null

  const owned  = cj.skills.map(i => data.skills[i]).filter(Boolean)
  const target = tj.skills.map(i => data.skills[i]).filter(Boolean)
  if (!target.length) return null

  // NetworkProximity
  let npSum = 0
  for (const t of target) {
    let max = 0
    for (const o of owned) max = Math.max(max, sharedCount(o, t))
    npSum += max / 5
  }
  const np = npSum / target.length

  // GapFeasibility
  const ownedSet = new Set(cj.skills)
  const gapIdx   = tj.skills.filter(i => !ownedSet.has(i))
  const gapSks   = gapIdx.map(i => data.skills[i]).filter(Boolean)
  let gfSum = 0
  for (const g of gapSks) {
    let max = 0
    for (const o of owned) max = Math.max(max, sharedCount(o, g))
    gfSum += max / 5
  }
  const gf = gapSks.length ? gfSum / gapSks.length : 1

  // SkillOverlap
  const ownedN = tj.skills.filter(i => ownedSet.has(i)).length
  const so = target.length ? ownedN / target.length : 0

  const score = np * 0.55 + gf * 0.30 + so * 0.15

  return {
    jobName: tgt,
    jp: tj,
    score, np, gf, so,
    topDims: topDims(owned, target),
    isAltJF:   tj.jf !== cj.jf,
    isSameCog: tj.cog === cj.cog,
    ownedN,
    gapN: gapIdx.length,
  }
}

export function gapAnalysis(cur: string, tgt: string, data: SkillsData): GapResult {
  const cj = data.jobs[cur], tj = data.jobs[tgt]
  if (!cj || !tj) return { owned: [], gaps: [] }

  const ownedSet = new Set(cj.skills)
  const ownedSks = cj.skills.map(i => data.skills[i]).filter(Boolean)
  const targetSks = tj.skills.map(i => data.skills[i]).filter(Boolean)

  const ownedFixed: OwnedSkill[] = tj.skills
    .filter(i => ownedSet.has(i))
    .map(i => {
      const sk = data.skills[i]
      const resonKeys = DIMS
        .filter(d => targetSks.some(t => t[d] === sk[d]))
        .map(d => DIM_NAMES[d - 4])
      return { sk, resonKeys }
    })

  const gaps: GapSkill[] = tj.skills
    .filter(i => !ownedSet.has(i))
    .map(i => {
      const sk = data.skills[i]
      const sKeys = DIMS.filter(d => ownedSks.some(o => o[d] === sk[d])).map(d => DIM_NAMES[d - 4])
      const avg = ownedSks.length
        ? ownedSks.reduce((s, o) => s + sharedCount(o, sk), 0) / ownedSks.length
        : 0
      return { sk, pri: gapPri(sk, ownedSks, i, data), sharedKeys: sKeys, learnPct: Math.round(avg / 5 * 100) }
    })

  const order: Record<GapPri, number> = { A: 0, B: 1, C: 2, D: 3 }
  gaps.sort((a, b) => order[a.pri] - order[b.pri])

  return { owned: ownedFixed, gaps }
}
