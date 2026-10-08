# 简历 Agent Roadmap 实施计划

> **给 agentic workers 的说明：**本文档记录简历/JD 匹配 Agent 的当前实现状态，以及后续产品规划。创建更小粒度的任务实施计划前，请先以本文档作为路线图。

**目标：**将当前的浏览器自动化 + LLM 匹配项目，演进为一个更透明、可追踪、理解简历上下文的求职助手。

**架构方向：**已完成的后端工作现在会先通过完整简历 LLM 解析生成结构化 `ResumeProfile`，再基于该 profile 生成语义向量分块。后续功能应基于这层数据基础继续建设，包括匹配解释、运行历史、简历评估、招呼语优化，以及在前端页面中向用户展示这些能力。

**技术栈：**Python、Pydantic、ChromaDB、sentence-transformers、OpenAI-compatible chat completions、nodriver、Tauri、Vue。

---

## 当前分支快照

- 分支：`feature/structured-resume-chunks`
- 最新已推送 commit：`9d6fc4c feat: add structured resume profile chunks`
- 已验证测试命令：

```bash
uv run pytest tests/test_vectorization.py tests/test_job_matcher.py tests/test_llm.py
```

- 最新验证结果：`61 passed`

## 已完成工作

### 1. 完整简历的 LLM 结构化解析

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/models/job_matcher.py`
- `src/boss_zhipin/models/resume_profile.py`
- `tests/test_job_matcher.py`

**变更内容：**

- 将旧的“截取前 3000 字符 -> 提取关键词列表”流程，替换为完整简历解析流程。
- 新增 `ResumeProfile`、`WorkExperience`、`ProjectExperience`、`EducationItem` 等 Pydantic 模型。
- 新增 `extract_resume_profile(resume_text)`。
- 新增严格中文 prompt，要求 LLM 返回固定字段的 JSON object：
  - `summary`
  - `skills`
  - `work_experience`
  - `project_experience`
  - `education`
  - `achievements`
  - `keywords`
- 经实际测试发现 `1800` token 可能截断 JSON，因此将 profile 生成输出预算提升到 `4096` tokens。
- 新增解析失败 fallback，避免 LLM 输出非法时主流程直接崩溃。

### 2. 关键词改为来自 ResumeProfile

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/models/job_matcher.py`
- `tests/test_job_matcher.py`

**变更内容：**

- `extract_keywords_from_text()` 现在优先使用 `resume_profile.keywords`。
- 如果没有可用 profile，则回退到旧的关键词缓存。
- 显式传入 `resume_profile=None` 时，不会在同一次运行中再次触发 LLM 解析。

### 3. 结构化简历分块

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/vectorization.py`
- `tests/test_vectorization.py`

**变更内容：**

- 新增 `ResumeChunk(section, title, text, keywords, weight, index)`。
- 新增 `chunks_from_resume_profile(profile)`。
- profile 字段现在会生成更聚焦的语义分块：
  - 个人总结分块
  - 技能分块
  - 每段工作经历一个分块
  - 每段项目经历一个分块
  - 教育经历分块
  - 成就分块
- 长分块按段落/窗口拆分，而不是把无关内容盲目混在一起。
- 写入 Chroma 的 document 现在包含可读标签，例如 `【项目经验｜DeepDoyo】`。
- metadata 现在存储 section、title、index、weight、chunk version 和 keywords。

### 4. 基于规则的 fallback 分块

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/vectorization.py`
- `tests/test_vectorization.py`

**变更内容：**

- 保留 `split_resume_structured()`，作为 LLM profile 解析失败时的 fallback 路径。
- 移除硬编码的、面向特定职业的项目标题提示。
- fallback 只使用相对通用的简历结构信号：
  - 常见章节标题
  - 时间范围
  - 公司实体信号
- 如果未检测到标题，则回退到旧的 `split_text()` 行为。

### 5. 基于 resume hash 的统一本地存储

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/models/job_matcher.py`
- `src/boss_zhipin/vectorization.py`
- `tests/test_job_matcher.py`
- `tests/test_vectorization.py`

**变更内容：**

- 移除 `structured-v1`、`structured-profile-v1` 等 vectorstore 路径变体。
- 移除单独的 `profile-v1` 缓存目录。
- 当前存储结构为：

```text
vectorstores/<resume_hash>/
  chroma.sqlite3
  keywords.json
  resume_profile.json
  <chroma collection dir>/
```

- 项目当前不检查 profile schema version。后续如果 schema 发生变化，缓存清理或迁移暂时通过手动方式处理。

### 6. CLI 运行流程集成

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/cli.py`

**变更内容：**

- 当前运行流程为：

```text
extract resume PDF text
→ extract or load ResumeProfile
→ derive keywords from ResumeProfile
→ embed resume using profile-based chunks
→ continue job filtering and greeting generation
```

### 7. 支持 metadata 的向量搜索

**状态：**已完成

**相关文件：**

- `src/boss_zhipin/vectorization.py`
- `tests/test_vectorization.py`

**变更内容：**

- 保留 `VectorStore.search(query, k=4) -> list[str]` 以保持兼容。
- 新增 `VectorStore.search_with_metadata(query, k=4)`。
- 更新相关性检查逻辑：查询 top 3 chunks，并使用最小 distance 作为判断依据。

## 尚未完成

### 1. 匹配解释

**状态：**未完成

**目的：**

向用户展示为什么某个 JD 被判断为合适或不合适。

**建议输出：**

- 命中的简历分块
- 命中的技能或项目经历
- LLM 分数和理由
- 风险点
- 最终建议

**可能涉及文件：**

- `src/boss_zhipin/models/job_matcher.py`
- `src/boss_zhipin/vectorization.py`
- `src-tauri` 下的 Tauri command layer
- `tauri-ui` 下的前端页面

### 2. 岗位投递历史

**状态：**未完成

**目的：**

持久化每个被查看、跳过、匹配、打招呼或失败的岗位，让用户能在一次运行结束后回看发生了什么。

**建议数据字段：**

- 岗位标题
- 公司
- 薪资
- 地点
- JD 文本
- 命中的关键词
- 命中的简历分块
- 向量相关性结果
- LLM 分数
- 生成的招呼语
- 操作结果
- 失败原因
- 时间戳

**可能的存储方案：**

- SQLite：适合需要查询、筛选历史记录
- JSONL：适合作为更简单的第一版审计日志

**建议：**

如果前端需要过滤和搜索，使用 SQLite。如果只是快速记录审计日志，才使用 JSONL。

### 3. 简历评估与优化

**状态：**未完成

**目的：**

在投递岗位前，使用 `ResumeProfile` 对用户简历进行评估。

**建议输出：**

- 优势
- 劣势
- 缺失信息
- 表达不清的项目描述
- 量化不足的问题
- 与目标岗位的匹配度
- 改写后的项目 bullet
- 建议补充的关键词

**可能涉及文件：**

- `src/boss_zhipin/models/` 下的新后端模块
- `tests/` 下的测试
- `tauri-ui` 下的可选前端页面

### 4. JD 到简历的匹配报告

**状态：**未完成

**目的：**

将当前内部匹配决策转换为用户可读的报告。

**建议结构：**

- score：`0-100`
- 匹配点
- 缺失点
- 风险点
- 推荐的招呼语重点
- 最终决策

**依赖：**

该功能应复用 `search_with_metadata()` 和现有 LLM scoring 结果。

### 5. 招呼语生成升级

**状态：**未完成

**目的：**

让招呼语更具体，减少模板感。

**建议变更：**

- 使用命中的简历分块作为依据。
- 提及最相关的项目或工作经历。
- 根据岗位类型和公司类型调整语气。
- 生成多个版本。
- 将生成的招呼语写入历史记录。

**可能涉及文件：**

- `src/boss_zhipin/website_oper/write_response.py`
- `src/boss_zhipin/models/job_matcher.py`
- 未来的 history storage module

### 6. 前端 UI 页面

**状态：**未完成

**目的：**

让用户无需查看日志或本地文件，也能使用和理解后端能力。

**建议页面：**

- 简历上传与解析状态
- 结构化简历 profile 查看器
- 向量分块查看器
- 岗位匹配历史
- 匹配解释详情
- 简历评估
- 招呼语预览与编辑
- 缓存管理

**可能涉及文件：**

- `tauri-ui`
- `src-tauri`

### 7. 缓存管理

**状态：**未完成

**目的：**

允许用户查看并刷新本地从简历派生出的数据。

**建议操作：**

- 显示当前 resume hash
- 显示 `resume_profile.json` 是否存在
- 显示 Chroma vectorstore 是否存在
- 重新生成 profile
- 重新生成 vectorstore
- 清理当前简历缓存
- 清理全部简历缓存

**当前存储目标：**

```text
vectorstores/<resume_hash>/
```

### 8. LLM JSON 稳定性改进

**状态：**部分完成

**已完成：**

- profile 解析的 `max_tokens` 已提升到 `4096`。
- 非法 JSON 会安全 fallback，不会导致主流程崩溃。

**仍然有价值的改进：**

- 增加一次自动重试，并使用更短的 JSON 修复 prompt。
- 对常见问题做 JSON repair，例如字符串被截断。
- 当配置的 LLM 支持时，使用 provider-native JSON mode 或 structured output。
- 将失败的原始 LLM profile 输出记录到 debug log，便于排查。

### 9. 中文 embedding 模型替换

**状态：**未完成

**当前模型：**

```text
sentence-transformers/all-mpnet-base-v2
```

**重新评估原因：**

当前模型并非专门针对中文简历/JD 语义检索优化。

**候选模型：**

- `BAAI/bge-m3`
- `BAAI/bge-large-zh-v1.5`
- `moka-ai/m3e-base`
- 远程 embedding API

**建议：**

替换前先做 benchmark。使用一小组本地 JD/简历样本，对比 top-k 检索到的分块质量。

### 10. 更 Agent 化的运行时

**状态：**未完成

**目的：**

让项目从“带 LLM 调用的自动化脚本”，逐步变成更可解释的 Agent。

**建议能力：**

- 显式运行状态
- 操作历史
- 失败恢复
- 用户确认节点
- 可观察的工具结果
- 可恢复运行
- 关于何时跳过、打招呼或停止的策略

## 推荐下一步实施顺序

### Phase 1：匹配解释

**为什么先做：**

后端已经具备 chunk metadata。这是让产品减少黑箱感最快的一步。

**交付物：**

对每个被评估的 JD，生成一份紧凑解释，包含命中的简历分块、分数和决策理由。

### Phase 2：本地历史记录

**为什么第二步做：**

历史记录能增强用户信任，也会让调试容易很多。

**交付物：**

将岗位决策和生成的招呼语持久化到本地存储。

### Phase 3：简历评估

**为什么第三步做：**

`ResumeProfile` 已经包含该功能所需的结构化输入。

**交付物：**

实现一个后端函数，用于评估简历并输出可执行的优化建议。

### Phase 4：招呼语优化

**为什么第四步做：**

当命中的简历分块和历史记录都存在后，招呼语可以基于证据生成，减少泛泛而谈。

**交付物：**

基于命中的简历证据生成招呼语，并保存生成结果。

### Phase 5：前端页面

**为什么第五步做：**

UI 应该展示稳定的后端能力，而不是追着尚未稳定的内部数据结构变化跑。

**交付物：**

实现简历 profile、匹配解释、历史记录、简历评估、招呼语预览和缓存控制等页面。

## 给后续实现者的备注

- 后端改动应先保证可以独立测试，再接入 Tauri 或 Vue。
- 除非任务明确要求，不要运行完整前端 build。
- 避免硬编码特定职业的简历分块启发式规则。
- 面向用户的缓存文件继续放在 `vectorstores/<resume_hash>/` 下。
- 如果 `ResumeProfile` schema 发生变化，需要更新测试，并手动处理已有缓存数据。
