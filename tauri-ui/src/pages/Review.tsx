import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ipc, type TaskRecord } from "../lib/ipc";
import { useT } from "../store";

type QueueView = "pending_review" | "approved_pending_send";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function ReviewPage() {
  const t = useT();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [view, setView] = useState<QueueView>("pending_review");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ipc.getReviewTasks();
      setTasks(response.tasks);
      setSelected(new Set());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(
    () => tasks.filter((task) => task.task_status === view),
    [tasks, view],
  );
  const selectedVisible = visible.filter((task) => selected.has(task.task_id));

  function toggle(taskId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = visible.length > 0 && visible.every((task) => next.has(task.task_id));
      visible.forEach((task) => allSelected ? next.delete(task.task_id) : next.add(task.task_id));
      return next;
    });
  }

  async function runAction(action: "approve" | "reject" | "send", taskIds = [...selected]) {
    if (!taskIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ipc.reviewTasks(taskIds, action);
      if (result.errors.length) setError(result.errors.map((item) => `${item.task_id}: ${item.message}`).join("\n"));
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const allSelected = visible.length > 0 && visible.every((task) => selected.has(task.task_id));

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-light)] pb-5">
        <div>
          <p className="eyebrow text-[var(--accent)]">{t("review.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold">{t("review.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-fg)]">{t("review.subtitle")}</p>
        </div>
        <button type="button" className="btn-outline" onClick={() => void refresh()} disabled={loading || busy}>
          {t("btn.refresh")}
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-light)] pb-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("review.viewsLabel")}>
          <ViewButton active={view === "pending_review"} onClick={() => { setView("pending_review"); setSelected(new Set()); }}>
            {t("review.pendingReview")} <Count value={tasks.filter((task) => task.task_status === "pending_review").length} />
          </ViewButton>
          <ViewButton active={view === "approved_pending_send"} onClick={() => { setView("approved_pending_send"); setSelected(new Set()); }}>
            {t("review.pendingSend")} <Count value={tasks.filter((task) => task.task_status === "approved_pending_send").length} />
          </ViewButton>
        </div>
        <span className="mono-tag">{t("review.selected", { count: selectedVisible.length })}</span>
      </div>

      {error && <div className="whitespace-pre-wrap border border-[var(--accent)] bg-[var(--graphite-900)] p-4 text-sm" role="alert">{error}</div>}
      {loading && <StateMessage>{t("common.loading")}</StateMessage>}
      {!loading && !visible.length && <StateMessage>{view === "pending_review" ? t("review.emptyReview") : t("review.emptySend")}</StateMessage>}
      {!loading && visible.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 font-mono text-xs text-[var(--muted-fg)]">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t("review.selectAll")} />
              {t("review.selectAll")}
            </label>
            {view === "pending_review" ? <>
              <button type="button" className="btn" disabled={busy || !selectedVisible.length} onClick={() => void runAction("approve")}>{t("review.approve")}</button>
              <button type="button" className="btn-outline" disabled={busy || !selectedVisible.length} onClick={() => void runAction("reject")}>{t("review.reject")}</button>
            </> : <button type="button" className="btn" disabled={busy || !selectedVisible.length} onClick={() => void runAction("send")}>{t("review.send")}</button>}
          </div>
          <div className="space-y-3">
            {visible.map((task) => <TaskCard key={task.task_id} task={task} selected={selected.has(task.task_id)} busy={busy} onToggle={() => toggle(task.task_id)} onAction={(action) => void runAction(action, [task.task_id])} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-[3px] border px-3 py-2 font-mono text-[11px] transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--graphite-950)]" : "border-[var(--border-light)] text-[var(--muted-fg)] hover:border-[var(--accent)] hover:text-[var(--ink)]"}`}>{children}</button>;
}

function Count({ value }: { value: number }) {
  return <span className="ml-1 tabular-nums">{value}</span>;
}

function StateMessage({ children }: { children: ReactNode }) {
  return <div className="border border-[var(--border-light)] bg-[var(--graphite-900)] px-5 py-10 text-center text-sm text-[var(--muted-fg)]" role="status">{children}</div>;
}

function TaskCard({
  task,
  selected,
  busy,
  onToggle,
  onAction,
}: {
  task: TaskRecord;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onAction: (action: "approve" | "reject" | "send") => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const action = task.task_status === "pending_review" ? "approve" : "send";
  return <article className="panel">
    <div className="flex flex-wrap items-start gap-4">
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label={task.job_title || task.task_id} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{task.job_title || t("review.untitled")}</h3>
          <span className="badge-outline">{task.task_status === "pending_review" ? t("review.statusPending") : t("review.statusApproved")}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--muted-fg)]">{task.company_name || t("review.unknownCompany")}</p>
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">{task.greeting || t("review.noGreeting")}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--muted-fg)]">
          <span>{t("review.createdAt")}: {formatTime(task.started_at)}</span>
          <span>{t("review.taskId")}: {task.task_id.slice(-10)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" className="btn-outline" disabled={busy} onClick={() => setExpanded((value) => !value)}>{expanded ? t("review.collapse") : t("review.details")}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => onAction(action)}>{action === "approve" ? t("review.approve") : t("review.send")}</button>
        {task.task_status === "pending_review" && <button type="button" className="btn-outline" disabled={busy} onClick={() => onAction("reject")}>{t("review.reject")}</button>}
      </div>
    </div>
    {expanded && <div className="mt-5 grid gap-5 border-t border-[var(--border-light)] pt-5 lg:grid-cols-2">
      <div>
        <p className="mono-tag mb-2">{t("review.jobDescription")}</p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--ink)]">{task.jd || t("review.noJobDescription")}</pre>
        {task.job_url && <a className="mt-3 block break-all text-xs text-[var(--accent)]" href={task.job_url} target="_blank" rel="noreferrer">{task.job_url}</a>}
      </div>
      <div>
        <p className="mono-tag mb-2">{t("review.greeting")}</p>
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--ink)]">{task.greeting || t("review.noGreeting")}</pre>
        {task.failure_reason && <p className="mt-4 text-sm text-[var(--accent)]">{task.failure_reason}</p>}
      </div>
    </div>}
  </article>;
}
