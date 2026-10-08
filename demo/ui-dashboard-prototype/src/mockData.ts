import { AccountInfo, ActivityItem, CheckStatus, FaqItem, HistoryRow, LogLine, PreCheck, ResumeSlice, Stage } from './types'

export const ACCOUNT: AccountInfo = { name: '陈思远', status: 'Boss 直聘 · 已连接' }

export const PRECHECKS: PreCheck[] = [
  { id: 'resume', label: '简历', status: 'ok', detail: '陈思远_前端开发_2026.pdf · 更新于 09:30' },
  { id: 'ai', label: 'AI 端点', status: 'ok', detail: 'DeepSeek · deepseek-chat · Key 已配置' },
  { id: 'chrome', label: 'Chrome 登录态', status: 'ok', detail: '已连接，登录有效期 7 天' },
  { id: 'safety', label: '安全模式', status: 'ok', detail: '当前为 Dry Run（仅模拟，不真实发送）' },
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

export const INITIAL_METRICS = { scanned: 68, generated: 46, approved: 43, sent: 32, blocked: 3, failed: 2 }

export const SEED_ACTIVITIES: ActivityItem[] = [
  { id: 'a1', time: '09:41:12', kind: 'scan', text: '已读取岗位：前端开发工程师 · 上海 · 星河互动' },
  { id: 'a2', time: '09:41:20', kind: 'generate', text: '生成招呼语通过校验（匹配度 0.82）' },
  { id: 'a3', time: '09:41:33', kind: 'skip', text: '跳过岗位：要求 5 年经验（当前 3 年）' },
  { id: 'a4', time: '09:41:40', kind: 'block', text: '拦截异常招呼语：检测到模板重复率过高' },
  { id: 'a5', time: '09:41:55', kind: 'log', text: '写入审计日志：batch-2026-10-08-09' },
]

export const SEED_LOGS: LogLine[] = [
  { id: 'l1', time: '09:40:01', level: 'INFO', text: '引擎启动，加载配置 .env' },
  { id: 'l2', time: '09:40:02', level: 'DEBUG', text: 'Chrome profile 路径: /profiles/boss-default' },
  { id: 'l3', time: '09:40:05', level: 'INFO', text: 'AI 端点连通性检测通过 (DeepSeek)' },
  { id: 'l4', time: '09:41:55', level: 'INFO', text: 'audit log flushed: batch-2026-10-08-09' },
]

export const ACTIVITY_POOL: { kind: ActivityItem['kind']; text: string }[] = [
  { kind: 'scan', text: '已读取岗位：高级前端开发 · 杭州 · 云栖科技' },
  { kind: 'generate', text: '生成招呼语通过校验（匹配度 0.79）' },
  { kind: 'skip', text: '跳过岗位：城市不匹配（要求 北京）' },
  { kind: 'block', text: '拦截异常招呼语：命中敏感词黑名单' },
  { kind: 'generate', text: '生成招呼语通过校验（匹配度 0.88）' },
  { kind: 'scan', text: '已读取岗位：前端架构师 · 上海 · 启明网络' },
  { kind: 'log', text: '写入审计日志：batch-2026-10-08-10' },
  { kind: 'generate', text: '生成招呼语通过校验（匹配度 0.75）' },
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
    { id: 's1', title: '项目经历', content: '主导公司内 C 端营销中台重构，负责组件库与构建提速，首屏加载从 3.2s 降至 1.1s。' },
    { id: 's2', title: '技术栈', content: 'React / TypeScript / Vite / Node.js / 微前端 qiankun / 单元测试 Vitest。' },
    { id: 's3', title: '业务成果', content: '建立前端发布卡口与自动化回归，线上故障率下降 41%；带教 2 名应届生。' },
    { id: 's4', title: '软技能', content: '跨团队推动设计-研发协作规范，输出 12 篇内部技术文档。' },
  ] as ResumeSlice[],
}

export const HISTORY: HistoryRow[] = [
  { id: 'h1', time: '09:41:20', job: '前端开发工程师', company: '星河互动', model: 'deepseek-chat', check: 'pass', sendStatus: 'dry', summary: '您好，看到贵司前端岗位与我的 React 经验契合…', jd: '负责 C 端 Web 应用开发与性能优化，熟练 React / TS。', greeting: '您好，我是陈思远，3 年 React 经验，主导过营销中台重构，首屏优化 3.2s→1.1s。', reason: 'Dry Run 模式，未真实发送', log: 'INFO verify pass score=0.82' },
  { id: 'h2', time: '09:39:05', job: '高级前端开发', company: '云栖科技', model: 'deepseek-chat', check: 'pass', sendStatus: 'sent', summary: '您好，我在前端性能优化与微前端有较多实践…', jd: '负责中后台微前端架构与脚手架建设。', greeting: '您好，我做过 qiankun 微前端落地与构建提速，欢迎进一步沟通。', reason: '匹配度 0.79 通过人工审核阈值', log: 'INFO sent ok' },
  { id: 'h3', time: '09:38:40', job: '前端架构师', company: '启明网络', model: 'deepseek-chat', check: 'blocked', sendStatus: 'blocked', summary: '（已拦截）模板重复率过高', jd: '负责前端架构与技术规范。', greeting: '（拦截）检测到模板重复率 0.41 超过上限 0.35。', reason: '模板重复率 0.41 超过 0.35 上限', log: 'WARN blocked repetition' },
  { id: 'h4', time: '09:37:12', job: '前端开发（外包）', company: '某外包公司', model: 'deepseek-chat', check: 'blocked', sendStatus: 'blocked', summary: '（已拦截）命中排除关键词', jd: '驻场前端开发。', greeting: '（拦截）岗位含排除关键词「外包」。', reason: '命中排除关键词：外包', log: 'WARN keyword exclude' },
  { id: 'h5', time: '09:35:50', job: 'React 开发', company: '海纳信息', model: 'deepseek-chat', check: 'dry', sendStatus: 'dry', summary: '您好，看到贵司 React 岗位…', jd: '负责 React 业务组件开发。', greeting: '您好，我熟悉 React 生态与状态管理，欢迎详聊。', reason: 'Dry Run 模拟发送', log: 'INFO dry-run' },
  { id: 'h6', time: '09:33:21', job: '前端工程师', company: '蓝鲸数据', model: 'deepseek-chat', check: 'fail', sendStatus: 'fail', summary: '（失败）JD 抓取超时', jd: '（空）JD 抓取失败', greeting: '（失败）未生成', reason: 'JD 抓取超时，已重试 2 次', log: 'ERROR jd fetch timeout' },
  { id: 'h7', time: '09:30:09', job: '资深前端', company: '极光软件', model: 'deepseek-chat', check: 'pass', sendStatus: 'sent', summary: '您好，我在前端工程化方面经验丰富…', jd: '负责前端工程化与 CI/CD。', greeting: '您好，我搭建过发布卡口与自动化回归，故障率下降 41%。', reason: '匹配度 0.85 通过审核', log: 'INFO sent ok' },
  { id: 'h8', time: '09:28:44', job: '前端开发', company: '微影文化', model: 'deepseek-chat', check: 'dry', sendStatus: 'dry', summary: '您好，关注到贵司前端岗位…', jd: '负责官网与活动页开发。', greeting: '您好，我做过活动页性能优化，欢迎沟通。', reason: 'Dry Run 模拟发送', log: 'INFO dry-run' },
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
  { id: 'f2', q: 'API Key 缺失', a: '进入「配置」页，填写 LLM_API_KEY。Key 仅保存在本地 .env，不会上传。缺失时运行前检查会标红拦截。' },
  { id: 'f3', q: '简历未上传', a: '在「简历」页点击「替换简历」选择 PDF，系统会重新解析并建立向量库。未上传时不会发起任何发送。' },
  { id: 'f4', q: 'Chrome profile 被锁', a: '通常是上次进程未正常退出。关闭所有 Chrome 实例后点击「环境体检」重试；仍失败可删除 profiles 目录重新初始化。' },
  { id: 'f5', q: 'BOSS 页面加载失败', a: '多为网络或登录态失效。先点「刷新」与「检查登录态」，若持续失败请复制诊断信息到「帮助」页的「问 AI」提交。' },
]

export const DIAGNOSTIC: { label: string; status: CheckStatus; detail: string }[] = [
  { label: 'Chrome', status: 'ok', detail: '已连接 · 版本 130.0.6723' },
  { label: '简历', status: 'ok', detail: '已上传并解析（312 切片）' },
  { label: 'LLM', status: 'ok', detail: 'DeepSeek 端点可用' },
  { label: '日志目录', status: 'ok', detail: '~/Library/Logs/boss-greeter 可写' },
  { label: '当前版本', status: 'ok', detail: 'v0.4.2 (demo)' },
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
