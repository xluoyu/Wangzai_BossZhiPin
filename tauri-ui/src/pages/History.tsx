import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ipc, type LetterRecord, type TelemetrySummary } from "../lib/ipc";
import { useT } from "../store";

type Filter = "all" | "sent" | "dry_run" | "validation_failed";
type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLetterRecord(value: unknown): value is LetterRecord {
  if (!isRecord(value)) return false;
  return typeof value.ts === "string"
    && typeof value.provider === "string"
    && typeof value.model === "string"
    && typeof value.dry_run === "boolean"
    && typeof value.validation_ok === "boolean"
    && Array.isArray(value.validation_reasons)
    && value.validation_reasons.every((reason) => typeof reason === "string")
    && typeof value.sent === "boolean"
    && typeof value.letter_len === "number"
    && Number.isFinite(value.letter_len)
    && typeof value.job_description === "string"
    && typeof value.letter === "string";
}

function isTelemetrySummary(value: unknown): value is TelemetrySummary {
  if (!isRecord(value) || !isRecord(value.by_provider)) return false;
  if (typeof value.total_calls !== "number" || !Number.isFinite(value.total_calls)) return false;
  if (typeof value.total_cost_cny !== "number" || !Number.isFinite(value.total_cost_cny)) return false;
  return Object.values(value.by_provider).every((provider) => isRecord(provider)
    && typeof provider.calls === "number" && Number.isFinite(provider.calls)
    && typeof provider.input_tokens === "number" && Number.isFinite(provider.input_tokens)
    && typeof provider.output_tokens === "number" && Number.isFinite(provider.output_tokens)
    && typeof provider.cost_cny === "number" && Number.isFinite(provider.cost_cny));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function matchesFilter(letter: LetterRecord, filter: Filter): boolean {
  if (filter === "sent") return letter.sent;
  if (filter === "dry_run") return letter.dry_run;
  if (filter === "validation_failed") return !letter.validation_ok;
  return true;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function HistoryPage() {
  const t = useT();
  const requestId = useRef(0);
  const [lettersState, setLettersState] = useState<LoadState<LetterRecord[]>>({ status: "loading" });
  const [telemetryState, setTelemetryState] = useState<LoadState<TelemetrySummary>>({ status: "loading" });
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLettersState({ status: "loading" });
    setTelemetryState({ status: "loading" });

    const [lettersResult, telemetryResult] = await Promise.allSettled([
      ipc.getLetters(200),
      ipc.getTelemetrySummary(),
    ]);
    if (id !== requestId.current) return;

    if (lettersResult.status === "rejected") {
      setLettersState({ status: "error", message: errorMessage(lettersResult.reason) });
    } else if (!Array.isArray(lettersResult.value?.letters)
      || !lettersResult.value.letters.every(isLetterRecord)) {
      setLettersState({ status: "error", message: t("history.malformedLetters") });
    } else {
      setLettersState({ status: "ready", data: [...lettersResult.value.letters].reverse() });
    }

    if (telemetryResult.status === "rejected") {
      setTelemetryState({ status: "error", message: errorMessage(telemetryResult.reason) });
    } else if (!isTelemetrySummary(telemetryResult.value?.summary)) {
      setTelemetryState({ status: "error", message: t("history.malformedTelemetry") });
    } else {
      setTelemetryState({ status: "ready", data: telemetryResult.value.summary });
    }
  }, [t]);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const letters = lettersState.status === "ready" ? lettersState.data : [];
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("history.filterAll") },
    { key: "sent", label: t("history.filterSent") },
    { key: "dry_run", label: t("history.filterDryRun") },
    { key: "validation_failed", label: t("history.filterValidationFailed") },
  ];
  const visibleLetters = letters
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => matchesFilter(record, filter));

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-light)] pb-5">
        <div>
          <p className="eyebrow text-[var(--accent)]">{t("history.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold">{t("history.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted-fg)]">{t("history.subtitle")}</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={lettersState.status === "loading" || telemetryState.status === "loading"} className="btn-outline">
          {t("btn.refresh")}
        </button>
      </header>

      <section aria-labelledby="history-telemetry-heading" className="space-y-4">
        <SectionHeading id="history-telemetry-heading" eyebrow="01" title={t("history.costHeading")} detail={t("history.telemetryScope")} />
        {telemetryState.status === "loading" && <StateMessage>{t("common.loading")}</StateMessage>}
        {telemetryState.status === "error" && <ErrorMessage title={t("history.telemetryError")} message={telemetryState.message} />}
        {telemetryState.status === "ready" && (
          telemetryState.data.total_calls === 0
            ? <StateMessage>{t("history.telemetryEmpty")}</StateMessage>
            : <TelemetryDetails summary={telemetryState.data} />
        )}
      </section>

      <section aria-labelledby="history-letters-heading" className="space-y-4">
        <SectionHeading id="history-letters-heading" eyebrow="02" title={t("history.lettersHeading")} detail={t("history.lettersScope")} />
        {lettersState.status === "ready" && letters.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("history.filtersLabel")}>
            {filters.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-[3px] border px-3 py-2 font-mono text-[11px] transition-colors ${filter === key ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--graphite-950)]" : "border-[var(--border-light)] text-[var(--muted-fg)] hover:border-[var(--accent)] hover:text-[var(--ink)]"}`}
              >
                {label} <span className="ml-1 tabular-nums">{letters.filter((letter) => matchesFilter(letter, key)).length}</span>
              </button>
            ))}
          </div>
        )}
        {lettersState.status === "loading" && <StateMessage>{t("common.loading")}</StateMessage>}
        {lettersState.status === "error" && <ErrorMessage title={t("history.lettersError")} message={lettersState.message} />}
        {lettersState.status === "ready" && letters.length === 0 && <StateMessage>{t("history.empty")}</StateMessage>}
        {lettersState.status === "ready" && letters.length > 0 && visibleLetters.length === 0 && <StateMessage>{t("history.filterEmpty")}</StateMessage>}
        {lettersState.status === "ready" && visibleLetters.length > 0 && (
          <div className="overflow-x-auto rounded-[4px] border border-[var(--border-light)] bg-[var(--graphite-900)]">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[160px]" /><col className="w-[105px]" /><col className="w-[120px]" />
                <col className="w-[95px]" /><col className="w-[95px]" /><col />
              </colgroup>
              <thead className="bg-[var(--graphite-800)]">
                <tr>
                  <Th>{t("history.thTime")}</Th>
                  <Th>{t("history.thProvider")}</Th>
                  <Th>{t("history.thModel")}</Th>
                  <Th>{t("history.thValidation")}</Th>
                  <Th>{t("history.thSent")}</Th>
                  <Th>{t("history.thLetter")}</Th>
                </tr>
              </thead>
              <tbody>
                {visibleLetters.map(({ record, index }) => <LetterRow key={`${record.ts}-${index}`} record={record} index={index} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, detail }: { id: string; eyebrow: string; title: string; detail: string }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-light)] pb-3"><div className="flex items-baseline gap-3"><span className="mono-tag text-[var(--accent)]">{eyebrow}</span><h3 id={id} className="text-base font-semibold">{title}</h3></div><span className="text-xs text-[var(--muted-fg)]">{detail}</span></div>;
}

function StateMessage({ children }: { children: ReactNode }) {
  return <div className="border border-[var(--border-light)] bg-[var(--graphite-900)] px-5 py-10 text-center text-sm text-[var(--muted-fg)]" role="status">{children}</div>;
}

function ErrorMessage({ title, message }: { title: string; message: string }) {
  return <div className="border border-[var(--border-light)] bg-[var(--graphite-900)] p-5" role="alert"><p className="font-mono text-sm text-[var(--accent)]">{title}</p><p className="mt-2 break-words text-sm text-[var(--muted-fg)]">{message}</p></div>;
}

function TelemetryDetails({ summary }: { summary: TelemetrySummary }) {
  const t = useT();
  const providers = Object.entries(summary.by_provider);
  const inputTokens = providers.reduce((total, [, provider]) => total + provider.input_tokens, 0);
  const outputTokens = providers.reduce((total, [, provider]) => total + provider.output_tokens, 0);

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label={t("history.statTotalCalls")} value={summary.total_calls.toLocaleString()} />
      <Metric label={t("history.statTotalCost")} value={`¥${summary.total_cost_cny.toFixed(4)}`} />
      <Metric label={t("history.statTotalTokens")} value={(inputTokens + outputTokens).toLocaleString()} sub={t("history.tokenBreakdown", { input: inputTokens.toLocaleString(), output: outputTokens.toLocaleString() })} />
    </div>
    <div className="overflow-x-auto rounded-[4px] border border-[var(--border-light)] bg-[var(--graphite-900)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[var(--graphite-800)]"><tr><Th>{t("history.thProvider")}</Th><Th>{t("history.statTotalCalls")}</Th><Th>{t("history.inputTokens")}</Th><Th>{t("history.outputTokens")}</Th><Th>{t("history.statTotalCost")}</Th></tr></thead>
        <tbody>{providers.map(([name, data]) => <tr key={name} className="last:[&>td]:border-b-0"><Td className="font-medium">{name}</Td><Td>{data.calls.toLocaleString()}</Td><Td>{data.input_tokens.toLocaleString()}</Td><Td>{data.output_tokens.toLocaleString()}</Td><Td>¥{data.cost_cny.toFixed(4)}</Td></tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="min-h-[100px] border border-[var(--border-light)] bg-[var(--graphite-900)] p-4"><p className="mono-tag">{label}</p><p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">{value}</p>{sub && <p className="mt-2 font-mono text-[11px] text-[var(--muted-fg)]">{sub}</p>}</div>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 font-medium">{children}</th>;
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-3 font-mono text-xs tabular-nums ${className}`}>{children}</td>;
}

function LetterRow({ record, index }: { record: LetterRecord; index: number }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const detailId = `history-detail-${index}`;
  const preview = record.letter.length > 90 ? `${record.letter.slice(0, 90)}…` : record.letter;

  async function copyRecord() {
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return <>
    <tr className="align-top transition-colors hover:bg-[var(--graphite-800)]">
      <Td className="whitespace-nowrap text-[var(--muted-fg)]">{formatTime(record.ts)}</Td>
      <Td className="break-all">{record.provider}</Td>
      <Td className="break-all">{record.model}</Td>
      <Td><span className={record.validation_ok ? "text-[var(--accent)]" : "text-[var(--ink)]"} title={record.validation_reasons.join(", ")}>{record.validation_ok ? t("history.validationPassed") : t("history.validationFailed")}</span></Td>
      <Td>{record.sent ? t("history.statusSent") : record.dry_run ? t("history.statusDryRun") : t("history.statusNotSent")}</Td>
      <td className="px-3 py-3"><button type="button" aria-expanded={expanded} aria-controls={expanded ? detailId : undefined} onClick={() => setExpanded((value) => !value)} className="w-full text-left text-sm leading-relaxed text-[var(--ink)] hover:text-[var(--accent)]"><span className="line-clamp-2 break-words">{preview || t("history.noLetter")}</span><span className="mt-1 block font-mono text-[10px] uppercase text-[var(--muted-fg)]">{expanded ? t("history.collapse") : t("history.expand")}</span></button></td>
    </tr>
    {expanded && <tr id={detailId} className="bg-[var(--graphite-800)]"><td colSpan={6} className="p-4 sm:p-5"><div className="grid gap-5 lg:grid-cols-2">
      <div><p className="mono-tag mb-2">{t("history.jobDescription")}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--ink)]">{record.job_description || t("history.noJobDescription")}</pre></div>
      <div><div className="flex flex-wrap items-center justify-between gap-2"><p className="mono-tag">{t("history.generatedLetter")} · {t("history.letterLength", { count: record.letter_len })}</p><button type="button" className="btn-outline !px-2 !py-1" onClick={() => void copyRecord()}>{t("history.copyRecord")}</button></div><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--ink)]">{record.letter || t("history.noLetter")}</pre><p className={`mt-2 min-h-[1.25rem] font-mono text-xs ${copyState === "failed" ? "text-[var(--ink)]" : "text-[var(--accent)]"}`} role="status">{copyState === "copied" ? t("history.copySuccess") : copyState === "failed" ? t("history.copyFailure") : ""}</p></div>
    </div><div className="mt-5 border-t border-[var(--border-light)] pt-4"><p className="mono-tag mb-2">{t("history.validationReasons")}</p>{record.validation_reasons.length > 0 ? <ul className="space-y-1 font-mono text-xs text-[var(--ink)]">{record.validation_reasons.map((reason, reasonIndex) => <li key={reasonIndex} className="break-words">{reason}</li>)}</ul> : <p className="text-sm text-[var(--muted-fg)]">{t("history.noValidationReasons")}</p>}</div></td></tr>}
  </>;
}
