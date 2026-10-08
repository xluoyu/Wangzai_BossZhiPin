import { useRun } from '../runContext'
import { Icon } from './ui'

const ENGINE_LABEL: Record<string, { text: string; cls: string }> = {
  idle: { text: '待命', cls: 'idle' },
  running: { text: '运行中', cls: 'running' },
  paused: { text: '已暂停', cls: 'paused' },
  stopped: { text: '已停止', cls: 'stopped' },
}

export function TopBar({
  title,
  subtitle,
  lastSync,
  onRefresh,
}: {
  title: string
  subtitle: string
  lastSync: string
  onRefresh: () => void
}) {
  const { status, mode } = useRun()
  const e = ENGINE_LABEL[status]
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar-actions">
        <span className="sync">同步 {lastSync}</span>
        <span className={`engine-tag ${e.cls}`}>
          <i className="dot" />
          {e.text}
          <span style={{ color: mode === 'real' ? 'var(--danger)' : 'var(--text-tertiary)', fontSize: 11 }}>
            · {mode === 'real' ? '真实发送' : 'Dry Run'}
          </span>
        </span>
        <button className="icon-btn" title="通知" aria-label="通知">
          <Icon name="bell" />
        </button>
        <button className="icon-btn" title="刷新" aria-label="刷新同步时间" onClick={onRefresh}>
          <Icon name="refresh" />
        </button>
      </div>
    </header>
  )
}
