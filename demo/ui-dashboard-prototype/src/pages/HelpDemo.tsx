import { useState } from 'react'
import { DIAGNOSTIC, FAQ, HELP_PROMPT, RECENT_ERRORS } from '../mockData'
import { useRun } from '../runContext'
import { Button, Icon } from '../components/ui'

const TONE_DOT: Record<string, string> = {
  ok: 'dot-ok',
  warn: 'dot-warn',
  danger: 'dot-danger',
}

export function HelpDemo() {
  const { notify } = useRun()
  const [open, setOpen] = useState<string | null>(null)

  const copyAskAI = () => {
    try {
      navigator.clipboard?.writeText(HELP_PROMPT)
    } catch {
      /* 演示环境忽略 */
    }
    notify('已复制「问 AI」诊断信息', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 一键求助 */}
      <div className="panel">
        <div className="panel-body">
          <div className="between">
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>遇到问题？把诊断信息交给 AI</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                下面是一段本地环境摘要，连同你的问题一起发送即可，不含隐私。
              </div>
            </div>
            <Button variant="accent" onClick={copyAskAI}>
              <Icon name="copy" size={15} />
              复制「问 AI」诊断信息
            </Button>
          </div>
        </div>
      </div>

      <div className="cols-2">
        {/* 环境体检 */}
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">环境体检</h3>
            <span className="muted" style={{ fontSize: 11 }}>5 项检查</span>
          </div>
          <div className="panel-body">
            <div className="diag-list">
              {DIAGNOSTIC.map((d) => (
                <div className="diag-row" key={d.label}>
                  <span className={`dot ${TONE_DOT[d.status]}`} />
                  <span className="d-label">{d.label}</span>
                  <span className="d-detail">{d.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 最近错误摘要 */}
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">最近错误摘要</h3>
            <span className="muted" style={{ fontSize: 11 }}>近 1 小时</span>
          </div>
          <div className="panel-body">
            <div className="error-feed">
              {RECENT_ERRORS.map((e, i) => (
                <div className="ef-line" key={i}>
                  <span className="ef-time">{e.time}</span>
                  <span className={e.level === 'ERROR' ? 'log-ERROR' : 'log-WARN'}>
                    [{e.level}]
                  </span>
                  <span>{e.text}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" style={{ marginTop: 12 }} onClick={() => notify('已复制完整错误日志', 'info')}>
              <Icon name="copy" size={14} />
              复制完整错误日志
            </Button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">常见问题</h3>
        </div>
        <div className="panel-body" style={{ paddingTop: 8 }}>
          <div className="faq">
            {FAQ.map((f) => {
              const isOpen = open === f.id
              return (
                <div key={f.id} className="faq-item">
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : f.id)}
                  >
                    <span>{f.q}</span>
                    <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-flex' }}>
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  {isOpen && <div className="faq-a">{f.a}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
