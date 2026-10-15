# Unified UI Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all CLI-style run logs in the desktop UI and merge log lines and structured progress events into one ordered activity feed.

**Architecture:** The Python backend keeps separate progress and log channels because structured events continue to drive metrics and run state. The frontend store appends both channel inputs to a typed `activity` array with a monotonic sequence number; the Run page renders that array in one scrolling panel. The GUI root logger is explicitly set to `INFO` before the log bridge is installed so INFO records are not filtered by an earlier logging configuration.

**Tech Stack:** Python logging, PyTauri Channels, React 18, TypeScript, Zustand, pytest.

---

### Task 1: Ensure GUI forwards CLI log records

**Files:**
- Modify: `src/boss_zhipin/tauri/__init__.py:130-198`
- Test: `tests/test_runner.py:174-213`

- [ ] **Step 1: Write the failing test**

```python
def test_log_bridge_captures_info_when_root_is_warning():
    root = logging.getLogger()
    original_level = root.level
    messages: list[str] = []
    root.setLevel(logging.WARNING)
    handler = log_bridge.install(messages.append, level=logging.INFO)
    try:
        logging.getLogger("test_runner.info").info("visible info")
        assert any("visible info" in message for message in messages)
    finally:
        log_bridge.uninstall(handler)
        root.setLevel(original_level)
```

- [ ] **Step 2: Run the targeted test to verify the filtering failure**

Run: `uv run pytest tests/test_runner.py::test_log_bridge_captures_info_when_root_is_warning -q`

Expected: FAIL because the root logger filters `INFO` before the bridge handler receives it.

- [ ] **Step 3: Set the GUI root logger level before installing the bridge**

```python
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
log_handler = log_bridge.install(lambda msg: _safe_send(log_channel, msg), level=logging.INFO)
```

Place this in `start_run` immediately before calling `log_bridge.install`. The CLI remains unchanged and UI receives normal `INFO`, `WARNING`, and `ERROR` records.

- [ ] **Step 4: Update the test to exercise the GUI helper boundary**

Keep the bridge unit test focused on handler behavior; add a small `_configure_gui_logging()` helper in `boss_zhipin.tauri` if needed so the test can call it without creating a PyTauri channel.

```python
def test_configure_gui_logging_allows_info_records():
    root = logging.getLogger()
    original_level = root.level
    root.setLevel(logging.WARNING)
    try:
        _configure_gui_logging()
        assert root.isEnabledFor(logging.INFO)
    finally:
        root.setLevel(original_level)
```

- [ ] **Step 5: Run the focused Python tests**

Run: `uv run pytest tests/test_runner.py -q`

Expected: PASS.

### Task 2: Add an ordered frontend activity stream

**Files:**
- Modify: `tauri-ui/src/store.ts:1-67`

- [ ] **Step 1: Define the activity item type and state**

```ts
export type ActivityItem =
  | { sequence: number; type: "event"; event: ProgressEvent }
  | { sequence: number; type: "log"; line: string };

type RunState = {
  // existing state...
  activity: ActivityItem[];
  pushEvent: (ev: ProgressEvent) => void;
  pushLog: (line: string) => void;
};
```

- [ ] **Step 2: Append both channel inputs in their receive order**

```ts
const MAX_ACTIVITY = 1_500;

pushEvent: (ev) => set((s) => ({
  // retain existing events/currentIndex/running updates
  activity: [...s.activity, { sequence: s.activity.length ? s.activity.at(-1)!.sequence + 1 : 1, type: "event", event: ev }].slice(-MAX_ACTIVITY),
})),
pushLog: (line) => set((s) => ({
  logs: [...s.logs, line].slice(-MAX_LOGS),
  activity: [...s.activity, { sequence: s.activity.length ? s.activity.at(-1)!.sequence + 1 : 1, type: "log", line }].slice(-MAX_ACTIVITY),
})),
```

Initialize and clear `activity` with the existing run buffers. Keep `events` and `logs` unchanged for metrics, status, copying, and diagnostics.

- [ ] **Step 3: Inspect TypeScript locally**

Run: `sed -n '1,105p' tauri-ui/src/store.ts`

Expected: `activity` is cleared with a run and every channel callback appends one item.

### Task 3: Render one combined UI activity panel

**Files:**
- Modify: `tauri-ui/src/pages/Run.tsx:39-170, 420-470`
- Modify: `tauri-ui/src/lib/i18n.ts:68-130, 322-390`

- [ ] **Step 1: Switch Run page subscriptions and autoscroll to activity**

```tsx
const activity = useRunStore((s) => s.activity);
const activityScrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (activityScrollRef.current) {
    activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight;
  }
}, [activity.length]);
```

Keep `events` for `deriveMetrics`, error state, and terminal state. Keep `logs` for copy and AI-help actions.

- [ ] **Step 2: Replace the two-column event/log layout with one list**

```tsx
<div ref={activityScrollRef} className="mt-4 h-96 overflow-y-auto border border-[var(--border-light)] bg-[var(--graphite-950)] p-4 text-xs font-mono leading-relaxed">
  {activity.length === 0 ? <p className="text-[var(--muted-fg)]">{t("run.noActivity")}</p> : activity.map((item) => (
    <ActivityRow key={item.sequence} item={item} t={t} />
  ))}
</div>
```

`ActivityRow` renders raw `line` text for `type === "log"`; for `type === "event"`, it reuses the current `EventRow` formatting. Give event records a small `EVENT` marker without suppressing payload details.

- [ ] **Step 3: Replace the activity translations**

```ts
"run.workbenchActivity": "运行记录",
"run.activityDetail": "CLI 日志与运行事件按接收顺序显示",
"run.noActivity": "还没运行记录",
```

```ts
"run.workbenchActivity": "Run activity",
"run.activityDetail": "CLI logs and run events in receive order",
"run.noActivity": "No activity yet",
```

Remove only strings that become unused by this page; preserve other shared translations.

- [ ] **Step 4: Perform focused source checks**

Run: `rg -n "eventScrollRef|logScrollRef|panelProgress|panelLog|noEvents|noLogs" tauri-ui/src/pages/Run.tsx tauri-ui/src/lib/i18n.ts`

Expected: no stale `Run.tsx` two-panel refs or translation lookups remain.

### Task 4: Review the scoped diff

**Files:**
- Modify: `src/boss_zhipin/tauri/__init__.py`
- Modify: `tests/test_runner.py`
- Modify: `tauri-ui/src/store.ts`
- Modify: `tauri-ui/src/pages/Run.tsx`
- Modify: `tauri-ui/src/lib/i18n.ts`
- Create: `docs/superpowers/specs/2026-10-15-ui-unified-activity-design.md`
- Create: `docs/superpowers/plans/2026-10-15-unified-ui-activity-log.md`

- [ ] **Step 1: Review the diff for unrelated changes**

Run: `git diff -- src/boss_zhipin/tauri/__init__.py tests/test_runner.py tauri-ui/src/store.ts tauri-ui/src/pages/Run.tsx tauri-ui/src/lib/i18n.ts docs/superpowers/specs/2026-10-15-ui-unified-activity-design.md docs/superpowers/plans/2026-10-15-unified-ui-activity-log.md`

Expected: only the unified activity stream and GUI logging changes are present. Do not touch the existing user change in `tauri-ui/pnpm-workspace.yaml`.

- [ ] **Step 2: Commit the scoped changes**

```bash
git add src/boss_zhipin/tauri/__init__.py tests/test_runner.py tauri-ui/src/store.ts tauri-ui/src/pages/Run.tsx tauri-ui/src/lib/i18n.ts docs/superpowers/specs/2026-10-15-ui-unified-activity-design.md docs/superpowers/plans/2026-10-15-unified-ui-activity-log.md
git commit -m "feat: unify UI run activity logs"
```

Only commit if the user requests a commit. Keep `tauri-ui/pnpm-workspace.yaml` unstaged.
