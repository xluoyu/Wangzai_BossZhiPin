import { DragEvent, useEffect, useRef, useState } from 'react'
import { RESUME } from '../mockData'
import { useRun } from '../runContext'
import { Button, Icon } from '../components/ui'

export function ResumeDemo() {
  const { notify } = useRun()
  const [fileName, setFileName] = useState(RESUME.fileName)
  const [parseStatus, setParseStatus] = useState(RESUME.parseStatus)
  const [vectorStatus, setVectorStatus] = useState(RESUME.vectorStatus)
  const [drag, setDrag] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const simulateParse = (name: string) => {
    setFileName(name)
    setParseStatus('解析中…')
    setVectorStatus('向量库更新中…')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setParseStatus('已完成解析')
      setVectorStatus('向量库已更新（318 切片）')
      notify('简历解析完成，向量库已更新', 'success')
    }, 1200)
  }

  const onReplace = () => {
    simulateParse('陈思远_前端开发_2026_v2.pdf')
    notify('已选择新简历，开始重新解析', 'info')
  }
  const onReParse = () => {
    setParseStatus('解析中…')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setParseStatus('已完成解析')
      notify('已重新解析当前简历', 'success')
    }, 1200)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    simulateParse('陈思远_前端开发_2026_上传版.pdf')
    notify('已载入文件（演示），开始解析', 'info')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="cols-2 resume-cols">
        {/* 当前简历 + 上传 */}
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">当前简历</h3>
            <span className={parseStatus === '解析中…' ? 'tag tag-danger' : 'tag tag-ok'}>
              {parseStatus}
            </span>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span className="k">文件名</span>
              <span className="v mono">{fileName}</span>
              <span className="k">大小</span>
              <span className="v">{RESUME.size}</span>
              <span className="k">更新时间</span>
              <span className="v mono">{RESUME.updatedAt}</span>
              <span className="k">解析状态</span>
              <span className={`v ${parseStatus === '解析中…' ? 'status-text-warn' : 'status-text-ok'}`}>
                {parseStatus}
              </span>
              <span className="k">向量库</span>
              <span className="v">{vectorStatus}</span>
            </div>

            <div className={`dropzone ${drag ? 'drag' : ''}`} style={{ marginTop: 16 }} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <span className="dz-icon"><Icon name="resume" size={20} /></span>
              <span>
                拖拽 PDF 到此处，或
                <button type="button" className="link-button" onClick={onReplace}>点击选择</button>
                <br />
                <span className="muted" style={{ fontSize: 11 }}>仅本地预览，不上传任何服务器</span>
              </span>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <Button variant="ghost" onClick={onReParse}>
                <Icon name="refresh" size={14} />
                重新解析
              </Button>
              <Button variant="accent" onClick={onReplace}>
                <Icon name="resume" size={14} />
                替换简历
              </Button>
            </div>
          </div>
        </div>

        {/* 召回预览 */}
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">召回预览</h3>
            <span className="muted" style={{ fontSize: 11 }}>向量库检索结果</span>
          </div>
          <div className="panel-body">
            <div className="recall">
              {RESUME.slices.map((s) => (
                <div key={s.id} className="recall-item">
                  <div className="recall-top">
                    <span className="recall-title">{s.title}</span>
                    <span className="recall-hit">{s.hit}</span>
                  </div>
                  <div className="recall-content">{s.content}</div>
                  <div className="recall-source">{s.source}</div>
                </div>
              ))}
            </div>
            <Button variant="ghost" style={{ marginTop: 14 }} onClick={() => notify('已展开全部召回样例', 'info')}>
              <Icon name="eye" size={14} />
              查看完整召回样例
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
