import { Fragment, useState } from 'react'
import { HistoryCheck, HistoryFilter, HistoryRow, HistorySend } from '../types'
import { HISTORY } from '../mockData'
import { useRun } from '../runContext'
import { Button, Icon } from '../components/ui'

const SUMMARY = { total: 486, cost: '¥3.27', sent: 32, blocked: 3 }

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'sent', label: '已发送' },
  { key: 'dry', label: 'Dry Run' },
  { key: 'blocked', label: '被拦截' },
  { key: 'fail', label: '失败' },
]

const CHECK_LABEL: Record<HistoryCheck, string> = {
  pass: '通过',
  blocked: '拦截',
  dry: 'Dry',
  fail: '失败',
}
const CHECK_TAG: Record<HistoryCheck, string> = {
  pass: 'tag-ok',
  blocked: 'tag-danger',
  dry: 'tag-accent',
  fail: 'tag-danger',
}
const SEND_TAG: Record<HistorySend, string> = {
  sent: 'tag-ok',
  dry: 'tag-accent',
  blocked: 'tag-danger',
  fail: 'tag-danger',
}
const SEND_LABEL: Record<HistorySend, string> = {
  sent: '已发送',
  dry: 'Dry Run',
  blocked: '已拦截',
  fail: '失败',
}

export function HistoryDemo() {
  const { notify } = useRun()
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows: HistoryRow[] = HISTORY.filter((r) => filter === 'all' || r.sendStatus === filter)

  const copyLog = (row: HistoryRow) => {
    const text = `[${row.time}] ${row.model} | ${row.job} @ ${row.company}\n校验: ${CHECK_LABEL[row.check]} (${row.reason})\n日志: ${row.log}`
    try {
      navigator.clipboard?.writeText(text)
    } catch {
      /* 演示环境忽略 */
    }
    notify('已复制此条日志', 'success')
  }

  const toggleExpanded = (id: string) => {
    setExpanded((cur) => (cur === id ? null : id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 汇总条 */}
      <div className="audit-summary">
        <div className="as-cell">
          <span className="as-num">{SUMMARY.total}</span>
          <span className="as-label">近 7 天调用</span>
        </div>
        <div className="as-cell">
          <span className="as-num">{SUMMARY.cost}</span>
          <span className="as-label">估算成本</span>
        </div>
        <div className="as-cell">
          <span className="as-num ok">{SUMMARY.sent}</span>
          <span className="as-label">已发送</span>
        </div>
        <div className="as-cell">
          <span className="as-num danger">{SUMMARY.blocked}</span>
          <span className="as-label">被拦截</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">招呼语记录</h3>
          <div className="seg">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={filter === f.key ? 'active' : ''}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body audit-scroll" style={{ padding: 0 }}>
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 14 }}>时间</th>
                <th>岗位 / 公司</th>
                <th>模型</th>
                <th>校验</th>
                <th>发送状态</th>
                <th>招呼语摘要</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className={`row-main ${r.sendStatus}`}>
                    <td className="mono" style={{ paddingLeft: 14 }}>{r.time}</td>
                    <td>
                      {r.job} <span className="muted">· {r.company}</span>
                    </td>
                    <td className="mono">{r.model}</td>
                    <td><span className={`tag ${CHECK_TAG[r.check]}`}>{CHECK_LABEL[r.check]}</span></td>
                    <td><span className={`tag ${SEND_TAG[r.sendStatus]}`}>{SEND_LABEL[r.sendStatus]}</span></td>
                    <td className="summary-cell">{r.summary}</td>
                    <td>
                      <button
                        type="button"
                        className="detail-toggle"
                        aria-expanded={expanded === r.id}
                        onClick={() => toggleExpanded(r.id)}
                      >
                        {expanded === r.id ? '收起' : '展开'}
                      </button>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr className="row-detail">
                      <td colSpan={7}>
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
                        <div style={{ padding: '0 14px 12px' }}>
                          <Button variant="ghost" onClick={() => copyLog(r)}>
                            <Icon name="copy" size={14} />
                            复制此条日志
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="muted" style={{ padding: 18, fontSize: 12.5 }}>该筛选条件下暂无记录</div>
          )}
        </div>
      </div>
    </div>
  )
}
