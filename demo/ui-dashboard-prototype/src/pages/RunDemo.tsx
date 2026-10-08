import { useEffect, useRef, useState } from 'react'
import { ActivityItem, CheckStatus, LogLine, PreCheck, RunStatus, SafeMode } from '../types'
import {
  ACTIVITY_POOL,
  INITIAL_METRICS,
  LOG_POOL,
  nowTime,
  PRECHECKS,
  SEED_ACTIVITIES,
  SEED_LOGS,
  STAGES,
} from '../mockData'
import { Button, Card, Icon, Pill, Toggle } from '../components/ui'

interface Props {
  engine: RunStatus
  setEngine: (s: RunStatus) => void
}

const TICK_MS = 900
const TICKS_PER_STAGE = 2

const ACT_LABEL: Record<ActivityItem['kind'], string> = {
  scan: '读取',
  generate: '生成',
  skip: '跳过',
  block: '拦截',
  log: '日志',
}

export function RunDemo({ engine, setEngine }: Props) {
  const [safeMode, setSafeMode] = useState<SafeMode>('dry')
  const [stageIndex, setStageIndex] = useState(0)
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [activities, setActivities] = useState<ActivityItem[]>(SEED_ACTIVITIES)
  const [logs, setLogs] = useState<LogLine[]>(SEED_LOGS)
  const [logsOpen, setLogsOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  const tickRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const idRef = useRef(0)
  const safeModeRef = useRef(safeMode)
  safeModeRef.current = safeMode

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => stopTimer(), [])

  const uid = (p: string) => `${p}${Date.now()}_${idRef.current++}`

  const run = () => {
    stopTimer()
    timerRef.current = window.setInterval(() => {
      tickRef.current += 1
      const t = tickRef.current
      const stage = Math.min(Math.floor((t - 1) / TICKS_PER_STAGE), STAGES.length - 1)
      setStageIndex(stage)

      setMetrics((m) => ({
        ...m,
        scanned: m.scanned + 1,
        generated: m.generated + (t % 2 === 0 ? 1 : 0),
        approved: m.approved + (t % 3 === 0 ? 1 : 0),
        sent: safeModeRef.current === 'real' ? m.sent + (t % 4 === 0 ? 1 : 0) : m.sent,
        blocked: m.blocked + (t % 5 === 0 ? 1 : 0),
        failed: m.failed,
      }))

      const act = ACTIVITY_POOL[(t - 1) % ACTIVITY_POOL.length]
      setActivities((list) =>
        [{ id: uid('a'), time: nowTime(), kind: act.kind, text: act.text }, ...list].slice(0, 40),
      )

      const lg = LOG_POOL[(t - 1) % LOG_POOL.length]
      setLogs((list) =>
        [...list, { id: uid('l'), time: nowTime(), level: lg.level, text: lg.text }].slice(-120),
      )

      if (t >= STAGES.length * TICKS_PER_STAGE) {
        stopTimer()
        setEngine('stopped')
      }
    }, TICK_MS)
    setEngine('running')
  }

  const start = () => {
    tickRef.current = 0
    setStageIndex(0)
    run()
  }
  const pause = () => {
    stopTimer()
    setEngine('paused')
  }
  const resume = () => run()
  const confirmStopFn = () => {
    stopTimer()
    setEngine('stopped')
    setConfirmStop(false)
  }

  const checks: PreCheck[] = PRECHECKS.map((c) =>
    c.id === 'safety'
      ? {
          ...c,
          status: (safeMode === 'real' ? 'danger' : 'ok') as CheckStatus,
          detail:
            safeMode === 'real'
              ? '真实发送模式（将向 BOSS 真实投递招呼语）'
              : '当前为 Dry Run（仅模拟，不真实发送）',
        }
      : c,
  )

  const progress = ((stageIndex + 1) / STAGES.length) * 100

  return (
    <div className="grid" style={{ gap: 16 }}>
      {/* 运行前检查 */}
      <Card title="运行前检查">
        <div className="precheck-grid">
          {checks.map((c) => (
            <div key={c.id} className={`precheck ${c.status}`}>
              <div className="pc-label">
                <span>{c.label}</span>
                {c.status === 'ok' && <Pill tone="ok">通过</Pill>}
                {c.status === 'warn' && <Pill tone="warn">注意</Pill>}
                {c.status === 'danger' && <Pill tone="danger">风险</Pill>}
              </div>
              <div className="pc-detail">{c.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 安全模式 */}
      <div className={`safe-mode ${safeMode === 'real' ? 'real' : ''}`}>
        <div>
          <div style={{ fontWeight: 700 }}>安全模式</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Dry Run 仅模拟全流程、不真实发送；真实发送会向 BOSS 直聘投递招呼语。
          </div>
        </div>
        <Toggle
          checked={safeMode === 'real'}
          onChange={(v) => setSafeMode(v ? 'real' : 'dry')}
          labels={['Dry Run', '真实发送']}
        />
      </div>

      {/* 主操作区 */}
      <Card title="主操作区">
        {safeMode === 'real' && (
          <div className="danger-banner section-gap">
            <Icon name="alert" size={16} />
            <span>
              真实发送将向 BOSS 直聘真实投递招呼语，且不可撤回。请确认运行前检查全部通过，并清楚发送对象。
            </span>
          </div>
        )}
        <div className="row" style={{ marginTop: safeMode === 'real' ? 12 : 0 }}>
          {engine === 'idle' && (
            <Button
              variant={safeMode === 'real' ? 'danger' : 'accent'}
              onClick={start}
            >
              <Icon name={safeMode === 'real' ? 'play' : 'play'} size={16} />
              {safeMode === 'real' ? '开始真实发送' : '开始 Dry Run'}
            </Button>
          )}
          {engine === 'running' && (
            <>
              <Button variant="ghost" onClick={pause}>
                <Icon name="pause" size={16} />
                暂停队列
              </Button>
              <Button variant="ghost" onClick={() => setLogsOpen(true)}>
                <Icon name="logs" size={16} />
                查看实时日志
              </Button>
              <Button variant="danger" onClick={() => setConfirmStop(true)}>
                <Icon name="stop" size={16} />
                终止任务
              </Button>
            </>
          )}
          {engine === 'paused' && (
            <>
              <Button variant="accent" onClick={resume}>
                <Icon name="play" size={16} />
                继续运行
              </Button>
              <Button variant="ghost" onClick={() => setLogsOpen(true)}>
                <Icon name="logs" size={16} />
                查看实时日志
              </Button>
              <Button variant="danger" onClick={() => setConfirmStop(true)}>
                <Icon name="stop" size={16} />
                终止任务
              </Button>
            </>
          )}
          {engine === 'stopped' && (
            <>
              <Button variant={safeMode === 'real' ? 'danger' : 'accent'} onClick={start}>
                <Icon name="play" size={16} />
                {safeMode === 'real' ? '开始真实发送' : '开始 Dry Run'}
              </Button>
              <Button variant="ghost" onClick={() => setLogsOpen(true)}>
                <Icon name="logs" size={16} />
                查看实时日志
              </Button>
            </>
          )}
        </div>
        {engine !== 'idle' && (
          <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            当前状态：
            {engine === 'running' && '运行中'}
            {engine === 'paused' && '已暂停'}
            {engine === 'stopped' && '运行已结束（本轮共 8 个阶段）'}
          </div>
        )}
      </Card>

      {/* 指标 */}
      <Card title="本次运行指标">
        <div className="metrics">
          <div className="metric">
            <div className="m-value">{metrics.scanned}</div>
            <div className="m-label">已扫描岗位</div>
          </div>
          <div className="metric">
            <div className="m-value">{metrics.generated}</div>
            <div className="m-label">已生成招呼语</div>
          </div>
          <div className="metric">
            <div className="m-value">{metrics.approved}</div>
            <div className="m-label">已通过审核</div>
          </div>
          <div className="metric">
            <div className="m-value">{metrics.sent}</div>
            <div className="m-label">已发送</div>
          </div>
          <div className="metric">
            <div className="m-value">{metrics.blocked}</div>
            <div className="m-label">被拦截</div>
          </div>
          <div className="metric">
            <div className="m-value">{metrics.failed}</div>
            <div className="m-label">失败 / 重试</div>
          </div>
        </div>
      </Card>

      {/* 阶段进度 + 活动流 */}
      <div className="grid grid-2">
        <Card title="当前阶段进度">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="stage-list">
            {STAGES.map((s, i) => {
              const done = engine === 'stopped' || i < stageIndex
              const active = engine !== 'stopped' && i === stageIndex
              const cls = done ? 'done' : active ? 'active' : 'pending'
              return (
                <div key={s.key} className={`stage ${cls}`}>
                  <span className="stage-dot">
                    {done ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  <span className="stage-label">{s.label}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card
          title="最近活动"
          right={
            <Button variant="ghost" onClick={() => setLogsOpen(true)}>
              <Icon name="logs" size={14} />
              日志
            </Button>
          }
        >
          <div className="activity">
            {activities.map((a) => (
              <div key={a.id} className={`act-item act-${a.kind}`}>
                <span className="act-time">{a.time}</span>
                <span className="act-dot" />
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 日志抽屉 */}
      {logsOpen && (
        <>
          <div className="drawer-mask" onClick={() => setLogsOpen(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <strong>实时日志</strong>
              <Button variant="ghost" onClick={() => setLogsOpen(false)}>
                关闭
              </Button>
            </div>
            <div className="drawer-body">
              {logs.map((l) => (
                <div key={l.id} className="log-line">
                  <span className="muted">{l.time}</span>
                  <span className={`log-level log-${l.level}`}>[{l.level}]</span>
                  <span>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 终止确认 */}
      {confirmStop && (
        <div className="modal-mask" onClick={() => setConfirmStop(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>终止当前任务？</h3>
            <p>终止后本轮运行会停止，已发送 / 已写入审计日志的内容不会回滚。可稍后重新「开始 Dry Run」。</p>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setConfirmStop(false)}>
                取消
              </Button>
              <Button variant="danger" onClick={confirmStopFn}>
                确认终止
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
