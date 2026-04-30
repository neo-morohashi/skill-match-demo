// [idx, name, jf, cog, verb, output, partner, horizon, stakes]
export type SK = [number, string, string, string, string, string, string, string, string]

export interface JP {
  jf: string
  cog: string
  skills: number[]
}

export interface SkillsData {
  jobs: Record<string, JP>
  skills: SK[]
}

export type GapPri = 'A' | 'B' | 'C' | 'D'

export interface Candidate {
  jobName: string
  jp: JP
  score: number
  np: number   // NetworkProximity
  gf: number   // GapFeasibility
  so: number   // SkillOverlap
  topDims: DimMatch[]
  isAltJF: boolean
  isSameCog: boolean
  ownedN: number
  gapN: number
}

export interface DimMatch {
  key: string        // 'verb' | 'output' | ...
  value: string      // shared value
  count: number      // # target skills sharing this value
}

export interface GapSkill {
  sk: SK
  pri: GapPri
  sharedKeys: string[]
  learnPct: number
}

export interface OwnedSkill {
  sk: SK
  resonKeys: string[]   // dim keys that resonate with target
}

export interface GapResult {
  owned: OwnedSkill[]
  gaps: GapSkill[]
}
