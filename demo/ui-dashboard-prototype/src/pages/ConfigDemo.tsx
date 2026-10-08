import { useState } from 'react'
import { CONFIG_DEFAULTS } from '../mockData'
import { useRun } from '../runContext'
import { Button, Icon, Toggle } from '../components/ui'

type Cfg = typeof CONFIG_DEFAULTS

const PRESETS = [
  { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '通义千问', base: 'https://dashscope.aliyun.com/compatible-mode/v1', model: 'qwen-plus' },
]

export function ConfigDemo() {
  const { notify } = useRun()
  const [cfg, setCfg] = useState<Cfg>(CONFIG_DEFAULTS)
  const [saved, setSaved] = useState<Cfg>(CONFIG_DEFAULTS)
  const [keyEditing, setKeyEditing] = useState(false)
  const [keyVal, setKeyVal] = useState('')
  const [keyShow, setKeyShow] = useState(false)

  const set = (k: keyof Cfg, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v }))
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved)

  const save = () => {
    setSaved(cfg)
    notify('已保存（演示：仅更新本地状态，未写入文件）', 'success')
  }
  const applyPreset = (p: (typeof PRESETS)[number]) =>
    setCfg((c) => ({ ...c, llmBaseUrl: p.base, llmModel: p.model }))

  const commitKey = () => {
    if (keyVal.trim()) set('llmApiKey', `sk-or-v1-${keyVal.trim().slice(0, 4)}****`)
    setKeyEditing(false)
    setKeyVal('')
    notify('API Key 已更新（演示）', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">配置</h3>
          <span className={`save-state ${dirty ? 'dirty' : 'saved'}`}>
            {dirty ? '● 有未保存更改' : '● 已保存'}
          </span>
        </div>
        <div className="panel-body">
          {/* AI 端点 */}
          <div className="group">
            <div className="group-title">AI 端点</div>
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
              {keyEditing ? (
                <div className="input-affix">
                  <input
                    className="input mono"
                    type={keyShow ? 'text' : 'password'}
                    placeholder="粘贴新的 API Key"
                    value={keyVal}
                    onChange={(e) => setKeyVal(e.target.value)}
                    autoFocus
                  />
                  <Button variant="ghost" onClick={() => setKeyShow((v) => !v)} title={keyShow ? '隐藏' : '显示'}>
                    <Icon name={keyShow ? 'eyeOff' : 'eye'} size={14} />
                  </Button>
                  <Button variant="accent" onClick={commitKey}>确认</Button>
                  <Button variant="ghost" onClick={() => { setKeyEditing(false); setKeyVal('') }}>取消</Button>
                </div>
              ) : (
                <div className="key-display">
                  <span className="kd-text">
                    <span className="dot dot-ok" /> 已配置 · {cfg.llmApiKey}
                  </span>
                  <Button variant="ghost" onClick={() => setKeyEditing(true)}>
                    <Icon name="eye" size={14} />
                    替换 Key
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 运行参数 */}
          <div className="group">
            <div className="group-title">运行参数</div>
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
          </div>

          {/* 安全策略 */}
          <div className="group">
            <div className="group-title">安全策略</div>
            <div className="form-row">
              <label>安全模式 (DRY_RUN)</label>
              <div className="between" style={{ width: '100%' }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {cfg.dryRun ? '开启：仅模拟发送，不真实投递' : '关闭：将向 BOSS 真实投递招呼语'}
                </span>
                <Toggle
                  checked={cfg.dryRun}
                  tone="safe"
                  labels={['真实发送', '安全模式']}
                  onChange={(v) => set('dryRun', v)}
                />
              </div>
            </div>
          </div>

          {/* 招呼语 Prompt */}
          <div className="group">
            <div className="group-title">自定义招呼语 Prompt</div>
            <textarea
              className="textarea"
              value={cfg.customPrompt}
              onChange={(e) => set('customPrompt', e.target.value)}
            />
          </div>

          <div className="row" style={{ marginTop: 4 }}>
            <Button variant="accent" onClick={save}>保存</Button>
            {dirty && (
              <Button variant="ghost" onClick={() => { setCfg(saved); notify('已放弃未保存更改', 'info') }}>
                放弃更改
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
