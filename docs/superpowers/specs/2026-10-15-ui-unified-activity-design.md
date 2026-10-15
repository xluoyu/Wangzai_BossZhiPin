# UI Unified Activity Log Design

## Goal

让运行页完整显示 CLI 风格的运行日志，同时把结构化进度事件与日志放进同一条按接收顺序排列的 activity 流。

## Design

- Python 后端继续保留 progress channel 和 log channel 两类协议：事件用于状态、结束判断和指标统计；日志用于完整的人类可读诊断文本。
- GUI 启动时显式配置 root logger 为 `INFO`，并让日志桥接 handler 使用同样的级别，避免已有 logging 配置导致 CLI 的 INFO 输出在转发前被过滤。
- 前端 store 新增统一 activity 项目。收到事件或日志时分别追加 `{type, sequence, event|line}`，并限制总数量；原有 `events` 和 `logs` 缓冲继续保留，供统计、复制日志和 AI 诊断使用。
- 运行页将事件面板和日志面板合并为一个 activity 面板。事件以现有可读格式展示，日志以原始 CLI 文本展示，二者按接收顺序排列。

## Verification

- 覆盖 root logger 级别较高时 GUI 日志桥仍能收到 INFO。
- 检查前端类型和 store 的 activity 追加逻辑，确保事件统计与日志复制行为不变。
