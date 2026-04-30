// DIMS: index positions in SK tuple for the 5 network dimensions
export const DIMS = [4, 5, 6, 7, 8] as const

// DL: Dimension Labels (Japanese)
export const DL: Record<string, string> = {
  verb:    '行動様式',
  output:  '成果物',
  partner: '相手',
  horizon: '時間軸',
  stakes:  '賭け金',
}

// DV: Dimension Value labels (Japanese), per dimension key
export const DV: Record<string, Record<string, string>> = {
  verb: {
    design: '設計', create: '創造', collaborate: '協働',
    analyze: '分析', structure: '構造化', execute: '実行',
  },
  output: {
    strategy: '戦略', insight: '洞察', report: 'レポート',
    campaign: '施策', talent: '人材', system: 'システム',
    process: 'プロセス', product: 'プロダクト', policy: 'ポリシー',
    service: 'サービス', logistics: '物流', research: '研究', output: 'その他',
  },
  partner: {
    organization: '組織全体', individual: '個人',
    stakeholder: 'ステークホルダー', external: '外部',
    team: 'チーム', 'cross-functional': 'クロスファンク', system: 'システム',
  },
  horizon: {
    long: '長期', medium: '中期', short: '短期', immediate: '即時',
  },
  stakes: {
    critical: '経営', high: '管理職', medium: '実務', low: 'サポート',
  },
}

export function dv(key: string, val: string): string {
  return DV[key]?.[val] ?? val
}

// DC: Dimension Colors (Tailwind bg class + hex for D3)
export const DC: Record<string, { bg: string; hex: string }> = {
  verb:    { bg: 'bg-blue-500',    hex: '#3b82f6' },
  output:  { bg: 'bg-emerald-500', hex: '#10b981' },
  partner: { bg: 'bg-violet-500',  hex: '#8b5cf6' },
  horizon: { bg: 'bg-amber-500',   hex: '#f59e0b' },
  stakes:  { bg: 'bg-rose-500',    hex: '#f43f5e' },
}

// JFC: Job Family Colors
export const JFC: Record<string, string> = {
  'Leadership & Executive':      '#6366f1',
  'Human Resources':             '#10b981',
  'Technology & Engineering':    '#3b82f6',
  'Finance & Accounting':        '#f59e0b',
  'Marketing & Communications':  '#ec4899',
  'Operations & Supply Chain':   '#f97316',
  'Data & Analytics':            '#06b6d4',
  'Sales & Business Dev.':       '#84cc16',
  'Product & Design':            '#a855f7',
  'Legal & Compliance':          '#6b7280',
  'Consulting & Project Mgmt':   '#14b8a6',
  'Healthcare & Medical':        '#ef4444',
}
export function jfc(jf: string): string {
  return JFC[jf] ?? '#9ca3af'
}

// Cognitive mode labels + border hex
export const COG_LABEL: Record<string, string> = {
  strategic:    '戦略的',
  creative:     'クリエイティブ・美',
  interpersonal:'対人的',
  quantitative: '定量的',
  structural:   '構造的',
  execution:    '実行的',
}
export const COG_HEX: Record<string, string> = {
  strategic:    '#6366f1',
  creative:     '#ec4899',
  interpersonal:'#10b981',
  quantitative: '#3b82f6',
  structural:   '#f59e0b',
  execution:    '#94a3b8',
}

// Priority colors
export const PRI_BG: Record<string, string> = {
  A: 'bg-red-500', B: 'bg-orange-500', C: 'bg-blue-500', D: 'bg-gray-400',
}
export const PRI_LABEL: Record<string, string> = {
  A: '必須・今すぐ', B: '重要・計画的', C: '補助・隙間で', D: '後回し',
}

// Node colors for D3 network
export const NODE_COLOR = {
  current: '#3b82f6',
  target:  '#a855f7',
  shared:  '#22c55e',
} as const
