import { useEffect, useMemo, useState } from 'react'
import { ActivityItem, ReviewItem } from '../types'
import { CURRENT_TARGET, STAGES } from '../mockData'
import { useRun } from '../runContext'
import { Button, Icon } from '../components/ui'
import {
  JobDescriptionDrawer,
  JobDescriptionDrawerData,
} from '../components/JobDescriptionDrawer'

const ACT_LABEL: Record<ActivityItem['kind'], string> = {
  scan: '读取',
  generate: '生成',
  skip: '跳过',
  block: '拦截',
  approve: '批准',
  log: '日志',
}

const REVIEW_LABEL: Record<ReviewItem['status'], string> = {
  ready: '可发送',
  needs_edit: '需处理',
  blocked: '已拦截',
  approved: '已批准',
}

type ReviewFilter = 'all' | ReviewItem['status']

const REVIEW_FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'ready', label: '可发送' },
  { key: 'needs_edit', label: '需处理' },
  { key: 'blocked', label: '已拦截' },
]

export function RunDemo() {
  const run = useRun()
  const {
    mode,
    status,
    stopReason,
    stageIndex,
    metrics,
    activities,
    queue,
    currentJob,
    reviewQueue,
  } = run

  const [logsOpen, setLogsOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmReal, setConfirmReal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [jdDrawer, setJdDrawer] = useState<JobDescriptionDrawerData | null>(null)

  const isReal = mode === 'real'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isStopped = status === 'stopped'
  const isIdle = status === 'idle'

  const progress =
    isIdle ? 0 : isStopped ? 100 : ((stageIndex + 1) / STAGES.length) * 100

  const reviewStats = {
    total: reviewQueue.length,
    ready: reviewQueue.filter((r) => r.status === 'ready').length,
    needs: reviewQueue.filter((r) => r.status === 'needs_edit' || r.status === 'blocked').length,
  }

  const autoSendRows = reviewQueue.map((item) => {
    if (item.status === 'blocked') {
      return {
        item,
        label: isIdle ? '将拦截' : '已拦截',
        detail: item.issue ?? '命中排除规则，未发送',
      }
    }
    if (item.status === 'needs_edit') {
      return {
        item,
        label: isIdle ? '待校验' : '已跳过',
        detail: item.issue ?? '内容校验未达标，未发送',
      }
    }
    return {
      item,
      label: isIdle ? '待发送' : '已发送',
      detail: isIdle ? '启动后校验通过会自动发送' : '校验通过，系统已自动发送招呼语',
    }
  })

  const filteredReviews = useMemo(
    () => reviewQueue.filter((item) => reviewFilter === 'all' || item.status === reviewFilter),
    [reviewFilter, reviewQueue],
  )

  const selectedReview = useMemo(
    () => filteredReviews.find((item) => item.id === selectedReviewId) ?? filteredReviews[0] ?? null,
    [filteredReviews, selectedReviewId],
  )

  useEffect(() => {
    if (!filteredReviews.length) {
      setSelectedReviewId(null)
      return
    }
    if (!selectedReviewId || !filteredReviews.some((item) => item.id === selectedReviewId)) {
      setSelectedReviewId(filteredReviews[0].id)
    }
  }, [filteredReviews, selectedReviewId])

  const onPrimary = () => {
    if (isReal) setConfirmReal(true)
    else run.start()
  }

  const beginEdit = (item: ReviewItem) => {
    setSelectedReviewId(item.id)
    setEditingId(item.id)
    setDraft(item.greeting)
  }

  const saveEdit = (id: string) => {
    const next = draft.trim()
    if (!next) return
    run.updateReviewText(id, next)
    setEditingId(null)
    setDraft('')
  }

  const requestApprove = (item: ReviewItem) => {
    const next = nextReviewAfter(item.id)
    run.approveReview(item.id)
    setSelectedReviewId(next?.id ?? null)
  }

  const nextReviewAfter = (id: string): ReviewItem | null => {
    const index = filteredReviews.findIndex((item) => item.id === id)
    if (index < 0) return filteredReviews[0] ?? null
    return filteredReviews[index + 1] ?? filteredReviews[index - 1] ?? null
  }

  const skipReview = (item: ReviewItem) => {
    const next = nextReviewAfter(item.id)
    run.skipReview(item.id)
    setSelectedReviewId(next?.id ?? null)
  }

  const stageState = (i: number): { cls: string; text: string } => {
    if (isStopped && stopReason === 'done') return { cls: 'done', text: '已完成' }
    if (isIdle) return { cls: 'pending', text: '' }
    if (i < stageIndex) return { cls: 'done', text: '已完成' }
    if (i === stageIndex) return { cls: 'active', text: isPaused ? '已暂停' : '进行中' }
    return { cls: 'pending', text: '' }
  }

  const mCells: { key: string; num: number; label: string; cls?: string }[] = [
    { key: 'scanned', num: metrics.scanned, label: '已扫描岗位' },
    { key: 'generated', num: metrics.generated, label: '已生成招呼语' },
    { key: 'approved', num: metrics.approved, label: isReal ? '校验通过' : '已通过审核' },
    { key: 'sent', num: metrics.sent, label: '已发送', cls: 'send' },
    { key: 'blocked', num: metrics.blocked, label: '被拦截', cls: 'block' },
    { key: 'failed', num: metrics.failed, label: '失败 / 重试', cls: 'fail' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 运行环境摘要 */}
      <div className="status-rail">
        <div className="rail-item">
          <span className="rail-k">
            <span className="dot dot-ok" /> 账号
          </span>
          <span className="rail-v">陈思远</span>
        </div>
        <div className="rail-item">
          <span className="rail-k">
            <span className="dot dot-ok" /> BOSS 状态
          </span>
          <span className="rail-v ok">已连接</span>
        </div>
        <div className="rail-item">
          <span className="rail-k">
            <span className="dot dot-ok" /> 简历
          </span>
          <span className="rail-v">已解析</span>
        </div>
        <div className="rail-item">
          <span className="rail-k">
            <span className="dot dot-ok" /> AI
          </span>
          <span className="rail-v">DeepSeek ready</span>
        </div>
        <div className="rail-item">
          <span className="rail-k">当前模式</span>
          <span className={`rail-v ${isReal ? 'danger' : 'accent'}`}>
            {isReal ? '真实发送' : 'Dry Run'}
          </span>
        </div>
      </div>

      {/* 主控制面板 */}
      <div className={`control-panel ${isReal ? 'risk' : ''}`}>
        {isReal && (
          <div className="cp-risk">
            <Icon name="alert" size={16} />
            <span>
              <b>真实发送模式</b>：系统会自动扫描、生成并发送招呼语，不进入人工审核队列。请确认运行范围无误。
            </span>
          </div>
        )}

        <div className="cp-grid">
          <div className="cp-main">
            <div className="cp-meta">
              当前目标：<b>{CURRENT_TARGET}</b> · 当前岗位：<b>{currentJob}</b>
              <span className="cp-review-stat">
                {isReal ? (
                  <>自动发送 · 校验通过即发送 · 无待审核队列</>
                ) : (
                  <>待审核 <b>{reviewStats.total}</b> · 可发送 {reviewStats.ready} · 需处理 {reviewStats.needs}</>
                )}
              </span>
            </div>
            <div className="cp-stage-label">当前阶段</div>
            <div className={`cp-stage ${isRunning || isPaused ? 'is-active' : ''}`}>
              {isIdle
                ? '待启动'
                : isStopped
                  ? '本轮已结束'
                  : STAGES[stageIndex].label}
            </div>
            <div className="cp-queue">
              队列 <b>{queue.done}</b> / {queue.total}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="cp-side">
            <span className={`status-light ${status}`} />
            <span className="cp-state-text">
              {isIdle && '待命'}
              {isRunning && '运行中'}
              {isPaused && '已暂停'}
              {isStopped && '已停止'}
            </span>
          </div>
        </div>

        <div className="cp-actions">
          {/* 安全模式切换 */}
          <div className="mode-switch" title="切换安全模式" role="radiogroup" aria-label="安全模式">
            <button
              type="button"
              className={`dry ${!isReal ? 'active' : ''}`}
              aria-pressed={!isReal}
              onClick={() => run.setMode('dry')}
            >
              Dry Run
            </button>
            <button
              type="button"
              className={`real ${isReal ? 'active' : ''}`}
              aria-pressed={isReal}
              onClick={() => run.setMode('real')}
            >
              真实发送
            </button>
          </div>

          <div className={`mode-note ${isReal ? 'danger' : ''}`}>
            {isReal
              ? '真实发送：扫描、生成、校验通过后直接发送。'
              : 'Dry Run：扫描并生成招呼语，发送前必须人工审核。'}
          </div>

          <div style={{ flex: 1 }} />

          {(isIdle || isStopped) && (
            <Button variant={isReal ? 'danger' : 'accent'} onClick={onPrimary}>
              <Icon name="play" size={15} />
              {isReal ? '开始真实发送' : '开始 Dry Run'}
            </Button>
          )}
          {isRunning && (
            <>
              <Button variant="ghost" onClick={run.pause}>
                <Icon name="pause" size={15} />
                暂停队列
              </Button>
              <Button variant="ghost" onClick={() => setLogsOpen(true)}>
                <Icon name="logs" size={15} />
                查看实时日志
              </Button>
              <Button variant="danger" onClick={() => setConfirmStop(true)}>
                <Icon name="stop" size={15} />
                终止任务
              </Button>
            </>
          )}
          {isPaused && (
            <>
              <Button variant="accent" onClick={run.resume}>
                <Icon name="play" size={15} />
                继续运行
              </Button>
              <Button variant="ghost" onClick={() => setLogsOpen(true)}>
                <Icon name="logs" size={15} />
                查看实时日志
              </Button>
              <Button variant="danger" onClick={() => setConfirmStop(true)}>
                <Icon name="stop" size={15} />
                终止任务
              </Button>
            </>
          )}
        </div>

        {isStopped && (
          <div className="cp-stopped-note">
            {stopReason === 'done'
              ? '本轮运行已完成，8 个阶段全部通过。可随时再次运行。'
              : '本轮已停止。已发送 / 已写入审计日志的内容不会回滚，可随时重新运行。'}
          </div>
        )}
      </div>

      {/* 待审核 / 自动发送 */}
      <div className={`review-panel ${isReal ? 'auto-send' : ''}`}>
        <div className="review-head">
          <div>
            <h3>{isReal ? '真实发送流水' : '待审核招呼语'}</h3>
            <p>
              {isReal
                ? '真实发送不会产生待审核项，校验通过的招呼语会被系统直接发送。'
                : '生成后先进入人工确认队列，审核通过后才允许发送。'}
            </p>
          </div>
          <div className="review-count">
            <b>{isReal ? metrics.sent : reviewStats.total}</b>
            <span>{isReal ? '条已发送' : '条待确认'}</span>
          </div>
        </div>

        {isReal ? (
          <div className="auto-send-body">
            <div className="auto-send-summary">
              <div>
                <b>{metrics.generated}</b>
                <span>已生成</span>
              </div>
              <div>
                <b>{metrics.approved}</b>
                <span>校验通过</span>
              </div>
              <div>
                <b>{metrics.sent}</b>
                <span>自动发送</span>
              </div>
              <div>
                <b>{metrics.blocked}</b>
                <span>规则拦截</span>
              </div>
            </div>
            <div className="auto-send-note">
              当前模式下，系统只保留发送流水、拦截原因和审计日志；如需逐条查看、编辑或批准，请切换到 Dry Run。
            </div>
            <div className="auto-send-list">
              {autoSendRows.map(({ item, label, detail }) => (
                <div className={`auto-send-row ${item.status}`} key={item.id}>
                  <span className="auto-send-seq">#{item.seq}</span>
                  <span className="auto-send-main">
                    <span className="auto-send-title">{item.job} · {item.company}</span>
                    <span className="auto-send-detail">{detail}</span>
                  </span>
                  <span className="auto-send-score">{item.score}</span>
                  <span className="auto-send-status">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : reviewQueue.length === 0 ? (
          <div className="review-empty">
            当前没有待审核招呼语。运行时生成的新内容会先进入这里等待确认。
          </div>
        ) : (
          <div className="review-workbench">
            <div className="review-queue">
              <div className="review-filters" role="tablist" aria-label="审核队列筛选">
                {REVIEW_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.key}
                    className={reviewFilter === filter.key ? 'active' : ''}
                    aria-pressed={reviewFilter === filter.key}
                    onClick={() => setReviewFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="review-queue-list">
                {filteredReviews.length === 0 ? (
                  <div className="review-empty compact">当前筛选下没有待处理项。</div>
                ) : (
                  filteredReviews.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`review-row ${item.status} ${selectedReview?.id === item.id ? 'active' : ''}`}
                      onClick={() => setSelectedReviewId(item.id)}
                    >
                      <span className="review-row-seq">#{item.seq}</span>
                      <span className="review-row-main">
                        <span className="review-row-title">{item.job} · {item.company}</span>
                        <span className="review-row-meta">
                          {item.score} · {REVIEW_LABEL[item.status]}
                        </span>
                      </span>
                      <span className={`review-row-dot ${item.status}`} />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className={`review-detail ${selectedReview?.status ?? ''}`}>
              {selectedReview ? (
                (() => {
                  const editing = editingId === selectedReview.id
                  const canApprove = selectedReview.status !== 'blocked' && selectedReview.status !== 'approved'
                  return (
                    <>
                      <div className="review-detail-head">
                        <div>
                          <div className="review-title">
                            #{selectedReview.seq} {selectedReview.job}
                            <span> · {selectedReview.company}</span>
                            <button
                              type="button"
                              className="jd-icon-button"
                              aria-label="打开详细 JD"
                              title="详细 JD"
                              onClick={() =>
                                setJdDrawer({
                                  job: selectedReview.job,
                                  company: selectedReview.company,
                                  jd: selectedReview.jd,
                                })
                              }
                            >
                              <Icon name="eye" size={14} />
                            </button>
                          </div>
                          <div className="review-meta">
                            匹配度 <b>{selectedReview.score}</b> · 命中 {selectedReview.evidence.join(' / ')}
                          </div>
                        </div>
                        <span className={`review-status ${selectedReview.status}`}>
                          {REVIEW_LABEL[selectedReview.status]}
                        </span>
                      </div>

                      {selectedReview.issue && <div className="review-issue">{selectedReview.issue}</div>}

                      {editing ? (
                        <div className="review-editor">
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            aria-label="编辑招呼语"
                          />
                          <div className="review-editor-meta">
                            当前 {draft.trim().length} 字 · 保存后重新校验
                          </div>
                        </div>
                      ) : (
                        <div className="review-greeting">{selectedReview.greeting}</div>
                      )}

                      <div className="review-checks">
                        {selectedReview.checks.map((c) => (
                          <span key={c}>{c}</span>
                        ))}
                      </div>

                      <div className="review-actions">
                        {editing ? (
                          <>
                            <Button variant="accent" onClick={() => saveEdit(selectedReview.id)} disabled={!draft.trim()}>
                              保存修改
                            </Button>
                            <Button variant="ghost" onClick={() => { setEditingId(null); setDraft('') }}>
                              取消
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="accent"
                              disabled={!canApprove}
                              onClick={() => requestApprove(selectedReview)}
                            >
                              {selectedReview.status === 'approved'
                                ? '已批准'
                                : '审核通过并发送'}
                            </Button>
                            <Button variant="ghost" onClick={() => beginEdit(selectedReview)}>
                              编辑
                            </Button>
                            <Button variant="ghost" onClick={() => run.regenerateReview(selectedReview.id)}>
                              重新生成
                            </Button>
                            <Button variant="ghost" onClick={() => skipReview(selectedReview)}>
                              跳过
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )
                })()
              ) : (
                <div className="review-empty">请选择左侧队列中的一条招呼语。</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 指标计数条 */}
      <div className="metrics-strip">
        {mCells.map((c) => (
          <div className="m-cell" key={c.key}>
            <span className={`m-num ${c.cls ?? ''}`}>{c.num}</span>
            <span className="m-label">{c.label}</span>
          </div>
        ))}
      </div>

      {/* 阶段进度 + 审计时间线 */}
      <div className="cols-2">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">阶段进度</h3>
            <span className="muted" style={{ fontSize: 11 }}>
              {isIdle ? '未开始' : `${STAGES.length} 个阶段`}
            </span>
          </div>
          <div className="panel-body">
            <div className="stage-list">
              {STAGES.map((s, i) => {
                const st = stageState(i)
                return (
                  <div key={s.key} className={`stage ${st.cls}`}>
                    <span className="stage-dot">
                      {st.cls === 'done' ? <Icon name="check" size={12} /> : i + 1}
                    </span>
                    <span className="stage-label">{s.label}</span>
                    {st.text && <span className="stage-state">{st.text}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">审计时间线</h3>
            <Button variant="ghost" onClick={() => setLogsOpen(true)}>
              <Icon name="logs" size={14} />
              日志
            </Button>
          </div>
          <div className="panel-body" style={{ maxHeight: 380, overflow: 'auto' }}>
            <div className="timeline">
              {activities.map((a) => (
                <div key={a.id} className="tl-item">
                  <span className="tl-time">{a.time}</span>
                  <div className="tl-body">
                    <div className="tl-head">
                      <span className={`tl-tag ${a.kind}`}>{ACT_LABEL[a.kind]}</span>
                      <span className="tl-target">{a.target}</span>
                    </div>
                    <div className="tl-detail">
                      {a.detail}
                      {a.score !== undefined && (
                        <span className="tl-score"> · 匹配度 {a.score}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 日志抽屉 */}
      {logsOpen && (
        <>
          <div className="drawer-mask" onClick={() => setLogsOpen(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="dh-title">
                <Icon name="logs" size={16} />
                实时日志
                <span className="dh-state">
                  {isRunning ? '运行中' : isPaused ? '已暂停' : isStopped ? '已停止' : '待命'}
                </span>
              </div>
              <Button variant="ghost" onClick={() => setLogsOpen(false)}>
                关闭
              </Button>
            </div>
            <div className="drawer-body">
              {run.logs.map((l) => (
                <div key={l.id} className="log-line">
                  <span className="lt">{l.time}</span>
                  <span className={`log-level log-${l.level}`}>[{l.level}]</span>
                  <span>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <JobDescriptionDrawer data={jdDrawer} onClose={() => setJdDrawer(null)} />

      {/* 真实发送二次确认 */}
      {confirmReal && (
        <div className="modal-mask" onClick={() => setConfirmReal(false)}>
          <div className="modal danger" onClick={(e) => e.stopPropagation()}>
            <h3>
              <Icon name="alert" size={18} />
              确认开始真实发送？
            </h3>
            <p>
              真实发送会向 BOSS 直聘真实投递招呼语，校验通过后直接发送且不可撤回。请确认运行前检查全部通过，并清楚发送对象与范围。
            </p>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setConfirmReal(false)}>
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmReal(false)
                  run.start()
                }}
              >
                确认真实发送
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 终止确认 */}
      {confirmStop && (
        <div className="modal-mask" onClick={() => setConfirmStop(false)}>
          <div className="modal danger" onClick={(e) => e.stopPropagation()}>
            <h3>
              <Icon name="alert" size={18} />
              终止当前任务？
            </h3>
            <p>
              终止后本轮运行会停止，已发送 / 已写入审计日志的内容不会回滚。可稍后重新运行。
            </p>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setConfirmStop(false)}>
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmStop(false)
                  run.terminate()
                }}
              >
                确认终止
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
