import { useState } from 'react'
import { CONFIG_DEFAULTS } from '../mockData'
import { Button, Card, Icon, Toggle } from '../components/ui'

type Cfg = typeof CONFIG_DEFAULTS

const PRESETS = [
  { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '通义千问', base: 'https://dashscope.aliyun.com/compatible-mode/v1', model: 'qwen-plus' },
]

function maskKey(k: string) {
  if (k.length <= 10) return '****'
  return k.slice(0, 6) + '****' + k.slice(-4)
}

export function ConfigDemo() {
  const [cfg, setCfg] = useState<Cfg>(CONFIG_DEFAULTS)
  const [saved, setSaved] = useState<Cfg>(CONFIG_DEFAULTS)
  const [apiShow, setApiShow] = useState(false)
  const [toast, setToast] = useState('')

  const set = (k: keyof Cfg, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v }))
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved)

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(''), 1600)
  }
  const save = () => {
    setSaved(cfg)
    showToast('已保存（演示：仅更新本地状态，未写入文件）')
  }
  const applyPreset = (p: (typeof PRESETS)[number]) =>
    setCfg((c) => ({ ...c, llmBaseUrl: p.base, llmModel: p.model }))

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card
        title="配置"
        right={
          <div className="save-hint">
            {dirty ? (
              <span className="dirty">● 有未保存更改</span>
            ) : (
              <span className="saved">● 已保存</span>
            )}
          </div>
        }
      >
        {/* 基础 */}
        <div className="form-row">
          <label>界面语言</label>
          <select className="select" value={cfg.language} onChange={(e) => set('language', e.target.value)}>
            <option value="中文">中文</option>
            <option value="English">English</option>
          </select>
        </div>

        {/* AI 端点 */}
        <div style={{ marginTop: 10, marginBottom: 6, fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
          AI 端点
        </div>
        <div className="form-row">
          <label>常用快捷</label>
          <div className="row">
            {PRESETS.map((p) => (
              <Button key={p.name} variant="ghost" onClick={() => applyPreset(p)}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label>LLM_BASE_URL</label>
          <input className="input mono" value={cfg.llmBaseUrl} onChange={(e) => set('llmBaseUrl', e.target.value)} />
        </div>
        <div className="form-row">
          <label>LLM_MODEL</label>
          <input className="input mono" value={cfg.llmModel} onChange={(e) => set('llmModel', e.target.value)} />
        </div>
        <div className="form-row">
          <label>LLM_API_KEY</label>
          <div className="input-affix">
            <input
              className="input mono"
              type={apiShow ? 'text' : 'password'}
              value={apiShow ? cfg.llmApiKey : maskKey(cfg.llmApiKey)}
              onChange={(e) => set('llmApiKey', e.target.value)}
            />
            <Button variant="ghost" onClick={() => setApiShow((v) => !v)} title={apiShow ? '隐藏' : '显示'}>
              <Icon name={apiShow ? 'eyeOff' : 'eye'} size={14} />
            </Button>
          </div>
        </div>

        {/* 运行参数 */}
        <div style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
          运行参数
        </div>
        <div className="form-row">
          <label>BOSS_USR_NAME</label>
          <input className="input" value={cfg.bossUsrName} onChange={(e) => set('bossUsrName', e.target.value)} />
        </div>
        <div className="form-row">
          <label>BOSS_LABEL</label>
          <input className="input" value={cfg.bossLabel} onChange={(e) => set('bossLabel', e.target.value)} />
        </div>
        <div className="form-row">
          <label>BOSS_MIN_MATCH_SCORE</label>
          <input className="input mono" value={cfg.minMatchScore} onChange={(e) => set('minMatchScore', e.target.value)} />
        </div>
        <div className="form-row">
          <label>BOSS_EXCLUDE_KEYWORDS</label>
          <input className="input" value={cfg.excludeKeywords} onChange={(e) => set('excludeKeywords', e.target.value)} />
        </div>
        <div className="form-row">
          <label>DRY_RUN</label>
          <div className="between" style={{ width: '100%' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              开启后只模拟发送，不真实投递
            </span>
            <Toggle checked={cfg.dryRun} onChange={(v) => set('dryRun', v)} labels={['关闭', '开启']} />
          </div>
        </div>

        {/* 自定义 prompt */}
        <div style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
          自定义招呼语 Prompt
        </div>
        <textarea
          className="textarea"
          value={cfg.customPrompt}
          onChange={(e) => set('customPrompt', e.target.value)}
        />

        <div className="row" style={{ marginTop: 16 }}>
          <Button variant="accent" onClick={save}>
            保存
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setCfg(saved)}>
              放弃更改
            </Button>
          )}
        </div>
      </Card>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
