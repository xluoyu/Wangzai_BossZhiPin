import { useState } from 'react'
import { PageKey } from './types'
import { ACCOUNT, nowHM } from './mockData'
import { RunProvider, useRun } from './runContext'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { RunDemo } from './pages/RunDemo'
import { ResumeDemo } from './pages/ResumeDemo'
import { HistoryDemo } from './pages/HistoryDemo'
import { ConfigDemo } from './pages/ConfigDemo'
import { HelpDemo } from './pages/HelpDemo'

const PAGE_META: Record<PageKey, { title: string; subtitle: string }> = {
  run: { title: '运行', subtitle: '自动化运行控制台' },
  resume: { title: '简历', subtitle: '简历解析与召回工作台' },
  history: { title: '记录', subtitle: '招呼语生成与发送审计' },
  config: { title: '配置', subtitle: '自动化行为与账号凭据' },
  help: { title: '帮助', subtitle: '诊断中心与常见问题' },
}

function ToastStack() {
  const { toasts } = useRun()
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

function Shell() {
  const [page, setPage] = useState<PageKey>('run')
  const [lastSync, setLastSync] = useState<string>(nowHM())
  const meta = PAGE_META[page]

  return (
    <div className="app">
      <Sidebar active={page} onChange={setPage} account={ACCOUNT} />
      <div className="main">
        <TopBar title={meta.title} subtitle={meta.subtitle} lastSync={lastSync} onRefresh={() => setLastSync(nowHM())} />
        <div className="content">
          {page === 'run' && <RunDemo />}
          {page === 'resume' && <ResumeDemo />}
          {page === 'history' && <HistoryDemo />}
          {page === 'config' && <ConfigDemo />}
          {page === 'help' && <HelpDemo />}
        </div>
      </div>
      <ToastStack />
    </div>
  )
}

export default function App() {
  return (
    <RunProvider>
      <Shell />
    </RunProvider>
  )
}
