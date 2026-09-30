# Resume Agent Roadmap Implementation Plan

> **For agentic workers:** This document records the current implementation status and the remaining product plan for the resume/JD matching agent. Use it as the roadmap before creating smaller task-level implementation plans.

**Goal:** Turn the current browser automation + LLM matching project into a more transparent, traceable, resume-aware job search assistant.

**Architecture:** The completed backend work now uses a full-resume LLM parsing step to produce a structured `ResumeProfile`, then generates semantic vector chunks from that profile. Future work should build on this data foundation by adding match explanations, run history, resume review, greeting optimization, and frontend pages that expose these capabilities to users.

**Tech Stack:** Python, Pydantic, ChromaDB, sentence-transformers, OpenAI-compatible chat completions, nodriver, Tauri, Vue.

---

## Current Branch Snapshot

- Branch: `feature/structured-resume-chunks`
- Latest pushed commit: `9d6fc4c feat: add structured resume profile chunks`
- Verified test command:

```bash
uv run pytest tests/test_vectorization.py tests/test_job_matcher.py tests/test_llm.py
```

- Latest verified result: `61 passed`

## Completed Work

### 1. Full-resume LLM structured parsing

**Status:** Completed

**Files:**

- `src/boss_zhipin/models/job_matcher.py`
- `src/boss_zhipin/models/resume_profile.py`
- `tests/test_job_matcher.py`

**What changed:**

- Replaced the old "first 3000 characters -> keyword list" flow with a full-resume parsing flow.
- Added `ResumeProfile`, `WorkExperience`, `ProjectExperience`, and `EducationItem` Pydantic models.
- Added `extract_resume_profile(resume_text)`.
- Added a strict Chinese prompt requiring a JSON object with fixed fields:
  - `summary`
  - `skills`
  - `work_experience`
  - `project_experience`
  - `education`
  - `achievements`
  - `keywords`
- Increased profile generation output budget to `4096` tokens after real testing showed `1800` could truncate JSON.
- Added parsing failure fallback so the main run does not crash if LLM output is invalid.

### 2. Keywords now come from ResumeProfile

**Status:** Completed

**Files:**

- `src/boss_zhipin/models/job_matcher.py`
- `tests/test_job_matcher.py`

**What changed:**

- `extract_keywords_from_text()` now prefers `resume_profile.keywords`.
- If no profile is available, it falls back to the legacy keywords cache.
- Explicitly passing `resume_profile=None` no longer triggers a second LLM parse attempt in the same run.

### 3. Structured resume chunks

**Status:** Completed

**Files:**

- `src/boss_zhipin/vectorization.py`
- `tests/test_vectorization.py`

**What changed:**

- Added `ResumeChunk(section, title, text, keywords, weight, index)`.
- Added `chunks_from_resume_profile(profile)`.
- Profile fields now produce focused semantic chunks:
  - personal summary chunk
  - skills chunk
  - one chunk per work experience
  - one chunk per project experience
  - education chunk
  - achievements chunk
- Long chunks are split by paragraph/window instead of blindly mixing unrelated sections.
- Documents written to Chroma now contain readable labels such as `【项目经验｜DeepDoyo】`.
- Metadata now stores section, title, index, weight, chunk version, and keywords.

### 4. Rule-based fallback chunking

**Status:** Completed

**Files:**

- `src/boss_zhipin/vectorization.py`
- `tests/test_vectorization.py`

**What changed:**

- Kept `split_resume_structured()` as the fallback path when LLM profile parsing fails.
- Removed hard-coded, occupation-specific project title hints.
- Fallback only uses relatively generic resume structure signals:
  - common section headings
  - time ranges
  - company entity signals
- If no headings are detected, it falls back to the old `split_text()` behavior.

### 5. Unified local storage under resume hash

**Status:** Completed

**Files:**

- `src/boss_zhipin/models/job_matcher.py`
- `src/boss_zhipin/vectorization.py`
- `tests/test_job_matcher.py`
- `tests/test_vectorization.py`

**What changed:**

- Removed vectorstore path variants such as `structured-v1` and `structured-profile-v1`.
- Removed the separate `profile-v1` cache directory.
- Current storage layout is:

```text
vectorstores/<resume_hash>/
  chroma.sqlite3
  keywords.json
  resume_profile.json
  <chroma collection dir>/
```

- The project does not currently check a profile schema version. If the schema changes later, cache cleanup or migration will be handled manually.

### 6. CLI run flow integration

**Status:** Completed

**Files:**

- `src/boss_zhipin/cli.py`

**What changed:**

- The run flow now does:

```text
extract resume PDF text
→ extract or load ResumeProfile
→ derive keywords from ResumeProfile
→ embed resume using profile-based chunks
→ continue job filtering and greeting generation
```

### 7. Metadata-aware vector search

**Status:** Completed

**Files:**

- `src/boss_zhipin/vectorization.py`
- `tests/test_vectorization.py`

**What changed:**

- Kept `VectorStore.search(query, k=4) -> list[str]` for compatibility.
- Added `VectorStore.search_with_metadata(query, k=4)`.
- Updated relevance checking to query top 3 chunks and use the minimum distance.

## Not Completed Yet

### 1. Match explanation

**Status:** Not completed

**Purpose:**

Show users why a JD was considered suitable or unsuitable.

**Suggested output:**

- matched resume chunks
- matched skills or project experience
- LLM score and reason
- risk points
- final recommendation

**Likely files:**

- `src/boss_zhipin/models/job_matcher.py`
- `src/boss_zhipin/vectorization.py`
- Tauri command layer under `src-tauri`
- frontend pages under `tauri-ui`

### 2. Job application history

**Status:** Not completed

**Purpose:**

Persist every viewed, skipped, matched, greeted, or failed job so users can review what happened after a run.

**Suggested data fields:**

- job title
- company
- salary
- location
- JD text
- matched keywords
- matched resume chunks
- vector relevance result
- LLM score
- generated greeting
- action result
- failure reason
- timestamp

**Likely storage options:**

- SQLite for queryable history
- JSONL for a simpler first version

**Recommendation:**

Use SQLite if the frontend needs filtering and search. Use JSONL only for a quick audit log.

### 3. Resume review and optimization

**Status:** Not completed

**Purpose:**

Use `ResumeProfile` to review the user's resume before applying for jobs.

**Suggested output:**

- strengths
- weaknesses
- missing information
- unclear project descriptions
- weak quantification
- target-role fit
- rewritten project bullets
- suggested keyword improvements

**Likely files:**

- new backend module under `src/boss_zhipin/models/`
- tests under `tests/`
- optional frontend page under `tauri-ui`

### 4. JD-to-resume match report

**Status:** Not completed

**Purpose:**

Turn the current internal matching decision into a user-readable report.

**Suggested structure:**

- score: `0-100`
- matched points
- missing points
- risks
- recommended greeting focus
- final decision

**Dependency:**

This should reuse `search_with_metadata()` and the existing LLM scoring result.

### 5. Greeting generation upgrade

**Status:** Not completed

**Purpose:**

Make greeting text more specific and less template-like.

**Suggested changes:**

- Use matched chunks as evidence.
- Mention the most relevant project or work experience.
- Adjust tone by job type and company type.
- Generate multiple variants.
- Store generated greetings in history.

**Likely files:**

- `src/boss_zhipin/website_oper/write_response.py`
- `src/boss_zhipin/models/job_matcher.py`
- future history storage module

### 6. Frontend UI pages

**Status:** Not completed

**Purpose:**

Expose backend capabilities to users without requiring them to inspect logs or local files.

**Suggested pages:**

- resume upload and parse status
- structured resume profile viewer
- vector chunks viewer
- job match history
- match explanation detail
- resume review
- greeting preview and edit
- cache management

**Likely files:**

- `tauri-ui`
- `src-tauri`

### 7. Cache management

**Status:** Not completed

**Purpose:**

Let users inspect and refresh local resume-derived data.

**Suggested actions:**

- show current resume hash
- show whether `resume_profile.json` exists
- show whether Chroma vectorstore exists
- regenerate profile
- regenerate vectorstore
- clear current resume cache
- clear all resume caches

**Current storage target:**

```text
vectorstores/<resume_hash>/
```

### 8. LLM JSON stability improvements

**Status:** Partially completed

**Completed:**

- Increased profile parsing `max_tokens` to `4096`.
- Invalid JSON safely falls back instead of crashing.

**Still useful:**

- Add one automatic retry with a shorter repair prompt.
- Add JSON repair for common issues such as truncated strings.
- Use provider-native JSON mode or structured output when the configured LLM supports it.
- Record failed raw LLM profile output to a debug log for troubleshooting.

### 9. Chinese embedding model replacement

**Status:** Not completed

**Current model:**

```text
sentence-transformers/all-mpnet-base-v2
```

**Reason to revisit:**

The current model is not optimized for Chinese resume/JD semantic retrieval.

**Candidate models:**

- `BAAI/bge-m3`
- `BAAI/bge-large-zh-v1.5`
- `moka-ai/m3e-base`
- remote embedding APIs

**Recommendation:**

Benchmark before replacing. Use a small local JD/resume pair dataset and compare top-k retrieved chunks.

### 10. More agent-like runtime

**Status:** Not completed

**Purpose:**

Move the project from "automation script with LLM calls" toward a more explainable agent.

**Suggested capabilities:**

- explicit run state
- action history
- failure recovery
- user confirmation gates
- observable tool results
- resumable runs
- policy for when to skip, greet, or stop

## Recommended Next Implementation Order

### Phase 1: Match Explanation

**Why first:**

The backend already has chunk metadata. This is the fastest way to make the product less black-box.

**Deliverable:**

For every evaluated JD, produce a compact explanation containing matched chunks, score, and decision reason.

### Phase 2: Local History

**Why second:**

History gives users trust and makes debugging much easier.

**Deliverable:**

Persist job decisions and generated greetings to local storage.

### Phase 3: Resume Review

**Why third:**

`ResumeProfile` already contains the structured input needed for this feature.

**Deliverable:**

A backend function that reviews the resume and produces practical improvement suggestions.

### Phase 4: Greeting Optimization

**Why fourth:**

Once matched chunks and history exist, greetings can become evidence-based and less generic.

**Deliverable:**

Generate greetings from matched resume evidence and store the generated output.

### Phase 5: Frontend Pages

**Why fifth:**

The UI should expose stable backend capabilities, not chase unstable internal data shapes.

**Deliverable:**

Pages for resume profile, match explanation, history, resume review, greeting preview, and cache controls.

## Notes for Future Implementers

- Keep backend changes independently testable before wiring them into Tauri or Vue.
- Do not run full frontend builds unless the task explicitly requires it.
- Avoid hard-coded occupation-specific resume chunk heuristics.
- Keep user-facing cache files under `vectorstores/<resume_hash>/`.
- If `ResumeProfile` schema changes, update tests and manually handle existing cache data.
