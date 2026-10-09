import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ActivityItem, LogLine, ReviewItem, RunStatus, SafeMode, ToastTone } from './types'
import {
  ACTIVITY_TEMPLATES,
  CURRENT_JOB,
  LOG_POOL,
  REVIEW_QUEUE,
  SEED_ACTIVITIES,
  SEED_LOGS,
  STAGES,
  nowTime,
} from './mockData'

interface Metrics {
  scanned: number
  generated: number
  approved: number
  sent: number
  blocked: number
  failed: number
}

const EMPTY_METRICS: Metrics = {
  scanned: 0,
  generated: 0,
  approved: 0,
  sent: 0,
  blocked: 0,
  failed: 0,
}

interface Toast {
  id: number
  msg: string
  tone: ToastTone
}

interface RunState {
  mode: SafeMode
  status: RunStatus
  stopReason: 'done' | 'terminated' | null
  stageIndex: number
  metrics: Metrics
  activities: ActivityItem[]
  logs: LogLine[]
  reviewQueue: ReviewItem[]
  queue: { done: number; total: number }
  currentJob: string
}

interface RunCtx extends RunState {
  setMode: (m: SafeMode) => void
  start: () => void
  pause: () => void
  resume: () => void
  terminate: () => void
  approveReview: (id: string) => void
  skipReview: (id: string) => void
  regenerateReview: (id: string) => void
  updateReviewText: (id: string, greeting: string) => void
  notify: (msg: string, tone?: ToastTone) => void
  toasts: Toast[]
}

const RunContext = createContext<RunCtx | null>(null)

const TICK_MS = 850
const TICKS_PER_STAGE = 3
const TOTAL_TICKS = STAGES.length * TICKS_PER_STAGE

export function RunProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SafeMode>('dry')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [stopReason, setStopReason] = useState<RunState['stopReason']>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)
  const [activities, setActivities] = useState<ActivityItem[]>(SEED_ACTIVITIES)
  const [logs, setLogs] = useState<LogLine[]>(SEED_LOGS)
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>(REVIEW_QUEUE)
  const [queue, setQueue] = useState<{ done: number; total: number }>({ done: 0, total: 150 })
  const [toasts, setToasts] = useState<Toast[]>([])

  const timerRef = useRef<number | null>(null)
  const tickRef = useRef(0)
  const idRef = useRef(0)
  const modeRef = useRef(mode)
  modeRef.current = mode

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  const uid = (p: string) => `${p}${Date.now()}_${idRef.current++}`

  const notify = useCallback((msg: string, tone: ToastTone = 'info') => {
    const id = idRef.current++
    setToasts((list) => [...list, { id, msg, tone }])
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, 2400)
  }, [])

  const pushActivity = useCallback((item: Omit<ActivityItem, 'id' | 'time'>) => {
    setActivities((list) =>
      [{ id: uid('a'), time: nowTime(), ...item }, ...list].slice(0, 50),
    )
  }, [])

  const runLoop = useCallback(() => {
    stopTimer()
    timerRef.current = window.setInterval(() => {
      tickRef.current += 1
      const t = tickRef.current
      const stage = Math.min(Math.floor((t - 1) / TICKS_PER_STAGE), STAGES.length - 1)
      setStageIndex(stage)

      const gen = ACTIVITY_TEMPLATES[(t - 1) % ACTIVITY_TEMPLATES.length]
      setActivities((list) =>
        [{ id: uid('a'), time: nowTime(), ...gen }, ...list].slice(0, 50),
      )

      const lg = LOG_POOL[(t - 1) % LOG_POOL.length]
      setLogs((list) =>
        [...list, { id: uid('l'), time: nowTime(), level: lg.level, text: lg.text }].slice(-160),
      )

      setMetrics((m) => {
        const nm: Metrics = { ...m, scanned: m.scanned + 1 }
        if (gen.kind === 'generate') {
          nm.generated += 1
          if (modeRef.current === 'real') {
            nm.approved += 1
            nm.sent += 1
          }
        }
        if (gen.kind === 'block') nm.blocked += 1
        return nm
      })

      setQueue((q) => ({ ...q, done: Math.min(q.done + 1, q.total) }))

      if (t >= TOTAL_TICKS) {
        stopTimer()
        setStatus('stopped')
        setStopReason('done')
      }
    }, TICK_MS)
  }, [stopTimer])

  const start = useCallback(() => {
    tickRef.current = 0
    setStageIndex(0)
    setStopReason(null)
    setMetrics(EMPTY_METRICS)
    setQueue({ done: 0, total: 150 })
    setActivities(SEED_ACTIVITIES)
    setLogs(SEED_LOGS)
    setReviewQueue(REVIEW_QUEUE)
    runLoop()
    setStatus('running')
    notify(modeRef.current === 'real' ? '已开始真实发送' : '已开始 Dry Run，生成后等待审核', 'info')
  }, [runLoop, notify])

  const setMode = useCallback(
    (m: SafeMode) => {
      setModeState(m)
      notify(
        m === 'real' ? '已切到真实发送模式，校验通过后直接发送' : '已切到 Dry Run，发送前必须人工审核',
        m === 'real' ? 'warn' : 'success',
      )
    },
    [notify],
  )

  const pause = useCallback(() => {
    stopTimer()
    setStatus('paused')
    notify('已暂停队列', 'warn')
  }, [stopTimer, notify])

  const resume = useCallback(() => {
    runLoop()
    setStatus('running')
    notify('已继续运行', 'info')
  }, [runLoop, notify])

  const terminate = useCallback(() => {
    stopTimer()
    setStatus('stopped')
    setStopReason('terminated')
    notify('本轮已停止，日志已保留', 'danger')
  }, [stopTimer, notify])

  const approveReview = useCallback(
    (id: string) => {
      if (modeRef.current === 'real') {
        notify('真实发送模式不进入单条审核流程', 'warn')
        return
      }

      const item = reviewQueue.find((r) => r.id === id)
      if (!item) return
      if (item.status === 'blocked') {
        notify('该条已被拦截，不能直接批准发送', 'danger')
        return
      }

      setReviewQueue((list) =>
        list.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)),
      )
      setMetrics((m) => ({
        ...m,
        approved: m.approved + 1,
        sent: m.sent + 1,
      }))
      pushActivity({
        kind: 'approve',
        target: `${item.job} · ${item.company}`,
        detail: '人工审核通过并发送',
        score: item.score,
      })
      notify('已通过审核并发送', 'success')
      window.setTimeout(() => {
        setReviewQueue((list) => list.filter((r) => r.id !== id))
      }, 900)
    },
    [notify, pushActivity, reviewQueue],
  )

  const skipReview = useCallback(
    (id: string) => {
      const item = reviewQueue.find((r) => r.id === id)
      if (!item) return

      setReviewQueue((list) => list.filter((r) => r.id !== id))
      setMetrics((m) => ({ ...m, blocked: m.blocked + 1 }))
      pushActivity({
        kind: 'skip',
        target: `${item.job} · ${item.company}`,
        detail: item.issue ?? '人工跳过待审核招呼语',
        score: item.score,
      })
      notify('已跳过该条招呼语', 'info')
    },
    [notify, pushActivity, reviewQueue],
  )

  const regenerateReview = useCallback(
    (id: string) => {
      const variants = [
        '您好，我是陈思远，做过 React 性能优化和营销中台重构，最近一次项目把首屏加载从 3.2s 降到 1.1s，和岗位要求比较匹配，想进一步沟通。',
        '您好，我关注到贵司前端岗位。我有 React / TypeScript 项目经验，也做过组件库治理和构建提速，想了解下团队目前的业务方向。',
        '您好，我做过前端工程化、性能优化和微前端落地，简历里有营销中台重构经历，和这个岗位要求有重合，期待进一步沟通。',
      ]
      const next = variants[idRef.current % variants.length]

      setReviewQueue((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                status: r.status === 'blocked' ? 'needs_edit' : 'ready',
                greeting: next,
                checks: ['长度合规', '中文通过', '未命中黑名单', '重复率 0.16'],
                issue: undefined,
              }
            : r,
        ),
      )
      notify('已重新生成招呼语', 'success')
    },
    [notify],
  )

  const updateReviewText = useCallback(
    (id: string, greeting: string) => {
      setReviewQueue((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'ready',
                greeting,
                checks: ['长度合规', '中文通过', '未命中黑名单', '人工已修改'],
                issue: undefined,
              }
            : r,
        ),
      )
      notify('已保存修改并重新校验', 'success')
    },
    [notify],
  )

  const value: RunCtx = {
    mode,
    status,
    stopReason,
    stageIndex,
    metrics,
    activities,
    logs,
    reviewQueue,
    queue,
    currentJob: CURRENT_JOB,
    setMode,
    start,
    pause,
    resume,
    terminate,
    approveReview,
    skipReview,
    regenerateReview,
    updateReviewText,
    notify,
    toasts,
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

export function useRun(): RunCtx {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('useRun must be used within RunProvider')
  return ctx
}
