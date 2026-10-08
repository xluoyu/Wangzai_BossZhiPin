import { AccountInfo, PageKey } from '../types'
import { Icon } from './ui'

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: 'run', label: '运行', icon: 'run' },
  { key: 'resume', label: '简历', icon: 'resume' },
  { key: 'history', label: '记录', icon: 'history' },
  { key: 'config', label: '配置', icon: 'config' },
  { key: 'help', label: '帮助', icon: 'help' },
]

export function Sidebar({
  active,
  onChange,
  account,
}: {
  active: PageKey
  onChange: (p: PageKey) => void
  account: AccountInfo
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">B</div>
        <div className="brand-text">
          <div className="brand-title">Boss 自动招呼</div>
          <div className="brand-sub">控制台</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`nav-item ${active === n.key ? 'active' : ''}`}
            onClick={() => onChange(n.key)}
          >
            <Icon name={n.icon} size={18} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="avatar">{account.name.slice(0, 1)}</div>
          <div className="user-meta">
            <div className="user-name">{account.name}</div>
            <div className="user-status">{account.status}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
