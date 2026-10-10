# JD 任务记录与审核队列实施计划

> 本计划只涉及后端任务记录、审核队列、历史查询和功能说明，不修改现有 UI 页面、样式、前端类型或前端文案。

## 1. 目标与范围

将一次 JD 处理过程拆分为“任务组”和“任务”两层记录，并用 JSONL 保存：

- `logs/task_groups.jsonl`：每次运行的生命周期和汇总统计。
- `logs/tasks.jsonl`：当前尚未结束的任务，包含待审核和审核通过但尚未发送的任务。
- `logs/task_queue.jsonl`：已经结束的任务，包含已发送、过滤跳过、审核拒绝、处理失败、发送失败和取消的任务。
- `logs/letters.jsonl`：保留现有招呼语审计日志，继续兼容已有逻辑，但不作为新的任务历史主数据源。
- `logs/llm_calls.jsonl`：继续保存 LLM telemetry，不并入任务业务记录。

本次不迁移 SQLite，不迁移或重写既有 `letters.jsonl` 历史数据。

## 2. 业务规则

### 2.1 直接发送模式

- 任务完成 JD 获取、过滤、LLM 分析、招呼语生成和校验后，自动视为审核通过。
- 发送成功后写入 `task_queue.jsonl`：
  - `task_status=sent`
  - `review_status=approved`
  - `send_status=sent`
- 过滤跳过的任务也必须记录，直接写入 `task_queue.jsonl`：
  - `task_status=filtered`
  - `review_status=not_required`
  - `send_status=skipped`
- 黑名单、关键词、向量、LLM 任一过滤原因都要保留在 `filter_result` 中。

### 2.2 dry-run 模式

- 过滤通过且招呼语生成、校验成功的任务写入 `tasks.jsonl`：
  - `task_status=pending_review`
  - `review_status=pending`
  - `send_status=not_sent`
- dry-run 不发送招呼语，但任务必须进入可审核队列。
- 审核通过后，任务仍留在 `tasks.jsonl`：
  - `task_status=approved_pending_send`
  - `review_status=approved`
- 审核拒绝后，任务移动到 `task_queue.jsonl`：
  - `task_status=rejected`
  - `review_status=rejected`
  - `send_status=skipped`
- 后续发送成功后，任务移动到 `task_queue.jsonl`：
  - `task_status=sent`
  - `review_status=approved`
  - `send_status=sent`
- 后续发送失败后，任务移动到 `task_queue.jsonl`：
  - `task_status=send_failed`
  - `review_status=approved`
  - `send_status=failed`

### 2.3 获取或处理失败

- 已成功获取到 JD 的任务，即使后续过滤、LLM、招呼语生成或发送失败，也必须尽可能记录完整 JD、岗位信息和失败原因。
- 获取 JD 失败且没有完整 JD 时，仍创建任务记录，使用已获得的 URL、公司名或职位信息，并在 `failure_reason` 中记录具体阶段和原因。
- 所有终态任务进入 `task_queue.jsonl`；只有等待人工审核或等待发送的任务留在 `tasks.jsonl`。

## 3. 数据结构

### 3.1 任务组记录：`logs/task_groups.jsonl`

每行一个运行组，至少包含：

```text
schema_version
group_id
mode
label
started_at
finished_at
status
total_tasks
processed_count
generated_count
pending_review_count
sent_count
filtered_count
rejected_count
failed_count
send_failed_count
cancelled_count
blacklist_count
keyword_filtered_count
vector_filtered_count
llm_filtered_count
fetch_failed_count
exclude_keywords
```

约定：

- `group_id` 在一次 CLI 或 GUI 运行开始时生成，并贯穿全部任务。
- `started_at` 在任务组创建时写入，`finished_at` 在主流程结束时写入。
- 运行中断或异常也要尝试将任务组标记为失败，并保留已经累计的统计。
- 统计字段以任务终态为准，避免只按“是否生成招呼语”统计。

### 3.2 活动任务记录：`logs/tasks.jsonl`

每行一个仍需后续动作的任务，至少包含：

```text
schema_version
task_id
group_id
company_name
job_title
job_url
jd
task_status
review_status
send_status
filter_result
llm_analysis
greeting
failure_reason
started_at
finished_at
reviewed_at
sent_at
```

字段约定：

- `job_url` 必须保存完整 JD URL，不保存截断或仅用于列表点击的相对地址。
- `jd` 保存本次获取到的完整 JD 文本。
- `filter_result` 只保留业务复盘所需摘要，例如是否命中黑名单、关键词、向量或 LLM、命中原因和必要分数；不保存原始召回 chunks 或完整运行对象。
- `llm_analysis` 保存结构化解析结果、匹配结论、分数和理由等业务结果；不保存 model、prompt 或完整 telemetry。
- `finished_at` 表示本阶段任务记录完成时间；进入待审核状态时可记录，发送阶段更新 `sent_at`。
- `failure_reason` 统一使用可读的阶段、错误类型和原因，便于历史筛选与排查。

### 3.3 终态任务记录：`logs/task_queue.jsonl`

字段与 `tasks.jsonl` 保持兼容，额外确保任务移动后仍保留：

- 原始 `task_id` 和 `group_id`。
- 原始 JD、完整 URL、公司和职位。
- 招呼语、过滤结果、LLM 分析结果和失败原因。
- 审核状态、发送状态、任务状态以及对应时间。

`task_queue.jsonl` 是历史任务的主查询文件；`tasks.jsonl` 是活动审核队列，不要求两者长期重复保存同一条终态记录。

## 4. 实施步骤

### 阶段一：任务存储层

新增 `src/boss_zhipin/audit/task_store.py`，集中处理 JSONL 的读写和状态流转：

1. 实现任务组创建、累计统计和完成更新。
2. 实现活动任务创建、按 `task_id` 更新、移动到终态队列。
3. 实现 `tasks.jsonl` 和 `task_queue.jsonl` 的追加写入、重写/移动和原子替换。
4. 增加进程内写锁，避免并发任务交错写入。
5. 查询时按行解析，坏 JSON 行跳过并记录告警，不阻塞其他历史任务读取。
6. 按 `task_id` 去重；审核或发送重复调用不得产生重复终态记录。
7. 提供按 `group_id`、`task_status`、`review_status`、`send_status` 和时间范围筛选的方法。

JSONL 文件不存在时自动创建父目录；写入采用 UTF-8，并保证单条记录是一行合法 JSON。

### 阶段二：JD 结构化获取

修改 `src/boss_zhipin/website_oper/finding_jobs.py`：

1. 新增结构化岗位信息返回值，至少包括完整 JD、公司名称、职位名称和完整 URL。
2. 保留现有 `get_job_description_by_index()` 的兼容行为，避免无关调用方和旧测试受到影响。
3. 对页面字段缺失、URL 获取失败等情况提供明确的空值和错误信息，供任务记录层保存。

### 阶段三：主流程接入

修改 `src/boss_zhipin/website_oper/write_response.py` 和必要的运行入口：

1. 每次运行创建 `group_id` 和任务组记录。
2. 在获取到一个 JD 后立即创建 `task_id` 和任务初始记录，保证后续任何阶段失败都可追踪。
3. 将黑名单、关键词、向量和 LLM 过滤结果汇总到 `filter_result`，过滤跳过也完成任务记录。
4. 保存生成的招呼语、校验结果、LLM 业务分析结果和失败原因。
5. 根据 `dry_run` 和直接发送模式写入活动队列或终态队列。
6. 在主流程退出、异常和取消路径更新任务组完成时间与统计。
7. 保留现有 GUI 事件和 `log_attempt`/`letters.jsonl` 兼容行为；新的任务记录以 task store 为准。

### 阶段四：审核后发送

新增 `src/boss_zhipin/website_oper/review_sender.py`：

1. 按 `task_id` 读取 `tasks.jsonl` 中审核通过且等待发送的任务。
2. 复用现有浏览器发送逻辑，不复制发送实现。
3. 发送前校验任务状态，防止已发送或已拒绝任务重复发送。
4. 发送成功后原子移动到 `task_queue.jsonl` 并更新发送时间。
5. 发送失败后移动到 `task_queue.jsonl`，保存失败原因和 `send_failed` 状态。
6. 审核拒绝直接移动到 `task_queue.jsonl`，不执行发送。

后端可提供查询、审核、审核后发送所需的函数或 IPC 接口，但本次不修改 `tauri-ui/**`。

### 阶段五：文档与测试

新增功能说明 `docs/wiki/task-review-queue.md`，说明：

- 两个任务文件和任务组文件的职责。
- dry-run 与直接发送的区别。
- 审核状态、任务状态、发送状态的含义。
- 过滤跳过、处理失败和发送失败如何记录。
- 如何按状态和任务组查询。
- `letters.jsonl`、`llm_calls.jsonl` 与新任务记录的关系。

必要时补充 `docs/wiki/architecture.md` 和 `docs/wiki/faq.md` 的链接或简短说明。

## 5. 测试计划

新增或扩展后端测试，至少覆盖：

1. 任务组创建、完成和各类统计累计。
2. 直接发送成功进入 `task_queue.jsonl`，并自动审核通过。
3. dry-run 成功进入 `tasks.jsonl`，状态为待审核。
4. 审核通过后可发送；审核拒绝进入终态队列。
5. 发送成功、发送失败和取消的状态流转。
6. 黑名单、关键词、向量、LLM 过滤均能记录，且过滤跳过进入终态队列。
7. 获取失败、LLM 失败、招呼语校验失败均保留失败原因。
8. 任务组、任务记录包含完整 JD URL、公司名称、职位、JD 文本和时间字段。
9. 重复审核、重复发送和重复写入具有幂等性。
10. 坏 JSON 行不会阻塞状态筛选，状态筛选结果准确。
11. 旧 `get_job_description_by_index()` 和既有 `letters.jsonl` 行为不回归。

按照项目规则，仅执行与本次后端修改直接相关的局部测试和语法检查；不运行前端 build、type-check、完整测试套件，也不启动本地服务。

## 6. 验收标准

- 一次运行可通过 `group_id` 找到任务组和该组全部任务。
- 无论任务最终发送、过滤、拒绝还是失败，都有一条可查询的任务记录。
- dry-run 任务能在活动队列中显示为待审核，并能在审核后继续发送。
- 直接发送模式生成招呼语后自动视为审核通过，不进入待审核队列。
- `tasks.jsonl` 只保留待审核或等待发送的活动任务；`task_queue.jsonl` 只保留终态任务。
- 查询可按审核状态、任务状态、发送状态和任务组筛选。
- 记录中包含完整 JD、完整 URL、招呼语、过滤摘要、LLM 分析摘要、失败原因和关键时间。
- 不修改 UI，不引入 SQLite，不将 model、chunks、原始向量召回对象和完整 LLM telemetry 写入任务业务记录。

## 7. 明确不做

- 不修改 `tauri-ui/**` 或其他前端页面。
- 不设计新的 UI 页面或视觉预览。
- 不将 JSONL 改造成 SQLite 或其他数据库。
- 不迁移旧 `letters.jsonl` 历史数据。
- 不把完整模型调用 telemetry、prompt、向量 chunks 或原始 `vector_match` 对象复制到任务记录。
- 不在本计划内扩展与 JD 任务记录、审核和发送无关的业务功能。

