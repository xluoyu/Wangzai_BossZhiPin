import { useEffect } from 'react'
import { Button, Icon } from './ui'

export interface JobDescriptionDrawerData {
  job: string
  company: string
  jd: string
}

export function JobDescriptionDrawer({
  data,
  onClose,
}: {
  data: JobDescriptionDrawerData | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!data) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [data, onClose])

  if (!data) return null

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <aside
        className="drawer drawer-jd"
        role="dialog"
        aria-modal="true"
        aria-label={`${data.job} · ${data.company}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="dh-title">
            <Icon name="eye" size={16} />
            完整 JD
          </div>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="drawer-jd-body">
          <div className="drawer-jd-title">{data.job}</div>
          <div className="drawer-jd-company">{data.company}</div>
          <pre className="drawer-jd-content">{data.jd}</pre>
        </div>
      </aside>
    </>
  )
}
