import { RunStatus } from '../types'
import { Icon } from './ui'

const ENGINE_LABEL: Record<RunStatus, { text: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  idle: { text: '待命', tone: 'neutral' },
  running: { text: '运行中', tone: 'ok' },
  paused: { text: '已暂停', tone: 'warn' },
  stopped: { text: '已停止', tone: 'neutral' },
}

export function TopBar({
  title,
  subtitle,
  engine,
  lastSync,
  onRefresh,
}: {
  title: string
  subtitle: string
  engine: RunStatus
  lastSync: string
  onRefresh: () => void
}) {
  const e = ENGINE_LABEL[engine]
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar-actions">
        <span className="sync">最近同步 {lastSync}</span>
        <span className={`engine-pill engine-${e.tone}`}>
          <i className="dot" />
          {e.text}
        </span>
        <button className="icon-btn" title="通知">
          <Icon name="bell" />
        </button>
        <button className="icon-btn" title="刷新" onClick={onRefresh}>
          <Icon name="refresh" />
        </button>
      </div>
    </header>
  )
}
