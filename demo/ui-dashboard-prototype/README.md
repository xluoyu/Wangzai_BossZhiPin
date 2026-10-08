# Boss 直聘自动打招呼 · 控制台 UI Demo

一个**纯前端、仅假数据**的桌面端 UI 原型，用于评审「可审计、可暂停、可 Dry Run 的 Boss 直聘自动打招呼控制台」的设计风格、业务模块、交互方式与用户任务路径。

> 本 demo **不连接后端、不调用 Tauri IPC、不访问网络、不读取真实日志、不发送任何消息**。所有 UI 文案、mock 数据与状态都在前端本地维护。确认风格后再复刻到真实 `tauri-ui` 项目。

## 技术选择

- **React 18 + TypeScript + Vite**：与真实项目 `tauri-ui`（React/Vite）技术栈一致，页面结构可直接迁移。
- **不引入组件库 / Tailwind**：样式用一份 `index.css` + CSS 变量（设计 Token）实现，便于后续对照迁移。
- **无路由库**：用 `App.tsx` 内的 `useState` 切换页面，依赖最少。
- 运行模拟用浏览器 `setInterval` 推进阶段进度与活动流，仅用于演示交互。

## 如何打开 demo

```bash
cd demo/ui-dashboard-prototype
npm install        # 安装 react / react-dom / vite 等
npm run dev        # 启动后访问终端提示的本地地址（默认 http://localhost:5173）
```

> 本目录下的文件均由 AI 生成，未执行 `npm install` / 构建 / 启动服务。你本地执行上述命令即可在浏览器中看到交互效果。

## 页面模块

| 页面 | 文件 | 主要内容 |
| --- | --- | --- |
| 运行 | `src/pages/RunDemo.tsx` | 运行前检查、安全模式（Dry Run / 真实发送）、主操作区、运行指标、阶段进度、最近活动、实时日志抽屉 |
| 简历 | `src/pages/ResumeDemo.tsx` | 当前简历卡片、假上传区、召回切片预览、替换 / 重新解析 |
| 记录 | `src/pages/HistoryDemo.tsx` | 汇总、筛选器、历史表格、行展开详情、复制日志 |
| 配置 | `src/pages/ConfigDemo.tsx` | 语言、AI 端点、运行参数、自定义 Prompt、保存状态、API Key 显隐 |
| 帮助 | `src/pages/HelpDemo.tsx` | 一键复制「问 AI」、环境体检、FAQ 展开 |

共享部分：
- `src/App.tsx`：布局与页面切换（左侧固定导航 + 顶部状态栏）
- `src/components/Sidebar.tsx`、`src/components/TopBar.tsx`：导航与顶栏
- `src/components/ui.tsx`：`Card / Pill / Button / Toggle / Icon` 等基础组件
- `src/mockData.ts`：全部假数据、设计 Token 相关常量
- `src/index.css`：深色「驾驶舱」样式与设计变量

## 主要交互（关键用户任务路径）

1. **运行页**：默认 Dry Run，点「开始 Dry Run」→ 阶段进度推进、活动流追加、指标递增；可「暂停队列 / 继续运行 / 终止任务」（终止有确认弹窗）。
2. **安全边界**：在「安全模式」切换为「真实发送」→ 主按钮变红、出现红色风险提示；确认后才开始真实发送。
3. **实时日志**：运行中 / 暂停时点「查看实时日志」→ 右侧抽屉显示假日志。
4. **简历页**：点「替换简历 / 拖拽上传」→ 模拟选择并更新文件名、进入「解析中」后回到「已完成」；「重新解析」同理。
5. **记录页**：筛选器切换表格内容；点表格行展开 JD / 招呼语 / 校验原因 / 日志片段；「复制此条日志」给出反馈。
6. **配置页**：修改任意字段后显示「有未保存更改」；点「保存」显示「已保存」（仅更新前端状态）；API Key 可显示 / 隐藏。
7. **帮助页**：「复制问 AI」一键复制诊断信息；FAQ 卡片点击展开 / 收起。

## 设计语言（深色自动化驾驶舱）

- 主背景接近黑的深灰（`#0e1116`），非纯黑；卡片用轻微层级 + 细边框，不发光。
- 主行动色：**青色**（`#22d3ee`），仅用于主按钮、进度、当前运行状态。
- **绿色** = 安全通过 / 运行正常；**黄色** = Dry Run / 等待确认 / 轻警告；**红色** = 真实危险 / 失败 / 停止 / 发送拦截。
- 布局工具型：左侧栏 256px、顶栏 64px、主区撑满桌面（非窄网页居中）。

## 后续迁移到 `tauri-ui`

建议按以下映射直接平移：

| Demo | 真实 `tauri-ui` |
| --- | --- |
| `src/pages/RunDemo.tsx` | `tauri-ui/src/pages/Run.tsx` |
| `src/pages/ResumeDemo.tsx` | `tauri-ui/src/pages/Resume.tsx` |
| `src/pages/HistoryDemo.tsx` | `tauri-ui/src/pages/History.tsx` |
| `src/pages/ConfigDemo.tsx` | `tauri-ui/src/pages/Config.tsx` |
| `src/pages/HelpDemo.tsx` | `tauri-ui/src/pages/Help.tsx` |
| `src/mockData.ts` | 替换为真实 Tauri IPC 调用（`src-tauri` 暴露的命令） |
| `src/components/*` | `tauri-ui/src/components/*` |
| `src/index.css` 的设计变量 | 迁移为 `tauri-ui` 的全局主题变量 |

迁移时注意：把 `mockData` 的读取改为真实 IPC（`invoke('get_resume')` 等），把「开始 Dry Run / 真实发送 / 暂停 / 终止」等按钮接到真实命令，并把日志 / 活动流改为订阅真实事件流。UI 组件与样式可基本原样复用。
