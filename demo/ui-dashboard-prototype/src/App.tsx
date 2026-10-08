import { useEffect, useState } from 'react'
import { PageKey, RunStatus } from './types'
import { ACCOUNT, nowHM } from './mockData'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { RunDemo } from './pages/RunDemo'
import { ResumeDemo } from './pages/ResumeDemo'
import { HistoryDemo } from './pages/HistoryDemo'
import { ConfigDemo } from './pages/ConfigDemo'
import { HelpDemo } from './pages/HelpDemo'

const PAGE_META: Record<PageKey, { title: string; subtitle: string }> = {
  run: { title: '运行', subtitle: '自动化运行总览' },
  resume: { title: '简历', subtitle: '简历解析与召回预览' },
  history: { title: '记录', subtitle: '招呼语生成与发送历史' },
  config: { title: '配置', subtitle: '自动化行为与账号凭据' },
  help: { title: '帮助', subtitle: '诊断与常见问题' },
}

export default function App() {
  const [page, setPage] = useState<PageKey>('run')
  const [engine, setEngine] = useState<RunStatus>('idle')
  const [lastSync, setLastSync] = useState<string>(nowHM())

  // 切换页面时重置引擎状态（demo 内运行状态不跨页保留）
  useEffect(() => {
    setEngine('idle')
  }, [page])

  const meta = PAGE_META[page]

  return (
    <div className="app">
      <Sidebar active={page} onChange={setPage} account={ACCOUNT} />
      <div className="main">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          engine={engine}
          lastSync={lastSync}
          onRefresh={() => setLastSync(nowHM())}
        />
        <div className="content">
          {page === 'run' && <RunDemo engine={engine} setEngine={setEngine} />}
          {page === 'resume' && <ResumeDemo />}
          {page === 'history' && <HistoryDemo />}
          {page === 'config' && <ConfigDemo />}
          {page === 'help' && <HelpDemo />}
        </div>
      </div>
    </div>
  )
}
