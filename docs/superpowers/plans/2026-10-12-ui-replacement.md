# BossZhipin UI Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `tauri-ui` shell and three pages with the demo's dark desktop-tool presentation while keeping every state and value grounded in the existing IPC/backend contracts.

**Architecture:** Keep `ipc.ts`, Zustand, and the three existing page entry points as the behavioral boundary. Rebuild the shell and page markup around small local presentational helpers, derive all run metrics from buffered `ProgressEvent`s, and load/save History and Config through their existing IPC wrappers. Centralize the new graphite theme in `index.css` and use responsive CSS grid/flex layouts rather than adding a UI dependency.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind utility classes already present, Tauri/PyTauri IPC, CSS variables.

---

### Task 1: Establish the dark application shell

**Files:**
- Modify: `tauri-ui/src/App.tsx`
- Modify: `tauri-ui/src/index.css`
- Verify: `tauri-ui/src/store.ts`, `tauri-ui/src/lib/i18n.ts`

- [ ] **Step 1: Define shell states and navigation**

  Keep `Tab = "run" | "config" | "history"`, derive the visible engine label from `useRunStore().running`, and remove notification-only controls. Keep the existing `askAi()` implementation and language hydration unchanged.

- [ ] **Step 2: Replace the header-only layout**

  Render a `.app-shell` with an `aside` containing brand and three tab buttons, a `.main-column` with a top bar showing page title, engine status, and AI-help action, and a scrollable content region. Pass the active tab to the existing page components without moving IPC logic into the shell.

- [ ] **Step 3: Add responsive graphite tokens and primitives**

  Add CSS variables for `--bg-base`, `--bg-panel`, `--bg-elevated`, `--border`, `--text-*`, `--accent`, `--success`, `--warning`, and `--danger`; define `.panel`, `.button`, `.nav-item`, `.status-dot`, form controls, table, and mobile breakpoints. Keep focus-visible outlines and 8px-or-smaller radii.

- [ ] **Step 4: Check shell references**

  Run `rg -n "var\(--(paper|ink|muted-fg|border-light)" tauri-ui/src` and update remaining page classes in later tasks; do not leave CSS variables that are no longer defined.

- [ ] **Step 5: Commit shell changes**

  Run `git add tauri-ui/src/App.tsx tauri-ui/src/index.css && git commit -m "feat: replace tauri app shell"`.

### Task 2: Rebuild the Run workbench around real events

**Files:**
- Modify: `tauri-ui/src/pages/Run.tsx`
- Modify: `tauri-ui/src/store.ts` only if a missing derived run field is required
- Modify: `tauri-ui/src/lib/i18n.ts` for new bilingual labels

- [ ] **Step 1: Preserve real loading and upload flows**

  Keep `getLlmConfig`, `getEnvFields`, `getResume`, drag/drop `setResume`, file-picker `setResumeBytes`, `startRun`, `stopRun`, `shutdownBrowser`, `getLogDir`, and `getAiHelpReport`. Disable username/label/Dry Run/resume replacement while `running` is true.

- [ ] **Step 2: Add start confirmation for real sending**

  When `dryRun` is false and the user presses Start, show an inline confirmation panel with the selected label and a confirm/cancel pair. Only the confirm action calls `startRun`; Dry Run starts immediately after preflight.

- [ ] **Step 3: Derive live metrics from `ProgressEvent[]`**

  Count only received `job_found`, `job_skipped`, `letter_sent` statuses (`sent`, `dry_run`, `blocked`), and `error` events. Display unknown/zero states honestly; do not create a queue total or timer. Render event payload details such as skip reason, score, threshold, and letter status when present.

- [ ] **Step 4: Replace pause/review language**

  Use “Stop task”/“Cancel run” for `stopRun`, remove resume/pause controls, and do not show approve-and-send actions. Keep the real Chrome reset action separate from task cancellation.

- [ ] **Step 5: Render activity and failure feedback**

  Use two scrollable panels for event timeline and raw logs, provide real clipboard feedback for logs, show error/loop-ended reason distinctions, and expose the backend log directory only after an error. Keep the existing AI-help copy action.

- [ ] **Step 6: Commit Run changes**

  Run `git add tauri-ui/src/pages/Run.tsx tauri-ui/src/store.ts tauri-ui/src/lib/i18n.ts && git commit -m "feat: rebuild run workbench"`.

### Task 3: Rebuild History with real records and telemetry

**Files:**
- Modify: `tauri-ui/src/pages/History.tsx`
- Modify: `tauri-ui/src/lib/i18n.ts`

- [ ] **Step 1: Keep refresh as a real reload**

  On mount and refresh, call `ipc.getLetters(200)` and `ipc.getTelemetrySummary()` in parallel, preserve backend order by copying before reversing, and retain loading/error state.

- [ ] **Step 2: Add semantic filters**

  Filter locally by `sent`, `dry_run`, validation failure, or all using only `LetterRecord` fields. Do not invent “failed send”, company, title, score, batch, or reviewer fields.

- [ ] **Step 3: Add expandable record details**

  Show timestamp, provider, model, validation status/reasons, send status, and a short letter preview. Expanded content includes the full saved JD, generated letter, validation reasons, and a copy-log button that awaits `navigator.clipboard.writeText` and reports failure.

- [ ] **Step 4: Add honest telemetry summary and empty/error states**

  Show total calls, total cost, provider/token breakdown, and the actual aggregate scope. Handle no letters, no telemetry, missing log files, malformed/IPC errors, and loading without replacing values with demo numbers.

- [ ] **Step 5: Commit History changes**

  Run `git add tauri-ui/src/pages/History.tsx tauri-ui/src/lib/i18n.ts && git commit -m "feat: rebuild history workbench"`.

### Task 4: Rebuild Config with backend-driven groups

**Files:**
- Modify: `tauri-ui/src/pages/Config.tsx`
- Modify: `tauri-ui/src/lib/i18n.ts`

- [ ] **Step 1: Load all configuration sources**

  Load LLM config, environment fields, language, and letter prompt independently so one failure does not hide the other groups. Store original values for dirty-state comparison.

- [ ] **Step 2: Implement LLM endpoint and secret editing**

  Render backend presets, base URL, model, and configured/unconfigured key state. Preserve a blank key according to backend semantics, never show a masked fake value, and reload config after successful save.

- [ ] **Step 3: Render dynamic environment fields**

  Map over `getEnvFields().fields`, using `isSecret` for input type and `field.${key}` fallback labels. Save only changed values through `writeEnvFields` and reload after success.

- [ ] **Step 4: Implement prompt and language groups**

  Load the actual prompt, show the backend default as reference/placeholder, allow empty restore-default, persist language immediately through `setLanguage`, and keep the current session responsive if persistence fails.

- [ ] **Step 5: Add save/discard/error states**

  Disable save while requests are pending, show unsaved changes, expose backend errors inline, and keep runtime form values in the shared store for username/label synchronization.

- [ ] **Step 6: Commit Config changes**

  Run `git add tauri-ui/src/pages/Config.tsx tauri-ui/src/lib/i18n.ts && git commit -m "feat: rebuild config workbench"`.

### Task 5: Local static verification and cleanup

**Files:**
- Verify all changed files under `tauri-ui/src`

- [ ] **Step 1: Check TypeScript-facing contracts without a full build**

  Inspect every `ipc.*` call against `tauri-ui/src/lib/ipc.ts`, run `rg` for removed demo concepts (`setInterval`, `pause`, `resumeRun`, mock totals, `HISTORY`, `CONFIG_DEFAULTS`), and remove stale imports/classes.

- [ ] **Step 2: Check CSS and JSX structure**

  Run `git diff --check`, inspect changed JSX for balanced tags and stable responsive layouts, and verify focus/disabled states remain visible.

- [ ] **Step 3: Review final diff**

  Run `git status --short` and `git diff --stat`; do not run `build`, `type-check`, a complete test suite, or a local server because the repository instructions explicitly prohibit those checks for this frontend task.

