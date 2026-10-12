# BossZhipin UI Replacement Design

## Goal

Replace the current `tauri-ui` presentation with the visual language and information hierarchy from `demo/ui-dashboard-prototype`, while preserving the existing Python/Tauri contracts and bilingual support. The implementation covers the application shell plus the Run, History, and Config pages.

## Non-goals

- No new backend commands or backend data models.
- No simulated timers, mock records, fabricated counts, or fake diagnostic results.
- No pause/resume workflow, per-job approval queue, or review-and-send action because the backend does not provide those protocols.
- No standalone Resume or Help page; resume upload remains part of Run and help remains the real copy-to-AI/log workflow.

## Visual Direction

Use a dark graphite desktop-tool interface derived from the demo: fixed left navigation, compact top status bar, restrained cyan accent, semantic success/warning/danger colors, and dense but readable work surfaces. Use stable panel radii, clear borders, monospace metadata, and high-contrast primary actions. The shell must remain usable at narrow widths by collapsing the sidebar into a compact header/navigation treatment.

## Application Shell

`App.tsx` owns the active tab, global refresh/AI-help affordances, language hydration, and the shell layout. Navigation exposes only Run, History, and Config. The top bar shows the current page, real engine state from the Zustand store, and a real action for copying diagnostic context. There is no notification bell or unread counter because no notification data source exists.

`store.ts` remains the cross-tab source for running state, bounded event/log buffers, current job index, language, and Run form values. `loop_ended` and `error` events must transition the engine out of the running state. A run's Dry Run mode is captured at start and controls the presentation until the run ends.

## Run Page

The page is organized into four functional regions:

1. **Run setup**: username, label, read-only LLM endpoint summary, Dry Run selector, and resume upload/current-resume state.
2. **Run controls**: Start and Stop Task actions, with a confirmation step for real sending. Controls that affect a running job are disabled while `running` is true.
3. **Live summary**: engine state, active job index when available, and counts derived only from received events (found, skipped, sent/dry/blocked, errors). Unknown values remain unknown rather than being filled with demo totals.
4. **Activity**: event timeline and raw log stream, with real copy-to-clipboard feedback and an error panel that can show the real log directory and invoke the real AI-help command.

Start preflight mirrors backend requirements: username, resume, LLM key, and model. Upload failures show the backend error. Resume replacement is disabled during a run. Stop is labeled as cancellation/stopping, never pause or resume.

Event rendering maps backend event kinds directly: browser started, login confirmed, job found, job skipped with reason/score data, degraded scoring, letter status (`sent`, `dry_run`, `blocked`), feed exhausted, loop completion/cancellation/error, and generic error. No event is interpreted as a fixed queue tick or guaranteed send.

## History Page

On mount and explicit refresh, call `getLetters(200)` and `getTelemetrySummary()` again. Display telemetry using its actual aggregate scope (for example, “last 1000 calls”), with total calls, total cost, and provider breakdown. Never label this as a seven-day window.

The letter table uses only `LetterRecord` fields: timestamp, provider, model, validation result/reasons, dry-run/real-send state, letter text, letter length, and saved job description. Rows can expand to show the full job description, generated letter, validation reasons, and a copy-log action that writes to the clipboard and reports failure if the browser API rejects it. There are no inferred company, job title, match score, batch, reviewer, or failure-type columns.

Handle loading, empty files, missing files, malformed-line/IPC failures, and telemetry-without-letters as explicit states. Refresh updates data, not just a timestamp.

## Config Page

Load and save through the existing configuration IPC only:

- LLM endpoint presets, base URL, model, and secret key status through `getLlmConfig` / `setLlmConfig`.
- Dynamic environment fields from `getEnvFields` / `writeEnvFields`, including fields added by the backend without a frontend field-list rewrite.
- Custom greeting prompt through `getLetterPrompt` / `setLetterPrompt`, with empty value meaning built-in default and a restore-default action.
- Language through `getLanguage` / `setLanguage`, immediately reflected in the UI and persisted for the next launch.

Save state is explicit. On successful save, re-read the relevant backend values. A blank API key follows the backend convention (keep existing key where applicable); the frontend never displays or fabricates a masked secret. Preset selection fills endpoint/model only and does not imply key configuration.

## Data and Error Flow

All page data flows through `tauri-ui/src/lib/ipc.ts`. Components set loading/error state around each call and render actionable inline feedback. The frontend may preflight obvious start errors for fast feedback, but backend errors remain authoritative and are logged into the live log buffer. Clipboard operations are real async operations with success/failure feedback. Sensitive key material is excluded from visible diagnostics and AI-help text by the backend contract.

## Verification

Verification is scoped to the modified frontend: inspect TypeScript imports/types, confirm every IPC call matches `ipc.ts`, check that disabled states follow `running`, and review empty/error branches for each data-loading page. Per project instructions, do not run a full build, type-check, test suite, or local dev server during this frontend task.

