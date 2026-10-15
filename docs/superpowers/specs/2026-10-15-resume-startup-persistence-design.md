# Resume Startup Persistence Design

## Goal

让 GUI 每次启动后都能从当前运行模式的数据目录恢复已上传的简历。

## Design

- `boss_zhipin.tauri.main()` 在 standalone 模式切换到应用数据目录后、在开发模式保留项目根目录后，统一调用 `load_dotenv(override=False)`。这样 `.env` 中持久化的绝对 `RESUME_PATH` 会在 `get_resume` 首次调用前进入 `os.environ`。
- 运行页将 `getResume()` 从 LLM 配置和普通环境字段的并行读取中解耦。配置读取失败时只显示配置错误，不阻止独立的简历读取更新 UI。
- 保留 `current_resume()` 的现有文件存在性校验和上传路径；不迁移已有文件，不改变 standalone 和开发模式各自的存储边界。

## Verification

- 在临时工作目录写入 `.env` 和有效 PDF，加载 dotenv 后确认 `current_resume()` 返回该简历。
- 对前端源码确认 `getResume()` 不再位于包含 LLM 配置读取的 `Promise.all`。
