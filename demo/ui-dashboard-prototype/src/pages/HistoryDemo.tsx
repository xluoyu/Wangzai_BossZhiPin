import { Fragment, useRef, useState } from 'react'
import { HistoryCheck, HistoryFilter, HistoryRow, HistorySend } from '../types'
import { HISTORY } from '../mockData'
import { Button, Card, Icon, Pill } from '../components/ui'

const SUMMARY = { total: 486, cost: '¥3.27', sent: 32, blocked: 3 }

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'sent', label: '已发送' },
  { key: 'dry', label: 'Dry Run' },
  { key: 'blocked', label: '被拦截' },
  { key: 'fail', label: '失败' },
]

const CHECK_TONE: Record<HistoryCheck, 'ok' | 'warn' | 'danger' | 'accent'> = {
  pass: 'ok',
  blocked: 'danger',
  dry: 'accent',
  fail: 'danger',
}
const CHECK_TEXT: Record<HistoryCheck, string> = {
  pass: '通过',
  blocked: '拦截',
  dry: 'Dry',
  fail: '失败',
}
const SEND_TONE: Record<HistorySend, 'ok' | 'warn' | 'danger' | 'accent'> = {
  sent: 'ok',
  dry: 'accent',
  blocked: 'danger',
  fail: 'danger',
}
const SEND_TEXT: Record<HistorySend, string> = {
  sent: '已发送',
  dry: 'Dry Run',
  blocked: '已拦截',
  fail: '失败',
}

export function HistoryDemo() {
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const timerRef = useRef<number | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setToast(''), 1800)
  }

  const rows: HistoryRow[] = HISTORY.filter((r) => {
    if (filter === 'all') return true
    return r.sendStatus === filter
  })

  const copyLog = (row: HistoryRow) => {
    const text = `[${row.time}] ${row.model} | ${row.job} @ ${row.company}\n校验: ${CHECK_TEXT[row.check]} (${row.reason})\n日志: ${row.log}`
    try {
      navigator.clipboard?.writeText(text)
    } catch {
      /* 演示环境忽略 */
    }
    showToast('已复制此条日志')
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="summary-row">
        <Card>
          <div className="metric">
            <div className="m-value">{SUMMARY.total}</div>
            <div className="m-label">总调用次数（近 7 天）</div>
          </div>
        </Card>
        <Card>
          <div className="metric">
            <div className="m-value">{SUMMARY.cost}</div>
            <div className="m-label">估算成本</div>
          </div>
        </Card>
        <Card>
          <div className="metric">
            <div className="m-value" style={{ color: 'var(--success)' }}>{SUMMARY.sent}</div>
            <div className="m-label">已发送</div>
          </div>
        </Card>
        <Card>
          <div className="metric">
            <div className="m-value" style={{ color: 'var(--danger)' }}>{SUMMARY.blocked}</div>
            <div className="m-label">被拦截</div>
          </div>
        </Card>
      </div>

      <Card
        title="招呼语记录"
        right={
          <div className="filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>岗位 / 公司</th>
              <th>模型</th>
              <th>校验结果</th>
              <th>发送状态</th>
              <th>招呼语摘要</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="mono">{r.time}</td>
                  <td>
                    {r.job} <span className="muted">· {r.company}</span>
                  </td>
                  <td className="mono">{r.model}</td>
                  <td>
                    <Pill tone={CHECK_TONE[r.check]}>{CHECK_TEXT[r.check]}</Pill>
                  </td>
                  <td>
                    <Pill tone={SEND_TONE[r.sendStatus]}>{SEND_TEXT[r.sendStatus]}</Pill>
                  </td>
                  <td style={{ maxWidth: 280 }}>{r.summary}</td>
                </tr>
                {expanded === r.id && (
                  <tr className="row-detail-wrap">
                    <td colSpan={6}>
                      <div className="row-detail">
                        <div className="detail-grid">
                          <span className="k">JD 摘要</span>
                          <span>{r.jd}</span>
                          <span className="k">生成招呼语</span>
                          <span>{r.greeting}</span>
                          <span className="k">校验原因</span>
                          <span>{r.reason}</span>
                          <span className="k">日志片段</span>
                          <span className="codebox">{r.log}</span>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <Button variant="ghost" onClick={() => copyLog(r)}>
                            <Icon name="copy" size={14} />
                            复制此条日志
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="muted" style={{ padding: 16 }}>该筛选条件下暂无记录</div>}
      </Card>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
