import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ipc, type TaskRecord, type TelemetrySummary } from "../lib/ipc";
import { useT } from "../store";

type Filter = "all" | "sent" | "rejected" | "failed" | "filtered";
type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function formatTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function matchesFilter(task: TaskRecord, filter: Filter): boolean {
  if (filter === "sent") return task.task_status === "sent";
  if (filter === "rejected") return task.task_status === "rejected";
  if (filter === "failed") return task.task_status === "failed" || task.task_status === "send_failed";
  if (filter === "filtered") return task.task_status === "filtered";
  return true;
}
function isTelemetrySummary(value: unknown): value is TelemetrySummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TelemetrySummary>;
  return typeof candidate.total_calls === "number"
    && typeof candidate.total_cost_cny === "number"
    && !!candidate.by_provider
    && typeof candidate.by_provider === "object";
}

export default function HistoryPage() {
  const t = useT();
  const [tasksState, setTasksState] = useState<LoadState<TaskRecord[]>>({ status: "loading" });
  const [telemetryState, setTelemetryState] = useState<LoadState<TelemetrySummary>>({ status: "loading" });
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    setTasksState({ status: "loading" });
    setTelemetryState({ status: "loading" });
    const [tasksResult, telemetryResult] = await Promise.allSettled([ipc.getTaskQueue(200), ipc.getTelemetrySummary()]);
    if (tasksResult.status === "rejected") setTasksState({ status: "error", message: errorMessage(tasksResult.reason) });
    else setTasksState({ status: "ready", data: tasksResult.value.tasks });
    if (telemetryResult.status === "rejected") setTelemetryState({ status: "error", message: errorMessage(telemetryResult.reason) });
    else if (!isTelemetrySummary(telemetryResult.value?.summary)) setTelemetryState({ status: "error", message: t("history.malformedTelemetry") });
    else setTelemetryState({ status: "ready", data: telemetryResult.value.summary });
  }, [t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const tasks = tasksState.status === "ready" ? tasksState.data : [];
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("history.filterAll") },
    { key: "sent", label: t("history.filterSent") },
    { key: "rejected", label: t("history.filterRejected") },
    { key: "failed", label: t("history.filterFailed") },
    { key: "filtered", label: t("history.filterFiltered") },
  ];
  const visible = useMemo(() => tasks.filter((task) => matchesFilter(task, filter)), [tasks, filter]);

  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-light)] pb-5">
      <div><p className="eyebrow text-[var(--accent)]">{t("history.eyebrow")}</p><h2 className="mt-2 text-2xl font-semibold">{t("history.title")}</h2><p className="mt-2 text-sm text-[var(--muted-fg)]">{t("history.subtitle")}</p></div>
      <button type="button" onClick={() => void refresh()} disabled={tasksState.status === "loading" || telemetryState.status === "loading"} className="btn-outline">{t("btn.refresh")}</button>
    </header>

    <section aria-labelledby="history-telemetry-heading" className="space-y-4">
      <SectionHeading id="history-telemetry-heading" eyebrow="01" title={t("history.costHeading")} detail={t("history.telemetryScope")} />
      {telemetryState.status === "loading" && <StateMessage>{t("common.loading")}</StateMessage>}
      {telemetryState.status === "error" && <ErrorMessage title={t("history.telemetryError")} message={telemetryState.message} />}
      {telemetryState.status === "ready" && (telemetryState.data.total_calls === 0 ? <StateMessage>{t("history.telemetryEmpty")}</StateMessage> : <TelemetryDetails summary={telemetryState.data} />)}
    </section>

    <section aria-labelledby="history-tasks-heading" className="space-y-4">
      <SectionHeading id="history-tasks-heading" eyebrow="02" title={t("history.tasksHeading")} detail={t("history.tasksScope")} />
      {tasksState.status === "loading" && <StateMessage>{t("common.loading")}</StateMessage>}
      {tasksState.status === "error" && <ErrorMessage title={t("history.tasksError")} message={tasksState.message} />}
      {tasksState.status === "ready" && tasks.length === 0 && <StateMessage>{t("history.tasksEmpty")}</StateMessage>}
      {tasksState.status === "ready" && tasks.length > 0 && <>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("history.filtersLabel")}>{filters.map(({ key, label }) => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-[3px] border px-3 py-2 font-mono text-[11px] transition-colors ${filter === key ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--graphite-950)]" : "border-[var(--border-light)] text-[var(--muted-fg)] hover:border-[var(--accent)] hover:text-[var(--ink)]"}`}>{label} <span className="ml-1 tabular-nums">{tasks.filter((task) => matchesFilter(task, key)).length}</span></button>)}</div>
        {!visible.length ? <StateMessage>{t("history.filterEmpty")}</StateMessage> : <div className="space-y-3">{visible.map((task) => <TaskRow key={task.task_id} task={task} />)}</div>}
      </>}
    </section>
  </div>;
}

function SectionHeading({ id, eyebrow, title, detail }: { id: string; eyebrow: string; title: string; detail: string }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-light)] pb-3"><div className="flex items-baseline gap-3"><span className="mono-tag text-[var(--accent)]">{eyebrow}</span><h3 id={id} className="text-base font-semibold">{title}</h3></div><span className="text-xs text-[var(--muted-fg)]">{detail}</span></div>;
}
function StateMessage({ children }: { children: ReactNode }) { return <div className="border border-[var(--border-light)] bg-[var(--graphite-900)] px-5 py-10 text-center text-sm text-[var(--muted-fg)]" role="status">{children}</div>; }
function ErrorMessage({ title, message }: { title: string; message: string }) { return <div className="border border-[var(--border-light)] bg-[var(--graphite-900)] p-5" role="alert"><p className="font-mono text-sm text-[var(--accent)]">{title}</p><p className="mt-2 break-words text-sm text-[var(--muted-fg)]">{message}</p></div>; }
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) { return <div className="min-h-[100px] border border-[var(--border-light)] bg-[var(--graphite-900)] p-4"><p className="mono-tag">{label}</p><p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">{value}</p>{sub && <p className="mt-2 font-mono text-[11px] text-[var(--muted-fg)]">{sub}</p>}</div>; }
function TelemetryDetails({ summary }: { summary: TelemetrySummary }) {
  const t = useT();
  const providers = Object.entries(summary.by_provider);
  const inputTokens = providers.reduce((total, [, provider]) => total + provider.input_tokens, 0);
  const outputTokens = providers.reduce((total, [, provider]) => total + provider.output_tokens, 0);
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label={t("history.statTotalCalls")} value={summary.total_calls.toLocaleString()} /><Metric label={t("history.statTotalCost")} value={`¥${summary.total_cost_cny.toFixed(4)}`} /><Metric label={t("history.statTotalTokens")} value={(inputTokens + outputTokens).toLocaleString()} sub={t("history.tokenBreakdown", { input: inputTokens.toLocaleString(), output: outputTokens.toLocaleString() })} /></div><div className="overflow-x-auto rounded-[4px] border border-[var(--border-light)] bg-[var(--graphite-900)]"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-[var(--graphite-800)]"><tr><Th>{t("history.thProvider")}</Th><Th>{t("history.statTotalCalls")}</Th><Th>{t("history.inputTokens")}</Th><Th>{t("history.outputTokens")}</Th><Th>{t("history.statTotalCost")}</Th></tr></thead><tbody>{providers.map(([name, data]) => <tr key={name} className="last:[&>td]:border-b-0"><Td className="font-medium">{name}</Td><Td>{data.calls.toLocaleString()}</Td><Td>{data.input_tokens.toLocaleString()}</Td><Td>{data.output_tokens.toLocaleString()}</Td><Td>¥{data.cost_cny.toFixed(4)}</Td></tr>)}</tbody></table></div></div>;
}
function Th({ children }: { children: ReactNode }) { return <th className="px-3 py-3">{children}</th>; }
function Td({ children, className = "" }: { children: ReactNode; className?: string }) { return <td className={`px-3 py-3 align-top ${className}`}>{children}</td>; }
function TaskRow({ task }: { task: TaskRecord }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  async function copyRecord() {
    try { await navigator.clipboard.writeText(JSON.stringify(task, null, 2)); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  const statusLabel = task.task_status === "sent" ? t("history.statusSent") : task.task_status === "rejected" ? t("history.statusRejected") : task.task_status === "filtered" ? t("history.statusFiltered") : t("history.statusFailed");
  return <article className="border border-[var(--border-light)] bg-[var(--graphite-900)]"><button type="button" className="w-full p-4 text-left" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}><div className="flex flex-wrap items-center gap-2"><span className="badge-invert">{statusLabel}</span><span className="font-semibold">{task.job_title || t("review.untitled")}</span><span className="text-sm text-[var(--muted-fg)]">{task.company_name || t("review.unknownCompany")}</span><span className="ml-auto font-mono text-[10px] text-[var(--muted-fg)]">{formatTime(task.sent_at || task.finished_at || task.started_at)}</span></div><p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">{task.greeting || task.failure_reason || task.jd || t("review.noGreeting")}</p></button>{expanded && <div className="grid gap-5 border-t border-[var(--border-light)] p-4 lg:grid-cols-2"><div><p className="mono-tag mb-2">{t("review.jobDescription")}</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{task.jd || t("review.noJobDescription")}</pre></div><div><div className="flex items-center justify-between gap-2"><p className="mono-tag">{t("review.greeting")}</p><button type="button" className="btn-outline !px-2 !py-1" onClick={(event) => { event.stopPropagation(); void copyRecord(); }}>{t("history.copyRecord")}</button></div><pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{task.greeting || task.failure_reason || t("review.noGreeting")}</pre><p className="mt-2 min-h-[1.25rem] font-mono text-xs text-[var(--accent)]" role="status">{copyState === "copied" ? t("history.copySuccess") : copyState === "failed" ? t("history.copyFailure") : ""}</p></div></div>}</article>;
}
