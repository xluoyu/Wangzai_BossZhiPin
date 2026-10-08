import { DragEvent, useEffect, useRef, useState } from 'react'
import { RESUME } from '../mockData'
import { Button, Card, Icon, Pill } from '../components/ui'

export function ResumeDemo() {
  const [fileName, setFileName] = useState(RESUME.fileName)
  const [parseStatus, setParseStatus] = useState(RESUME.parseStatus)
  const [vectorStatus, setVectorStatus] = useState(RESUME.vectorStatus)
  const [drag, setDrag] = useState(false)
  const [toast, setToast] = useState('')
  const timerRef = useRef<number | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setToast(''), 1800)
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const simulateParse = (name: string) => {
    setFileName(name)
    setParseStatus('解析中…')
    setVectorStatus('向量库更新中…')
    window.setTimeout(() => {
      setParseStatus('已完成解析')
      setVectorStatus('向量库已更新（318 切片）')
    }, 1200)
  }

  const onReplace = () => {
    simulateParse('陈思远_前端开发_2026_v2.pdf')
    showToast('已选择新简历，开始重新解析')
  }
  const onReParse = () => {
    setParseStatus('解析中…')
    window.setTimeout(() => setParseStatus('已完成解析'), 1200)
    showToast('已触发重新解析')
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    simulateParse('陈思远_前端开发_2026_上传版.pdf')
    showToast('已选择文件（演示），开始解析')
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 左：当前简历 + 上传 */}
        <div className="grid" style={{ gap: 16 }}>
          <Card title="当前简历">
            <div className="detail-grid">
              <span className="k">文件名</span>
              <span className="mono">{fileName}</span>
              <span className="k">大小</span>
              <span>{RESUME.size}</span>
              <span className="k">更新时间</span>
              <span>{RESUME.updatedAt}</span>
              <span className="k">解析状态</span>
              <span>
                <Pill tone={parseStatus === '解析中…' ? 'warn' : 'ok'}>{parseStatus}</Pill>
              </span>
              <span className="k">向量库</span>
              <span>{vectorStatus}</span>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <Button variant="ghost" onClick={onReParse}>
                <Icon name="refresh" size={14} />
                重新解析
              </Button>
              <Button variant="accent" onClick={onReplace}>
                <Icon name="resume" size={14} />
                替换简历
              </Button>
            </div>
          </Card>

          <Card title="上传简历">
            <div
              className={`upload-zone ${drag ? 'drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={onReplace}
            >
              <Icon name="resume" size={28} />
              <div style={{ marginTop: 8 }}>
                拖拽 PDF 到此处，或 <span style={{ color: 'var(--accent)' }}>点击选择</span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                仅支持本地预览，不会上传到任何服务器
              </div>
            </div>
          </Card>
        </div>

        {/* 右：召回预览 */}
        <Card title="简历召回预览">
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            下方为向量库召回的切片示例（假数据）
          </div>
          <div className="slices">
            {RESUME.slices.map((s) => (
              <div key={s.id} className="slice">
                <div className="slice-title">{s.title}</div>
                <div className="slice-content">{s.content}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
