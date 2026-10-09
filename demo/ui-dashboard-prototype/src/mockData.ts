import {
  AccountInfo,
  ActivityItem,
  CheckStatus,
  FaqItem,
  HistoryRow,
  LogLine,
  PreCheck,
  ReviewItem,
  ResumeSlice,
  Stage,
} from './types'

export const ACCOUNT: AccountInfo = { name: '陈思远', status: 'Boss 直聘 · 已连接' }

export const APP_VERSION = 'v0.4.2 (demo)'

// 运行环境摘要（status rail 用）
export const ENV = {
  account: '陈思远',
  boss: '已连接',
  resume: '已解析',
  ai: 'DeepSeek ready',
}

export const CURRENT_TARGET = '前端开发（上海）'
export const CURRENT_JOB = '前端开发工程师 · 星河互动'

export const PRECHECKS: PreCheck[] = [
  { id: 'resume', label: '简历', status: 'ok', detail: '陈思远_前端开发_2026.pdf · 更新于 09:30' },
  { id: 'ai', label: 'AI 端点', status: 'ok', detail: 'DeepSeek · deepseek-chat · Key 已配置' },
  { id: 'chrome', label: 'Chrome 登录态', status: 'ok', detail: '已连接，登录有效期 7 天' },
  { id: 'safety', label: '安全模式', status: 'ok', detail: '当前为 Dry Run（生成后需人工审核）' },
]

export const STAGES: Stage[] = [
  { key: 'open', label: '打开 BOSS' },
  { key: 'auth', label: '检查登录态' },
  { key: 'list', label: '读取岗位列表' },
  { key: 'jd', label: '抓取 JD' },
  { key: 'gen', label: '生成招呼语' },
  { key: 'verify', label: '校验内容' },
  { key: 'send', label: '发送 / 跳过' },
  { key: 'log', label: '写入日志' },
]

// 审计时间线初始条目（结构化：动作 / 目标岗位 / 原因结果）
export const SEED_ACTIVITIES: ActivityItem[] = [
  { id: 'a1', time: '09:41:12', kind: 'scan', target: '前端开发工程师 · 星河互动', detail: '读取岗位与 JD' },
  { id: 'a2', time: '09:41:20', kind: 'generate', target: '前端开发工程师 · 星河互动', detail: '生成通过校验', score: 0.82 },
  { id: 'a3', time: '09:41:33', kind: 'skip', target: '高级前端 · 云栖科技', detail: '经验要求 5 年，当前 3 年' },
  { id: 'a4', time: '09:41:40', kind: 'block', target: 'React 开发 · 某外包公司', detail: '命中排除关键词「外包」' },
  { id: 'a5', time: '09:41:55', kind: 'log', target: 'letters.jsonl', detail: '写入审计日志 batch-2026-10-08-09' },
]

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: 'r1',
    seq: 69,
    status: 'ready',
    job: '前端开发工程师',
    company: '星河互动',
    score: 0.82,
    jd:
      '岗位职责：负责 C 端活动页与业务中台前端开发，参与核心页面性能优化、组件库建设与埋点治理；与产品、设计、后端协作推进需求落地。\n\n任职要求：3 年以上 React / TypeScript 经验，熟悉 Vite、状态管理、浏览器性能分析；有复杂表单、营销活动或中后台系统经验优先。\n\n加分项：有首屏性能优化、组件库治理、自动化测试经验。',
    evidence: ['React 性能优化', '营销中台重构', '首屏加载 3.2s→1.1s'],
    greeting:
      '您好，我是陈思远，3 年 React 经验，主导过营销中台重构，首屏加载从 3.2s 优化到 1.1s，和岗位要求比较契合，想进一步沟通。',
    checks: ['长度合规', '中文通过', '未命中黑名单', '重复率 0.18'],
  },
  {
    id: 'r2',
    seq: 70,
    status: 'needs_edit',
    job: '高级前端开发',
    company: '云栖科技',
    score: 0.76,
    jd:
      '岗位职责：负责中后台平台的前端架构设计、微前端接入、公共组件沉淀与工程化规范建设；推动研发流程提效。\n\n任职要求：熟悉 React / TypeScript，理解微前端方案，有组件库、脚手架或构建优化实践；能独立推进跨团队协作。\n\n风险提示：岗位标题为高级前端，部分职责偏架构，需要突出具体成果。',
    evidence: ['微前端 qiankun', '构建提速', '组件库治理'],
    greeting:
      '您好，看到贵司高级前端岗位，我做过 qiankun 微前端落地、组件库治理和构建提速，希望有机会进一步沟通岗位细节。',
    checks: ['长度合规', '中文通过', '语气略模板化'],
    issue: '建议编辑：突出一个具体成果，减少泛化表达。',
  },
  {
    id: 'r3',
    seq: 71,
    status: 'blocked',
    job: 'React 开发',
    company: '某外包公司',
    score: 0.41,
    jd:
      '岗位职责：驻场参与客户侧 React 项目开发，按需求完成业务组件与页面交付，配合项目经理进行进度汇报。\n\n任职要求：熟悉 React，能接受驻场工作节奏，有外包项目经验优先。\n\n风险提示：岗位描述包含「外包」「驻场」等排除关键词，且匹配度低于当前阈值。',
    evidence: ['React 业务组件', '驻场交付'],
    greeting: '（已拦截）岗位含排除关键词「外包」，不建议发送。',
    checks: ['命中排除关键词', '低于匹配阈值', '禁止直接发送'],
    issue: '命中排除关键词「外包」，需跳过或重新生成为 SKIP 记录。',
  },
]

export const SEED_LOGS: LogLine[] = [
  { id: 'l1', time: '09:40:01', level: 'INFO', text: '引擎启动，加载配置 .env' },
  { id: 'l2', time: '09:40:02', level: 'DEBUG', text: 'Chrome profile: /profiles/boss-default' },
  { id: 'l3', time: '09:40:05', level: 'INFO', text: 'AI 端点连通性检测通过 (DeepSeek)' },
  { id: 'l4', time: '09:41:55', level: 'INFO', text: 'audit log flushed: batch-2026-10-08-09' },
]

// 运行中循环生成的审计条目模板
export const ACTIVITY_TEMPLATES: Omit<ActivityItem, 'id' | 'time'>[] = [
  { kind: 'scan', target: '高级前端开发 · 云栖科技', detail: '读取岗位与 JD' },
  { kind: 'generate', target: '高级前端开发 · 云栖科技', detail: '生成通过校验', score: 0.79 },
  { kind: 'skip', target: '前端专家 · 远方科技', detail: '城市不匹配（要求 北京）' },
  { kind: 'block', target: 'React 开发 · 某外包公司', detail: '命中排除关键词「外包」' },
  { kind: 'generate', target: '前端架构师 · 启明网络', detail: '生成通过校验', score: 0.88 },
  { kind: 'scan', target: '前端开发 · 海纳信息', detail: '读取岗位与 JD' },
  { kind: 'log', target: 'letters.jsonl', detail: '写入审计日志' },
  { kind: 'generate', target: '资深前端 · 极光软件', detail: '生成通过校验', score: 0.85 },
]

export const LOG_POOL: { level: LogLine['level']; text: string }[] = [
  { level: 'INFO', text: 'open boss.zhipin.com job list' },
  { level: 'DEBUG', text: 'parse JD html, length=1823' },
  { level: 'INFO', text: 'call LLM: deepseek-chat, tokens=512' },
  { level: 'INFO', text: 'content verify pass, score=0.82' },
  { level: 'WARN', text: 'template repetition 0.31, within limit' },
  { level: 'INFO', text: 'greeting appended to queue' },
  { level: 'DEBUG', text: 'audit log flushed' },
]

export const RESUME = {
  fileName: '陈思远_前端开发_2026.pdf',
  size: '2.4 MB',
  updatedAt: '2026-10-08 09:30',
  parseStatus: '已完成解析',
  vectorStatus: '向量库已更新（312 切片）',
  slices: [
    {
      id: 's1',
      title: '项目经历',
      content: '主导公司内 C 端营销中台重构，负责组件库与构建提速，首屏加载从 3.2s 降至 1.1s。',
      hit: '被「前端开发工程师 · 星河互动」召回',
      source: '来源：第 2 页 / 工作经历',
    },
    {
      id: 's2',
      title: '技术栈',
      content: 'React / TypeScript / Vite / Node.js / 微前端 qiankun / 单元测试 Vitest。',
      hit: '被「前端架构师 · 启明网络」召回',
      source: '来源：第 1 页 / 技能清单',
    },
    {
      id: 's3',
      title: '业务成果',
      content: '建立前端发布卡口与自动化回归，线上故障率下降 41%；带教 2 名应届生。',
      hit: '被「资深前端 · 极光软件」召回',
      source: '来源：第 3 页 / 业绩',
    },
    {
      id: 's4',
      title: '软技能',
      content: '跨团队推动设计-研发协作规范，输出 12 篇内部技术文档。',
      hit: '被「高级前端 · 云栖科技」召回',
      source: '来源：第 4 页 / 自我评价',
    },
  ] as ResumeSlice[],
}

export const HISTORY: HistoryRow[] = [
  { id: 'h1', time: '09:41:20', job: '前端开发工程师', company: '星河互动', model: 'deepseek-chat', check: 'pass', sendStatus: 'dry', summary: '您好，看到贵司前端岗位与我的 React 经验契合…', jd: '岗位职责：负责 C 端活动页与业务中台前端开发，参与核心页面性能优化、组件库建设与埋点治理；与产品、设计、后端协作推进需求落地。\n\n任职要求：3 年以上 React / TypeScript 经验，熟悉 Vite、状态管理、浏览器性能分析；有复杂表单、营销活动或中后台系统经验优先。\n\n加分项：有首屏性能优化、组件库治理、自动化测试经验。', greeting: '您好，我是陈思远，3 年 React 经验，主导过营销中台重构，首屏优化 3.2s→1.1s。', reason: 'Dry Run 模式，已生成并等待人工审核', log: 'INFO verify pass score=0.82' },
  { id: 'h2', time: '09:39:05', job: '高级前端开发', company: '云栖科技', model: 'deepseek-chat', check: 'pass', sendStatus: 'sent', summary: '您好，我在前端性能优化与微前端有较多实践…', jd: '岗位职责：负责中后台平台的前端架构设计、微前端接入、公共组件沉淀与工程化规范建设；推动研发流程提效。\n\n任职要求：熟悉 React / TypeScript，理解微前端方案，有组件库、脚手架或构建优化实践；能独立推进跨团队协作。\n\n优先条件：有 qiankun、Module Federation 或大型前端项目拆分经验。', greeting: '您好，我做过 qiankun 微前端落地与构建提速，欢迎进一步沟通。', reason: '真实发送模式，匹配度 0.79 校验通过后自动发送', log: 'INFO sent ok' },
  { id: 'h3', time: '09:38:40', job: '前端架构师', company: '启明网络', model: 'deepseek-chat', check: 'blocked', sendStatus: 'blocked', summary: '（已拦截）模板重复率过高', jd: '岗位职责：负责前端整体架构规划、技术规范制定与核心基础设施建设；推动多团队统一开发、测试和发布流程。\n\n任职要求：8 年以上前端开发经验，熟悉 React、TypeScript、Node.js 和大型项目工程化；具备技术方案评审和团队协作能力。\n\n关注重点：需要具备复杂业务拆分、性能治理和持续交付体系建设经验。', greeting: '（拦截）检测到模板重复率 0.41 超过上限 0.35。', reason: '模板重复率 0.41 超过 0.35 上限', log: 'WARN blocked repetition' },
  { id: 'h4', time: '09:37:12', job: '前端开发（外包）', company: '某外包公司', model: 'deepseek-chat', check: 'blocked', sendStatus: 'blocked', summary: '（已拦截）命中排除关键词', jd: '岗位职责：驻场参与客户侧 React 项目开发，按需求完成业务组件与页面交付，配合项目经理进行进度汇报。\n\n任职要求：熟悉 React，能接受驻场工作节奏，有外包项目经验优先。\n\n工作地点：客户现场；岗位描述包含「外包」「驻场」等风险关键词。', greeting: '（拦截）岗位含排除关键词「外包」。', reason: '命中排除关键词：外包', log: 'WARN keyword exclude' },
  { id: 'h5', time: '09:35:50', job: 'React 开发', company: '海纳信息', model: 'deepseek-chat', check: 'dry', sendStatus: 'dry', summary: '您好，看到贵司 React 岗位…', jd: '岗位职责：负责 React 业务组件、管理后台页面和公共交互模块开发，参与需求评审与线上问题排查。\n\n任职要求：熟悉 React、TypeScript、状态管理和常见前端工程化工具；能够独立完成页面开发和联调。\n\n加分项：有数据可视化、权限系统或组件库开发经验。', greeting: '您好，我熟悉 React 生态与状态管理，欢迎详聊。', reason: 'Dry Run 模式，已生成并等待人工审核', log: 'INFO dry-run' },
  { id: 'h6', time: '09:33:21', job: '前端工程师', company: '蓝鲸数据', model: 'deepseek-chat', check: 'fail', sendStatus: 'fail', summary: '（失败）JD 抓取超时', jd: '（空）JD 抓取失败：页面在规定时间内未返回完整岗位详情，当前仅确认岗位名称为「前端工程师」，职责、任职要求和福利信息尚未抓取。', greeting: '（失败）未生成', reason: 'JD 抓取超时，已重试 2 次', log: 'ERROR jd fetch timeout' },
  { id: 'h7', time: '09:30:09', job: '资深前端', company: '极光软件', model: 'deepseek-chat', check: 'pass', sendStatus: 'sent', summary: '您好，我在前端工程化方面经验丰富…', jd: '岗位职责：负责前端工程化体系、构建工具链和 CI/CD 流程建设，提升研发效率与发布质量；参与核心业务模块开发和技术方案评审。\n\n任职要求：熟悉 React、TypeScript、Node.js、Webpack 或 Vite；有自动化测试、监控告警和持续交付实践。\n\n加分项：有前端质量平台、发布卡口或团队工程规范建设经验。', greeting: '您好，我搭建过发布卡口与自动化回归，故障率下降 41%。', reason: '真实发送模式，匹配度 0.85 校验通过后自动发送', log: 'INFO sent ok' },
  { id: 'h8', time: '09:28:44', job: '前端开发', company: '微影文化', model: 'deepseek-chat', check: 'dry', sendStatus: 'dry', summary: '您好，关注到贵司前端岗位…', jd: '岗位职责：负责公司官网、活动页和品牌营销页面开发，配合设计师还原视觉稿并保障多端适配。\n\n任职要求：熟悉 HTML、CSS、JavaScript、React，了解响应式布局和页面性能优化；具备良好的视觉还原能力。\n\n工作内容：参与活动上线、埋点接入和线上问题修复。', greeting: '您好，我做过活动页性能优化，欢迎沟通。', reason: 'Dry Run 模式，已生成并等待人工审核', log: 'INFO dry-run' },
]

export const CONFIG_DEFAULTS = {
  language: '中文',
  llmBaseUrl: 'https://api.deepseek.com/v1',
  llmModel: 'deepseek-chat',
  llmApiKey: 'sk-or-v1-3a9f****2b7c',
  bossUsrName: '陈思远',
  bossLabel: '前端开发（上海）',
  minMatchScore: '0.70',
  excludeKeywords: '外包, 驻场, 销售',
  dryRun: true,
  customPrompt:
    '你是一名资深招聘助手。根据候选人简历与岗位 JD，生成一段不超过 60 字的打招呼语。\n' +
    '要求：口语化、不套模板、突出与岗位最相关的 1 个经历。\n' +
    '若匹配度低于阈值，输出 SKIP 并说明理由。',
}

export const FAQ: FaqItem[] = [
  { id: 'f1', q: '需要扫码登录', a: '打开「运行」页，点击「检查登录态」会唤起 Chrome 并展示二维码，用手机 Boss 直聘扫码即可。登录态默认保留 7 天。' },
  { id: 'f2', q: 'API Key 缺失', a: '进入「配置」页，点击「替换 Key」填写 LLM_API_KEY。Key 仅保存在本地 .env，不会上传。缺失时运行前检查会标红拦截。' },
  { id: 'f3', q: '简历未上传', a: '在「简历」页点击「替换简历」选择 PDF，系统会重新解析并建立向量库。未上传时不会发起任何发送。' },
  { id: 'f4', q: 'Chrome profile 被锁', a: '通常是上次进程未正常退出。关闭所有 Chrome 实例后点击「环境体检」重试；仍失败可删除 profiles 目录重新初始化。' },
  { id: 'f5', q: 'BOSS 页面加载失败', a: '多为网络或登录态失效。先点「刷新」与「检查登录态」，若持续失败请复制诊断信息到「帮助」页的「问 AI」提交。' },
]

export const DIAGNOSTIC: { label: string; status: CheckStatus; detail: string }[] = [
  { label: 'Chrome', status: 'ok', detail: '已连接 · 版本 130.0.6723' },
  { label: '简历', status: 'ok', detail: '已上传并解析（312 切片）' },
  { label: 'LLM', status: 'ok', detail: 'DeepSeek 端点可用' },
  { label: '日志目录', status: 'ok', detail: '~/Library/Logs/boss-greeter 可写' },
  { label: '版本', status: 'ok', detail: APP_VERSION },
]

// 最近错误摘要（帮助页假模块）
export const RECENT_ERRORS: { time: string; level: LogLevel; text: string }[] = [
  { time: '09:33:21', level: 'ERROR', text: 'JD 抓取超时 job=蓝鲸数据（已重试 2 次）' },
  { time: '09:12:04', level: 'WARN', text: '模板重复率 0.41 超过 0.35 上限，已拦截' },
  { time: '08:55:47', level: 'WARN', text: '命中排除关键词「外包」，跳过岗位' },
]

export const HELP_PROMPT =
  '我使用 Boss 直聘自动打招呼控制台时遇到问题，下面是环境体检信息：\n' +
  '- Chrome: 已连接 130.0.6723\n- 简历: 已解析 312 切片\n- LLM: DeepSeek 可用\n' +
  '- 日志目录: 可写\n请帮我判断可能原因并给出排查步骤。'

export function nowTime(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function nowHM(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
