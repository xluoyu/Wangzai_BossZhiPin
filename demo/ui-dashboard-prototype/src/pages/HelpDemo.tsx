import { useState } from 'react'
import { DIAGNOSTIC, FAQ, HELP_PROMPT } from '../mockData'
import { Button, Card, Icon, Pill } from '../components/ui'

const TONE: Record<string, 'ok' | 'warn' | 'danger'> = {
  ok: 'ok',
  warn: 'warn',
  danger: 'danger',
}

export function HelpDemo() {
  const [open, setOpen] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const copyAskAI = () => {
    try {
      navigator.clipboard?.writeText(HELP_PROMPT)
    } catch {
      /* 演示环境忽略 */
    }
    setToast('已复制「问 AI」诊断信息')
    window.setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="一键求助">
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          把下面的环境体检信息连同你的问题一起发给 AI，可更快定位。内容均为本地摘要，不含隐私。
        </p>
        <Button variant="accent" onClick={copyAskAI}>
          <Icon name="copy" size={14} />
          复制「问 AI」诊断信息
        </Button>
      </Card>

      <Card title="环境体检">
        <div className="diag">
          {DIAGNOSTIC.map((d) => (
            <div key={d.label} className="diag-item">
              <div className="between">
                <span className="d-label">{d.label}</span>
                <Pill tone={TONE[d.status]}>{d.status === 'ok' ? '正常' : d.status}</Pill>
              </div>
              <div className="d-detail">{d.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="常见问题">
        <div className="faq">
          {FAQ.map((f) => {
            const isOpen = open === f.id
            return (
              <div key={f.id} className="faq-item">
                <div className="faq-q" onClick={() => setOpen(isOpen ? null : f.id)}>
                  <span>{f.q}</span>
                  <Icon name="chevron" size={16} />
                </div>
                {isOpen && <div className="faq-a">{f.a}</div>}
              </div>
            )
          })}
        </div>
      </Card>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
