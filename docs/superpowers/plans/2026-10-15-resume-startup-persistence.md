# Resume Startup Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore an uploaded resume in the GUI immediately after startup in both development and standalone modes.

**Architecture:** Load `.env` after the standalone working-directory adjustment so `RESUME_PATH` is available to lightweight GUI commands. Decouple the Run page's resume query from configuration queries so a failed configuration request cannot prevent resume rendering.

**Tech Stack:** Python, python-dotenv, PyTauri, React, TypeScript, pytest.

---

### Task 1: Load persisted GUI environment at startup

**Files:**
- Modify: `src/boss_zhipin/tauri/__init__.py:518-534`
- Test: `tests/test_resume_io.py:127-146`

- [ ] **Step 1: Write a failing `.env` restoration test**

```python
def test_reads_back_path_loaded_from_dotenv(in_tmp_cwd, monkeypatch):
    src = _make_pdf(in_tmp_cwd / "resume" / "saved.pdf")
    (in_tmp_cwd / ".env").write_text(f"RESUME_PATH={src}\n")
    monkeypatch.delenv("RESUME_PATH", raising=False)

    load_dotenv(in_tmp_cwd / ".env")

    assert resume_io.current_resume() == {
        "filename": "saved.pdf",
        "path": str((in_tmp_cwd / "resume" / "saved.pdf").resolve()),
    }
```

- [ ] **Step 2: Run the targeted test before the startup integration**

Run: `uv run pytest tests/test_resume_io.py::TestCurrentResume::test_reads_back_path_loaded_from_dotenv -q`

Expected: PASS, demonstrating that loading the correct `.env` is the missing startup action.

- [ ] **Step 3: Load `.env` after the standalone CWD adjustment**

```python
from dotenv import load_dotenv

def main() -> int:
    if BOSS_STANDALONE:
        from boss_zhipin.paths import ensure_app_data_cwd
        data_dir = ensure_app_data_cwd()

    load_dotenv(override=False)
    logging.basicConfig(...)
```

Use `override=False` so process-level values remain authoritative while persisted GUI values supply missing configuration.

- [ ] **Step 4: Run the focused resume tests**

Run: `uv run pytest tests/test_resume_io.py -q`

Expected: PASS.

### Task 2: Decouple resume hydration from configuration hydration

**Files:**
- Modify: `tauri-ui/src/pages/Run.tsx:70-94`

- [ ] **Step 1: Keep configuration requests together but invoke resume separately**

```tsx
Promise.all([ipc.getLlmConfig(), ipc.getEnvFields()])
  .then(([cfg, env]) => {
    if (cancelled) return;
    setLlmCfg(cfg);
    // preserve existing saved form-field updates
  })
  .catch((error) => {
    if (!cancelled) setLlmError(String(error));
  });

ipc.getResume()
  .then(({ resume: currentResume }) => {
    if (!cancelled && request === resumeRequestRef.current) setResume(currentResume);
  })
  .catch((error) => {
    if (!cancelled && request === resumeRequestRef.current) setResumeError(String(error));
  });
```

- [ ] **Step 2: Perform focused source checks**

Run: `rg -n "Promise\.all\(|ipc\.getResume\(" tauri-ui/src/pages/Run.tsx`

Expected: `getResume()` appears in an independent request chain, not inside the configuration `Promise.all`.

### Task 3: Review the scoped change

**Files:**
- Modify: `src/boss_zhipin/tauri/__init__.py`
- Modify: `tauri-ui/src/pages/Run.tsx`
- Modify: `tests/test_resume_io.py`
- Create: `docs/superpowers/specs/2026-10-15-resume-startup-persistence-design.md`
- Create: `docs/superpowers/plans/2026-10-15-resume-startup-persistence.md`

- [ ] **Step 1: Check whitespace and scope**

Run: `git diff --check && git diff -- src/boss_zhipin/tauri/__init__.py tauri-ui/src/pages/Run.tsx tests/test_resume_io.py docs/superpowers/specs/2026-10-15-resume-startup-persistence-design.md docs/superpowers/plans/2026-10-15-resume-startup-persistence.md`

Expected: only startup `.env` loading and independent resume hydration are changed.

- [ ] **Step 2: Commit only when requested**

```bash
git add src/boss_zhipin/tauri/__init__.py tauri-ui/src/pages/Run.tsx tests/test_resume_io.py docs/superpowers/specs/2026-10-15-resume-startup-persistence-design.md docs/superpowers/plans/2026-10-15-resume-startup-persistence.md
git commit -m "fix: restore saved resume on GUI startup"
```

Do not stage `tauri-ui/pnpm-workspace.yaml` or any unrelated existing changes.
