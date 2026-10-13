import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Channel } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ipc, type LlmConfig, type ProgressEvent, type ResumeInfo, type RunConfig } from "../lib/ipc";
import { useRunStore, useT } from "../store";

type MetricCounts = {
  found: number;
  skipped: number;
  sent: number;
  dryRun: number;
  blocked: number;
  errors: number;
};

type LogDir = { dir: string };

export default function RunPage() {
  const t = useT();
  const [llmCfg, setLlmCfg] = useState<LlmConfig | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmLiveRun, setConfirmLiveRun] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [logDir, setLogDir] = useState<LogDir | null>(null);
  const [logDirCopyState, setLogDirCopyState] = useState<string | null>(null);

  const usrName = useRunStore((s) => s.formUsrName);
  const label = useRunStore((s) => s.formLabel);
  const dryRun = useRunStore((s) => s.formDryRun);
  const setFormState = useRunStore((s) => s.setFormState);
  const running = useRunStore((s) => s.running);
  const events = useRunStore((s) => s.events);
  const logs = useRunStore((s) => s.logs);
  const currentIndex = useRunStore((s) => s.currentIndex);
  const setRunning = useRunStore((s) => s.setRunning);
  const pushEvent = useRunStore((s) => s.pushEvent);
  const pushLog = useRunStore((s) => s.pushLog);
  const clear = useRunStore((s) => s.clear);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLPreElement>(null);
  const copyMsgTimerRef = useRef<number | null>(null);
  const logDirCopyTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyMsgTimerRef.current !== null) window.clearTimeout(copyMsgTimerRef.current);
    if (logDirCopyTimerRef.current !== null) window.clearTimeout(logDirCopyTimerRef.current);
  }, []);

  useEffect(() => {
    Promise.all([
      ipc.getLlmConfig(),
      ipc.getEnvFields(),
      ipc.getResume(),
    ]).then(([cfg, env, currentResume]) => {
      setLlmCfg(cfg);
      const current = useRunStore.getState();
      const updates: { formUsrName?: string; formLabel?: string } = {};
      const name = env.fields.find((field) => field.key === "BOSS_USR_NAME")?.value;
      const savedLabel = env.fields.find((field) => field.key === "BOSS_LABEL")?.value;
      if (name && !current.formUsrName) updates.formUsrName = name;
      if (savedLabel && !current.formLabel) updates.formLabel = savedLabel;
      if (Object.keys(updates).length) setFormState(updates);
      setResume(currentResume.resume);
    }).catch((error) => {
      setLlmError(String(error));
    });
  }, [setFormState]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        if (!useRunStore.getState().running) setDragging(true);
        return;
      }
      setDragging(false);
      if (payload.type !== "drop" || useRunStore.getState().running) return;
      const path = payload.paths.find((item) => item.toLowerCase().endsWith(".pdf"));
      if (!path) {
        setResumeError(t("run.onlyPdf"));
        return;
      }
      setResumeBusy(true);
      setResumeError(null);
      ipc.setResume(path)
        .then((info) => setResume(info))
        .catch((error) => setResumeError(String(error)))
        .finally(() => setResumeBusy(false));
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [t]);

  useEffect(() => {
    if (eventScrollRef.current) eventScrollRef.current.scrollTop = eventScrollRef.current.scrollHeight;
  }, [events.length]);

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs.length]);

  const metrics = deriveMetrics(events);
  const lastEnded = [...events].reverse().find((event) => event.kind === "loop_ended");
  const hasError = events.some(
    (event) => event.kind === "error" || (event.kind === "loop_ended" && event.payload.reason === "error"),
  );
  const lastError = [...events].reverse().find((event) => event.kind === "error");

  useEffect(() => {
    if (!hasError || logDir) return;
    ipc.getLogDir().then((dir) => setLogDir(dir)).catch(() => {});
  }, [hasError, logDir]);

  function validateStart(): string | null {
    if (!usrName.trim()) return t("run.errNeedName");
    if (!llmCfg || !llmCfg.hasKey) return t("run.errNeedAi");
    if (!llmCfg.model) return t("run.errNeedModel");
    if (!resume) return t("run.errNeedResume");
    return null;
  }

  async function startRun() {
    const error = validateStart();
    if (error) {
      setStartError(error);
      setConfirmLiveRun(false);
      return;
    }
    setStartError(null);
    setConfirmLiveRun(false);
    setBusy(true);
    clear();
    setLogDir(null);
    setCopyMsg(null);
    setRunning(true);
    const progressChannel = new Channel<ProgressEvent>((event) => pushEvent(event));
    const logChannel = new Channel<string>((line) => pushLog(line));
    const config: RunConfig = { usrName: usrName.trim(), label: label.trim(), dryRun };
    try {
      await ipc.startRun(config, progressChannel, logChannel);
    } catch (error) {
      pushLog(t("run.logStartFailed", { err: String(error) }));
      setRunning(false);
    } finally {
      setBusy(false);
    }
  }

  function requestStart() {
    const error = validateStart();
    if (error) {
      setStartError(error);
      return;
    }
    setStartError(null);
    if (!dryRun) {
      setConfirmLiveRun(true);
      return;
    }
    void startRun();
  }

  async function stopRun() {
    setBusy(true);
    try {
      await ipc.stopRun();
    } catch (error) {
      pushLog(t("run.logStopFailed", { err: String(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function resetBrowser() {
    setBusy(true);
    try {
      await ipc.shutdownBrowser();
      pushLog(t("run.logChromeClosed"));
    } catch (error) {
      pushLog(t("run.logShutdownFailed", { err: String(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      showCopyMessage(t("run.copyOk"));
    } catch {
      showCopyMessage(t("run.copyFail"));
    }
  }

  async function copyAiHelp() {
    try {
      const report = await ipc.getAiHelpReport(logs);
      await navigator.clipboard.writeText(report.text);
      showCopyMessage(t("askai.ok"));
    } catch {
      showCopyMessage(t("askai.fail"));
    }
  }

  async function copyLogDir() {
    if (!logDir) return;
    try {
      await navigator.clipboard.writeText(logDir.dir);
      setLogDirCopyState(t("run.copyPathOk"));
    } catch {
      setLogDirCopyState(t("run.copyPathFail"));
    }
    if (logDirCopyTimerRef.current !== null) window.clearTimeout(logDirCopyTimerRef.current);
    logDirCopyTimerRef.current = window.setTimeout(() => {
      setLogDirCopyState(null);
      logDirCopyTimerRef.current = null;
    }, 4000);
  }

  function showCopyMessage(message: string) {
    if (copyMsgTimerRef.current !== null) window.clearTimeout(copyMsgTimerRef.current);
    setCopyMsg(message);
    copyMsgTimerRef.current = window.setTimeout(() => {
      setCopyMsg(null);
      copyMsgTimerRef.current = null;
    }, 6000);
  }

  async function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    if (useRunStore.getState().running) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setResumeError(t("run.onlyPdf"));
      return;
    }
    setResumeBusy(true);
    setResumeError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      setResume(await ipc.setResumeBytes(file.name, btoa(binary)));
    } catch (error) {
      setResumeError(String(error));
    } finally {
      setResumeBusy(false);
    }
  }

  const statusText = running
    ? currentIndex === null
      ? t("run.statusStarting")
      : t("run.statusRunningJob", { index: currentIndex })
    : lastEnded
      ? endedReasonText(t, lastEnded.payload.reason)
      : t("run.statusIdle");

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--border-light)] pb-5">
        <div>
          <p className="eyebrow">{t("run.workbenchEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t("run.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-fg)]">{t("run.subtitle")}</p>
        </div>
        <div className="run-status" aria-live="polite">
          <span className={`status-dot ${running ? "!border-[var(--accent)] !bg-[var(--accent)]" : ""}`} />
          <span>{statusText}</span>
        </div>
      </section>

      <section className="panel space-y-5">
        <SectionHeading eyebrow="01" title={t("run.workbenchConfig")} detail={t("run.configDetail")} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t("run.fieldName")} hint={t("run.hintRequired")}>
            <input type="text" value={usrName} onChange={(event) => setFormState({ formUsrName: event.target.value })} disabled={running} className="field-input" placeholder={t("run.fieldNamePlaceholder")} />
          </Field>
          <Field label={t("run.fieldLabel")} hint={t("run.hintOptional")}>
            <input type="text" value={label} onChange={(event) => setFormState({ formLabel: event.target.value })} disabled={running} className="field-input" placeholder={t("run.fieldLabelPlaceholder")} />
          </Field>
          <Field label={t("run.fieldEndpoint")} hint={t("run.hintSetInConfig")}>
            <div className="flex min-h-[42px] flex-wrap items-center gap-2 border border-[var(--border-light)] bg-[var(--graphite-800)] px-3 py-2 text-xs font-mono">
              {llmError ? <span className="text-[var(--accent)]">{t("run.llmReadFailed", { err: llmError })}</span> : !llmCfg || !llmCfg.hasKey ? <><span className="badge-outline">{t("run.noKey")}</span><span>{t("run.goConfigForKey")}</span></> : <><span className="badge-invert">{llmCfg.model || t("run.noModelTag")}</span><span className="break-all text-[var(--muted-fg)]">{llmCfg.baseUrl || t("run.defaultEndpoint")}</span></>}
            </div>
          </Field>
          <Field label={t("run.fieldDryRun")} hint={dryRun ? t("run.dryRunOn") : t("run.dryRunOff")}>
            <label className={`flex min-h-[42px] items-center gap-3 border border-[var(--border-light)] bg-[var(--graphite-800)] px-3 text-sm ${running ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
              <input type="checkbox" checked={dryRun} onChange={(event) => setFormState({ formDryRun: event.target.checked })} disabled={running} className="h-4 w-4 accent-[var(--accent)]" />
              <span className="font-mono text-xs">{t("run.dryRunDesc")}</span>
            </label>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3"><span className="field-label">{t("run.fieldResume")}</span><span className="mono-tag">{t("run.resumeHint")}</span></div>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFilePicked} />
          <div role="button" tabIndex={running ? -1 : 0} onClick={() => { if (!running) fileInputRef.current?.click(); }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (!running && (event.key === "Enter" || event.key === " ")) fileInputRef.current?.click(); }} className={`border border-dashed p-4 transition-colors ${dragging ? "border-[var(--accent)] bg-[var(--graphite-700)]" : "border-[var(--border-light)]"} ${running ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-[var(--accent)]"}`}>
            {resumeBusy ? <p className="font-mono text-sm">{t("run.uploading")}</p> : resume ? <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-sm">{t("run.currentResume", { filename: resume.filename })}</span><button type="button" className="btn-outline text-xs" disabled={running} onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}>{t("run.replaceResume")}</button></div> : <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-sm text-[var(--muted-fg)]">{t("run.dropPrompt")}</span><button type="button" className="btn-outline text-xs" disabled={running} onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}>{t("btn.pickFile")}</button></div>}
            {resumeError && <p className="mt-3 text-xs text-[var(--accent)]">{resumeError}</p>}
          </div>
        </div>
      </section>

      <section className="panel space-y-4">
        <SectionHeading eyebrow="02" title={t("run.workbenchControl")} detail={t("run.controlDetail")} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={requestStart} disabled={running || busy} className="btn">{t("btn.start")} <span aria-hidden="true">→</span></button>
          <button type="button" onClick={stopRun} disabled={!running || busy} className="btn-outline">{t("run.stopTask")}</button>
          <button type="button" onClick={resetBrowser} disabled={running || busy} className="btn-ghost">{t("btn.resetChrome")}</button>
        </div>
        {confirmLiveRun && <div className="border border-[var(--accent)] bg-[var(--graphite-800)] p-4" role="alertdialog" aria-live="assertive"><p className="font-mono text-sm">{t("run.confirmLiveTitle")}</p><p className="mt-1 text-sm text-[var(--muted-fg)]">{t("run.confirmLiveDesc")}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="btn" onClick={() => void startRun()} disabled={busy}>{t("run.confirmLive")}</button><button type="button" className="btn-outline" onClick={() => setConfirmLiveRun(false)} disabled={busy}>{t("run.confirmCancel")}</button></div></div>}
        {startError && <div className="border border-[var(--accent)] p-3 font-mono text-sm text-[var(--accent)]" role="alert">{startError}</div>}
        {hasError && <div className="border border-[var(--border-light)] bg-[var(--graphite-800)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-sm text-[var(--accent)]">{t("run.errorTitle")}</p><p className="mt-1 text-xs text-[var(--muted-fg)]">{lastError ? eventPayloadText(lastError) : t("run.errorDesc")}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={copyLogs} className="btn-outline text-xs">{t("btn.copyLogs")}</button><button type="button" onClick={copyAiHelp} className="btn text-xs">{t("askai.btn")}</button></div></div>{logDir && <p className="mt-3 break-all text-xs font-mono text-[var(--muted-fg)]">{t("run.logDir", { dir: logDir.dir })} <button type="button" className="ml-2 underline underline-offset-2" onClick={copyLogDir}>{t("btn.copyPath")}</button>{logDirCopyState ? ` · ${logDirCopyState}` : ""}</p>}{copyMsg && <p className="mt-3 text-xs font-mono text-[var(--accent)]" role="status">{copyMsg}</p>}</div>}
      </section>

      <section className="panel">
        <SectionHeading eyebrow="03" title={t("run.workbenchMetrics")} detail={t("run.metricsDetail")} />
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-[var(--border-light)] bg-[var(--border-light)] md:grid-cols-3 xl:grid-cols-6"><Metric label={t("run.metricFound")} value={metrics.found} /><Metric label={t("run.metricSkipped")} value={metrics.skipped} /><Metric label={t("run.metricSent")} value={metrics.sent} /><Metric label={t("run.metricDryRun")} value={metrics.dryRun} /><Metric label={t("run.metricBlocked")} value={metrics.blocked} /><Metric label={t("run.metricErrors")} value={metrics.errors} emphasis={metrics.errors > 0} /></div>
      </section>

      <section className="panel">
        <SectionHeading eyebrow="04" title={t("run.workbenchActivity")} detail={t("run.activityDetail")} />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_.85fr]"><div ref={eventScrollRef} className="h-96 overflow-y-auto border border-[var(--border-light)] bg-[var(--graphite-800)] p-4 text-xs font-mono">{events.length === 0 ? <p className="text-[var(--muted-fg)]">{t("run.noEvents")}</p> : events.map((event, index) => <EventRow key={`${event.kind}-${index}`} event={event} t={t} />)}</div><pre ref={logScrollRef} className="h-96 overflow-y-auto whitespace-pre-wrap break-words border border-[var(--border-light)] bg-[var(--graphite-950)] p-4 text-xs font-mono leading-relaxed">{logs.length === 0 ? <span className="text-[var(--muted-fg)]">{t("run.noLogs")}</span> : logs.join("\n")}</pre></div>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-light)] pb-3"><div className="flex items-baseline gap-3"><span className="mono-tag text-[var(--accent)]">{eyebrow}</span><h3 className="text-base font-semibold">{title}</h3></div><span className="text-xs text-[var(--muted-fg)]">{detail}</span></div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div><div className="flex items-baseline justify-between gap-3"><span className="field-label">{label}</span>{hint && <span className="text-[10px] font-mono text-[var(--muted-fg)]">{hint}</span>}</div>{children}</div>;
}

function Metric({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return <div className="min-h-[92px] bg-[var(--graphite-900)] p-4"><p className="text-[10px] font-mono uppercase tracking-[.12em] text-[var(--muted-fg)]">{label}</p><p className={`mt-3 text-3xl font-semibold tabular-nums ${emphasis ? "text-[var(--accent)]" : ""}`}>{value}</p></div>;
}

function deriveMetrics(events: ProgressEvent[]): MetricCounts {
  return events.reduce<MetricCounts>((counts, event) => {
    if (event.kind === "job_found") counts.found += 1;
    if (event.kind === "job_skipped") counts.skipped += 1;
    if (event.kind === "error") counts.errors += 1;
    if (event.kind === "letter_sent") {
      const status = event.payload.status;
      if (status === "sent") counts.sent += 1;
      if (status === "dry_run") counts.dryRun += 1;
      if (status === "blocked") counts.blocked += 1;
    }
    return counts;
  }, { found: 0, skipped: 0, sent: 0, dryRun: 0, blocked: 0, errors: 0 });
}

function EventRow({ event, t }: { event: ProgressEvent; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const isError = event.kind === "error" || (event.kind === "loop_ended" && event.payload.reason === "error");
  const isTerminal = event.kind === "loop_ended";
  const reason = event.kind === "loop_ended" ? endedReasonText(t, event.payload.reason) : null;
  return <div className={`border-b border-[var(--border-light)] py-2 last:border-0 ${isError ? "text-[var(--accent)]" : ""}`}><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-[var(--muted-fg)]">{event.kind}</span>{isTerminal && reason && <span className="badge-outline">{reason}</span>}</div><p className="mt-1 break-words text-[var(--ink)]">{eventPayloadText(event) || t("run.emptyPayload")}</p></div>;
}

function eventPayloadText(event: ProgressEvent): string {
  const keys = ["index", "reason", "detail", "score", "threshold", "status", "letter_len", "stage", "message", "matched", "jd_preview", "total"];
  const entries = keys.filter((key) => key in event.payload).map((key) => `${key}=${formatValue(event.payload[key])}`);
  const extras = Object.keys(event.payload).filter((key) => !keys.includes(key)).map((key) => `${key}=${formatValue(event.payload[key])}`);
  return [...entries, ...extras].join(" · ");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "-";
  try { return JSON.stringify(value); } catch { return String(value); }
}

function endedReasonText(t: (key: string, vars?: Record<string, string | number>) => string, reason: unknown): string {
  if (reason === "completed") return t("run.loopCompleted");
  if (reason === "cancelled") return t("run.loopCancelled");
  if (reason === "error") return t("run.loopError");
  return t("run.loopUnknown", { reason: String(reason ?? "-") });
}
