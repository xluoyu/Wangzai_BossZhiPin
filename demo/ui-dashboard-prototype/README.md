# Boss 直聘自动打招呼 · 控制台 UI 原型

一个**纯前端、仅假数据**的桌面控制台 UI 原型，用于评审「可审计、可暂停、可 Dry Run 的 Boss 直聘自动打招呼」产品形态。
不连接后端、不调用 Tauri IPC、不访问网络、不读取真实日志、不发送任何消息。确认 UI 设计风格、业务模块、交互方式与用户任务路径后，再复刻到真实的 `tauri-ui` 项目。

## 技术选择

- **React 18 + TypeScript + Vite**（与真实 `tauri-ui` 同栈，后续迁移成本低）。
- 样式使用**普通 CSS + CSS 变量**，不依赖 Tailwind 或组件库，避免“模板味”。
- 所有数据写在 `src/mockData.ts` 与组件常量里。
- 运行状态用 **React Context（`src/runContext.tsx`）** 全局管理，因此**切换页面不会重置运行态**，更接近真实桌面工具。

## 如何打开 demo

```bash
cd demo/ui-dashboard-prototype
npm install
npm run dev      # 默认 http://localhost:5173
```

> 以上命令在本地执行即可。仓库内只生成了源码，未运行安装 / 构建 / 启动。

## 设计方向

「深色本地自动化驾驶舱」——石墨黑背景、细线与分区组织信息、低噪音、有风险边界，像真实桌面软件而非营销后台。

- 背景为中性石墨黑（`#0d0f12`），非纯黑、非均匀深蓝。
- **青色仅用于**当前运行状态、主 CTA、进度关键点；绿色=安全通过；黄色= Dry Run / 等待确认 / 轻警告；**红色仅用于**真实发送、终止任务、失败、拦截。
- 减少卡片与胶囊（pill）：用状态 rail、计数条、表格、审计时间线、状态条来组织信息。
- 图标只出现在按钮和关键状态处，不在每个标题配图标。

## 页面模块

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 运行（首页 / 核心） | `src/pages/RunDemo.tsx` | 状态 rail → **主控制面板（视觉中心）** → 指标计数条 → 阶段 pipeline → 审计时间线 |
| 简历 | `src/pages/ResumeDemo.tsx` | 简历解析工作台：当前简历 + 上传区 + RAG 召回预览 |
| 记录 | `src/pages/HistoryDemo.tsx` | 审计表：汇总条 + 分段筛选 + 行展开 + 复制日志 |
| 配置 | `src/pages/ConfigDemo.tsx` | 本地软件式设置：AI 端点 / 运行参数 / 安全策略 / Prompt |
| 帮助 | `src/pages/HelpDemo.tsx` | 诊断中心：一键问 AI + 环境体检 + 最近错误 + FAQ |
| 全局状态 | `src/runContext.tsx` | 运行模式 / 状态 / 阶段 / 指标 / 活动 / 日志 / Toast |
| 布局与组件 | `src/App.tsx`、`src/components/*` | 侧边栏、顶栏、基础 UI 组件 |
| 样式 | `src/index.css` | 设计变量与全部视觉 |

## 主要交互

- **运行页**：顶部状态 rail 一眼看清是否就绪；主控制面板是页面视觉中心，显示当前岗位 / 当前阶段 / 队列 / 状态灯。
- **安全边界**：Dry Run 为默认安全模式（青色 CTA）；切到「真实发送」后面板出现**红色风险边界**，点击开始会弹出**二次确认**。
- **运行节奏**：点击「开始 Dry Run」→ 阶段 pipeline 推进、审计时间线追加条目、指标计数条增长 → 可「暂停队列 / 继续运行 / 终止任务」；终止后保留日志入口。
- **idle 进度为 0**，暂停后进度停住、继续后从原进度续跑，终止后显示「本轮已停止」。
- **审计时间线**：每条含 `时间 · 动作类型 · 目标岗位·公司 · 原因/结果（含匹配度）`，能看出“为什么跳过、为什么拦截、正在处理什么”。
- **记录页**：分段筛选切换表格内容；点击行展开 JD / 招呼语 / 校验原因 / 日志；「复制此条日志」有反馈。
- **配置页**：修改即提示「有未保存更改」，保存仅更新前端状态；安全模式开关开启=绿色（安全），关闭=红色；API Key 以「已配置」呈现，点「替换 Key」才进入编辑。
- **帮助页**：一键复制诊断信息；环境体检为检查清单（非卡片）；新增「最近错误摘要」贴近排障场景。
- **Toast** 按成功 / 警告 / 危险分色，不再统一为青色。

## 关键用户任务路径

1. 打开 App → 状态 rail 显示运行前检查全部通过。
2. 确认 Dry Run 开启 → 点「开始 Dry Run」。
3. 观察阶段 pipeline 与审计时间线 → 打开实时日志抽屉。
4. 进入记录页，展开一条招呼语确认生成质量。
5. 回到运行页，切到「真实发送」→ 出现红色风险边界 → 二次确认后开始真实发送。
6. 运行中可暂停 / 继续 / 终止。
7. 出错时进入帮助页，复制诊断信息问 AI。

## 迁移到 `tauri-ui`

按以下对照把 `src/pages/*` 平移为 `tauri-ui/src/pages/*`，并将 `mockData` 与 `runContext` 内的假数据替换为 Tauri IPC 调用：

| 原型文件 | 真实 `tauri-ui` 落点 |
| --- | --- |
| `src/pages/RunDemo.tsx` | `src/pages/run.tsx` |
| `src/pages/ResumeDemo.tsx` | `src/pages/resume.tsx` |
| `src/pages/HistoryDemo.tsx` | `src/pages/history.tsx` |
| `src/pages/ConfigDemo.tsx` | `src/pages/settings.tsx` |
| `src/pages/HelpDemo.tsx` | `src/pages/help.tsx` |
| `src/runContext.tsx` | 替换为 IPC 封装的 store（保留同样的 state 形状） |
| `src/mockData.ts` | 删除，改用 `window.__TAURI__.invoke(...)` 取数 |
| `src/components/*` / `src/index.css` | 样式与组件基本可复用，仅替换 token 来源 |

组件与 CSS 结构保持清晰，迁移时不需要重写布局，只需把假数据源换成真实接口。
