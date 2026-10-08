import { ButtonHTMLAttributes, ReactNode } from 'react'

type Tone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral'

export function Card({
  title,
  right,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || right) && (
        <header className="panel-head">
          {title && <h3 className="panel-title">{title}</h3>}
          {right && <div>{right}</div>}
        </header>
      )}
      <div className={`panel-body ${bodyClass ?? ''}`}>{children}</div>
    </section>
  )
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function Button({
  variant = 'accent',
  children,
  className,
  ...rest
}: {
  variant?: 'accent' | 'ghost' | 'danger' | 'success'
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn-${variant} ${className ?? ''}`} {...rest}>
      {children}
    </button>
  )
}

export function IconButton({
  name,
  title,
  ariaLabel,
  onClick,
}: {
  name: string
  title?: string
  ariaLabel?: string
  onClick?: () => void
}) {
  return (
    <button className="icon-btn" title={title} aria-label={ariaLabel ?? title ?? name} onClick={onClick}>
      <Icon name={name} size={18} />
    </button>
  )
}

// tone 决定“开启”时的语义色：'safe' = 绿色（安全），'danger' = 红色（危险）
export function Toggle({
  checked,
  onChange,
  labels,
  tone = 'danger',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  labels?: [string, string]
  tone?: 'safe' | 'danger'
}) {
  const onColor = checked ? (tone === 'safe' ? 'var(--success)' : 'var(--danger)') : 'var(--bg-elevated)'
  const onBorder = checked
    ? tone === 'safe'
      ? 'rgba(79,179,95,0.5)'
      : 'var(--danger-border)'
    : 'var(--border)'
  return (
    <button
      type="button"
      className="toggle"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={labels ? `${labels[0]} / ${labels[1]}` : '切换开关'}
    >
      <span
        className="toggle-knob"
        style={{ background: onColor, borderColor: onBorder }}
      >
        <span
          className="toggle-knob-dot"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
      {labels && (
        <span className="toggle-labels">
          <span className={!checked ? 'active' : ''}>{labels[0]}</span>
          <span className={checked ? 'active' : ''}>{labels[1]}</span>
        </span>
      )}
    </button>
  )
}

const ICONS: Record<string, ReactNode> = {
  run: <path d="M6 4l14 8-14 8V4z" />,
  resume: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.5" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  config: (
    <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 005 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 14.2H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V4a2 2 0 114 0v.1A1.6 1.6 0 0019.4 9z" />
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 115 0c0 1.6-2.5 2-2.5 3.5" />
      <path d="M12 17h.01" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  play: <path d="M6 4l14 8-14 8V4z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  logs: <path d="M4 5h16M4 10h16M4 15h10M4 20h10" />,
  check: <path d="M5 13l4 4L19 7" />,
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a18 18 0 01-3 3.8M6 6.5A18 18 0 002 12s4 7 10 7a10.9 10.9 0 004-.8" />
      <path d="M9.5 9.5a3 3 0 004.2 4.2" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const path = ICONS[name]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  )
}
