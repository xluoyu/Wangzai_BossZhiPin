# 移除问 AI 按钮并固定侧栏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution for this focused UI change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the persistent top-right AI-copy action and keep the left navigation fixed while the right content scrolls.

**Architecture:** Preserve the existing two-column React layout. Remove the App-level AI-copy action and its feedback state, then constrain the shell/sidebar to the viewport and retain scrolling only on `.content-scroll`.

**Tech Stack:** React + TypeScript, Tauri UI, Tailwind/CSS layers.

---

### Task 1: Remove the top-right AI action

**Files:**
- Modify: `tauri-ui/src/App.tsx`
- Modify: `tauri-ui/src/lib/i18n.ts`
- Modify: `tauri-ui/src/index.css`

- [ ] Remove `helpMsg` state and the `askAi` function from `App`.
- [ ] Remove the `ask-ai-btn` button and conditional help message from `.topbar-actions`, leaving the run status indicator intact.
- [ ] Remove the now-unused `header.askAi` dictionary entry from both language dictionaries; keep `askai.btn`, `askai.ok`, and `askai.fail` because the run error panel still uses them.
- [ ] Remove `.ask-ai-btn`, its hover rule, and `.help-message` styles.

### Task 2: Make the sidebar fixed and content independently scrollable

**Files:**
- Modify: `tauri-ui/src/index.css`

- [ ] Set `.app-shell` to `height: 100vh` and `overflow: hidden` so the window itself does not become the page scroll container.
- [ ] Set `.app-sidebar` to `height: 100vh` and `overflow: hidden` while retaining its flex sizing.
- [ ] Keep `.app-main` shrinkable with `min-height: 0`; ensure `.content-scroll` remains the only vertical scroll container with `overflow: auto`.
- [ ] Preserve the existing mobile width and padding rules.

### Task 3: Static verification

**Files:**
- Verify: `tauri-ui/src/App.tsx`
- Verify: `tauri-ui/src/index.css`
- Verify: `tauri-ui/src/lib/i18n.ts`

- [ ] Search for `header.askAi`, `ask-ai-btn`, and `help-message`; expect no matches. Confirm `askai.*` remains referenced only by the run error panel.
- [ ] Inspect the final layout declarations to confirm the shell/sidebar use viewport height and `.content-scroll` owns overflow.
- [ ] Do not run a dev server, build, type-check, or full test suite per repository instructions.
