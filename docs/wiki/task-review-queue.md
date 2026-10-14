# JD 任务记录与审核队列

任务记录使用 JSONL 保存，审核页只处理活动任务，历史页只读取终态任务。

## 文件职责

- `logs/task_groups.jsonl`：每次运行一条任务组记录，保存模式、时间、状态和累计统计。
- `logs/tasks.jsonl`：仍需人工动作的任务，包括待审核和已批准待发送。
- `logs/task_queue.jsonl`：已经结束的任务，包括已发送、过滤、拒绝、处理失败和发送失败。
- `logs/letters.jsonl`：兼容旧版招呼语审计日志；不再作为审核页或历史页的主数据源。
- `logs/llm_calls.jsonl`：LLM 调用 telemetry，与任务业务状态分开保存。

## 状态流转

Dry Run 生成并校验通过后：

```text
pending_review / pending / not_sent
  ├─ 批准 → approved_pending_send / approved / not_sent
  └─ 拒绝 → rejected / rejected / skipped → task_queue.jsonl

approved_pending_send / approved / not_sent
  ├─ 发送成功 → sent / approved / sent → task_queue.jsonl
  └─ 发送失败 → send_failed / approved / failed → task_queue.jsonl
```

直接发送模式保持自动发送。过滤跳过、招呼语校验失败、获取失败和处理异常直接进入终态队列，并保留 `failure_reason` 或 `filter_result`。

## 页面使用

- **审核**：`待审核` 展示 `tasks.jsonl` 中的 `pending_review`；`待发送` 展示 `approved_pending_send`。
- 批准只改变审核状态，不触发浏览器发送。
- 发送动作按顺序处理选中的任务；成功后从活动队列移动到 `task_queue.jsonl`。
- 拒绝、发送失败不会留在活动审核列表中。
- **历史**：读取 `task_queue.jsonl`，可按已发送、已拒绝、失败和已过滤筛选，并展开查看 JD、招呼语和失败原因。
- 运行结束、失败或取消时，任务组统计会根据活动任务和终态队列重算；取消只会终止 `processing` 任务，已经进入待审核或待发送的任务会保留。

审核和发送都按 `task_id` 幂等处理；损坏的 JSONL 行会跳过并记录 warning，不阻塞其他记录读取。
