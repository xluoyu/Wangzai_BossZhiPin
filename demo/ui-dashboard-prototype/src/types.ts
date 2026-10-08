// 全局类型定义。demo 仅使用本地假数据，不依赖真实业务模型。

export type PageKey = 'run' | 'resume' | 'history' | 'config' | 'help'

export type SafeMode = 'dry' | 'real'
export type RunStatus = 'idle' | 'running' | 'paused' | 'stopped'

export type CheckStatus = 'ok' | 'warn' | 'danger'

export interface PreCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

export interface Stage {
  key: string
  label: string
}

export type ActivityKind = 'scan' | 'generate' | 'skip' | 'block' | 'approve' | 'log'

// 审计时间线条目：时间 + 动作类型 + 目标岗位 + 原因/结果（含匹配度）
export interface ActivityItem {
  id: string
  time: string
  kind: ActivityKind
  target: string
  detail: string
  score?: number
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export interface LogLine {
  id: string
  time: string
  level: LogLevel
  text: string
}

export interface ResumeSlice {
  id: string
  title: string
  content: string
  // RAG 召回语境
  hit: string // 被哪条 JD 召回
  source: string // 来源段落标签
}

export type HistoryCheck = 'pass' | 'blocked' | 'dry' | 'fail'
export type HistorySend = 'sent' | 'dry' | 'blocked' | 'fail'
export type HistoryFilter = 'all' | 'sent' | 'dry' | 'blocked' | 'fail'

export interface HistoryRow {
  id: string
  time: string
  job: string
  company: string
  model: string
  check: HistoryCheck
  sendStatus: HistorySend
  summary: string
  jd: string
  greeting: string
  reason: string
  log: string
}

export type ReviewStatus = 'ready' | 'needs_edit' | 'blocked' | 'approved'

export interface ReviewItem {
  id: string
  seq: number
  status: ReviewStatus
  job: string
  company: string
  score: number
  jd: string
  evidence: string[]
  greeting: string
  checks: string[]
  issue?: string
}

export interface FaqItem {
  id: string
  q: string
  a: string
}

export interface AccountInfo {
  name: string
  status: string
}

export type ToastTone = 'info' | 'success' | 'warn' | 'danger'
