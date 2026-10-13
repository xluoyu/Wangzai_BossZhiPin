import { useEffect, useRef, useState } from "react";
import RunPage from "./pages/Run";
import ConfigPage from "./pages/Config";
import HistoryPage from "./pages/History";
import UpdateBanner from "./components/UpdateBanner";
import { useRunStore, useT } from "./store";
import { ipc } from "./lib/ipc";
import { isLang } from "./lib/i18n";

type Tab = "run" | "config" | "history";

export default function App() {
  const [tab, setTab] = useState<Tab>("run");
  const [helpMsg, setHelpMsg] = useState<string | null>(null);
  const [runStateLoad, setRunStateLoad] = useState<"loading" | "ready" | "error">("loading");
  const [runStateRetry, setRunStateRetry] = useState(0);
  const hydratedBackendRunning = useRef(false);
  const running = useRunStore((s) => s.running);
  const currentIndex = useRunStore((s) => s.currentIndex);
  const events = useRunStore((s) => s.events);
  const setRunning = useRunStore((s) => s.setRunning);
  const setLang = useRunStore((s) => s.setLang);
  const t = useT();

  // 「问 AI 帮忙」：把 app 上下文 + 当前实时日志缓冲打成一段求助文本复制到剪贴板，
  // 用户粘到任意聊天 AI 即可。常驻 header，每个 tab 都点得到（不只出错时）。
  async function askAi() {
    try {
      const logs = useRunStore.getState().logs;
      const { text } = await ipc.getAiHelpReport(logs);
      await navigator.clipboard.writeText(text);
      setHelpMsg(t("askai.ok"));
    } catch {
      setHelpMsg(t("askai.fail"));
    }
    setTimeout(() => setHelpMsg(null), 6000);
  }

  // 启动时读回 .env 里存的 UI 语言，覆盖系统探测的默认。
  // 没设过（首次启动）则把探测到的默认落进 .env，让后端报错（读 BOSS_LANG）跟
  // 前端展示的语言一致——否则非中文用户首次见到的后端串会是中文。读/写失败都
  // 静默：大不了下次启动再探测一次，不打断使用。
  useEffect(() => {
    let cancelled = false;
    let languageChanged = false;
    const unsubscribe = useRunStore.subscribe((state, previous) => {
      if (state.lang !== previous.lang) languageChanged = true;
    });
    ipc.getLanguage()
      .then(({ lang }) => {
        if (cancelled || languageChanged) return;
        if (isLang(lang)) {
          setLang(lang);
        } else {
          const detected = useRunStore.getState().lang;
          ipc.setLanguage(detected).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setLang]);

  useEffect(() => {
    let cancelled = false;
    let runStateChanged = false;
    const unsubscribe = useRunStore.subscribe((state, previous) => {
      if (state.running !== previous.running || state.events !== previous.events) {
        runStateChanged = true;
      }
    });
    ipc.isRunning()
      .then(({ running: backendRunning }) => {
        if (cancelled) return;
        if (!runStateChanged) {
          hydratedBackendRunning.current = backendRunning;
          setRunning(backendRunning);
        }
        setRunStateLoad("ready");
      })
      .catch(() => {
        if (!cancelled) setRunStateLoad("error");
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [runStateRetry, setRunning]);

  useEffect(() => {
    if (runStateLoad !== "ready") return;

    let cancelled = false;
    let timer: number | undefined;
    let stateVersion = 0;
    let backendConfirmed = hydratedBackendRunning.current;
    const unsubscribe = useRunStore.subscribe((state, previous) => {
      if (state.running !== previous.running || state.events !== previous.events) stateVersion += 1;
      if (state.running && !previous.running) {
        backendConfirmed = false;
      } else if (!state.running && previous.running) {
        backendConfirmed = false;
      }
    });

    // A reloaded webview loses the old progress channel, so reconcile with the backend.
    async function pollRunning() {
      const requestVersion = stateVersion;
      try {
        const { running: backendRunning } = await ipc.isRunning();
        if (cancelled || requestVersion !== stateVersion) return;
        const localRunning = useRunStore.getState().running;
        if (backendRunning) {
          if (!localRunning) setRunning(true);
          backendConfirmed = true;
        } else if (localRunning && backendConfirmed) {
          // Leave unconfirmed optimistic starts to startRun and its event channel.
          setRunning(false);
        }
      } catch {
        // Keep the last known state until the backend can answer again.
      } finally {
        if (!cancelled) timer = window.setTimeout(pollRunning, 2_000);
      }
    }

    timer = window.setTimeout(pollRunning, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [runStateLoad, setRunning]);

  const pageTitle = t(`tab.${tab}`);
  const lastTerminal = [...events].reverse().find((event) => event.kind === "loop_ended" || event.kind === "error");
  const statusText = running
    ? currentIndex === null
      ? t("run.statusStarting")
      : t("run.statusRunningJob", { index: currentIndex })
    : lastTerminal?.kind === "error" || lastTerminal?.payload.reason === "error"
      ? t("run.loopError")
      : lastTerminal?.payload.reason === "cancelled"
        ? t("run.loopCancelled")
        : lastTerminal?.payload.reason === "completed"
          ? t("run.loopCompleted")
          : t("run.statusIdle");

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Application navigation">
        <div className="brand-lockup">
          <div className="brand-mark">B<span>·</span>Z</div>
          <div className="brand-name">BossZhipin</div>
          <div className="brand-caption">Job helper</div>
        </div>
        <nav className="side-nav">
          <TabButton current={tab} value="run" onClick={setTab}>
            <span className="nav-index">01</span>{t("tab.run")}
          </TabButton>
          <TabButton current={tab} value="config" onClick={setTab}>
            <span className="nav-index">02</span>{t("tab.config")}
          </TabButton>
          <TabButton current={tab} value="history" onClick={setTab}>
            <span className="nav-index">03</span>{t("tab.history")}
          </TabButton>
        </nav>
        <div className="sidebar-foot">AUTO GREETING<br />JOB HELPER</div>
      </aside>

      <section className="app-main">
        <UpdateBanner />
        <header className="topbar">
          <div>
            <span className="eyebrow">Workspace / {tab}</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className={`run-status ${running ? "is-running" : ""}`} aria-live="polite">
              <span className="status-dot" aria-hidden="true" />
              <span>{statusText}</span>
            </div>
            <button onClick={askAi} className="ask-ai-btn">
              <span aria-hidden="true">↗</span> {t("header.askAi")}
            </button>
            {helpMsg ? <span className="help-message" role="status">{helpMsg}</span> : null}
          </div>
        </header>

        <main className="content-scroll">
          <div className="content-inner">
            {tab === "run" && (
              runStateLoad === "ready" ? <RunPage /> :
              runStateLoad === "loading" ? <div role="status">{t("common.loading")}</div> :
              <div role="alert">
                {t("config.loadFailed")}
                <button className="btn-outline ml-3" onClick={() => {
                  setRunStateLoad("loading");
                  setRunStateRetry((retry) => retry + 1);
                }}>{t("config.retry")}</button>
              </div>
            )}
            <div hidden={tab !== "config"}><ConfigPage /></div>
            {tab === "history" && <HistoryPage />}
          </div>
        </main>
      </section>
    </div>
  );
}

function TabButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Tab;
  value: Tab;
  onClick: (t: Tab) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`side-nav-item ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
}
