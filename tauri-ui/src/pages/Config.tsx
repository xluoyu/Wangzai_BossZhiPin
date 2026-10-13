import { useEffect, useRef, useState } from "react";
import { ipc, type EnvField, type LlmConfig } from "../lib/ipc";
import { isLang, LANGS, type Lang } from "../lib/i18n";
import { useRunStore, useT } from "../store";

export default function ConfigPage() {
  const t = useT();
  const lang = useRunStore((state) => state.lang);
  const setLang = useRunStore((state) => state.setLang);
  const setFormState = useRunStore((state) => state.setFormState);
  const languageChanged = useRef(false);

  const [llm, setLlm] = useState<LlmConfig | null>(null);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [preset, setPreset] = useState("");
  const [keyEdit, setKeyEdit] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [fields, setFields] = useState<EnvField[] | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState<string | null>(null);
  const [envEdits, setEnvEdits] = useState<Record<string, string>>({});

  const [promptInitial, setPromptInitial] = useState<string | null>(null);
  const [promptDefault, setPromptDefault] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [languageLoading, setLanguageLoading] = useState(true);
  const [languageBusy, setLanguageBusy] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [languageErrorKind, setLanguageErrorKind] = useState<"load" | "save" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadLlm() {
    setLlmLoading(true);
    setLlmError(null);
    try {
      const next = await ipc.getLlmConfig();
      setLlm(next);
      setBaseUrl(next.baseUrl);
      setModel(next.model);
      setPreset(next.presets.find((item) => item.baseUrl === next.baseUrl && item.model === next.model)?.name ?? "");
      setKeyEdit("");
      setShowKey(false);
    } catch (error) {
      setLlmError(String(error));
      throw error;
    } finally {
      setLlmLoading(false);
    }
  }

  async function loadEnv(savedKeys?: string[]) {
    setEnvLoading(true);
    setEnvError(null);
    try {
      const { fields: next } = await ipc.getEnvFields();
      setFields(next);
      setEnvEdits({});
      const current = useRunStore.getState();
      const updates: { formUsrName?: string; formLabel?: string } = {};
      const name = next.find((field) => field.key === "BOSS_USR_NAME")?.value;
      const label = next.find((field) => field.key === "BOSS_LABEL")?.value;
      if (name !== undefined && (savedKeys?.includes("BOSS_USR_NAME") || (!savedKeys && !current.formUsrName && name))) updates.formUsrName = name;
      if (label !== undefined && (savedKeys?.includes("BOSS_LABEL") || (!savedKeys && !current.formLabel && label))) updates.formLabel = label;
      if (Object.keys(updates).length > 0) setFormState(updates);
    } catch (error) {
      setEnvError(String(error));
      throw error;
    } finally {
      setEnvLoading(false);
    }
  }

  async function loadPrompt() {
    setPromptLoading(true);
    setPromptError(null);
    try {
      const next = await ipc.getLetterPrompt();
      setPromptInitial(next.prompt);
      setPrompt(next.prompt);
      setPromptDefault(next.default);
    } catch (error) {
      setPromptError(String(error));
      throw error;
    } finally {
      setPromptLoading(false);
    }
  }

  async function loadLanguage() {
    setLanguageLoading(true);
    setLanguageError(null);
    setLanguageErrorKind(null);
    try {
      const { lang: persisted } = await ipc.getLanguage();
      if (!languageChanged.current && isLang(persisted)) setLang(persisted);
    } catch (error) {
      if (!languageChanged.current) {
        setLanguageError(String(error));
        setLanguageErrorKind("load");
      }
    } finally {
      setLanguageLoading(false);
    }
  }

  useEffect(() => {
    void Promise.allSettled([loadLlm(), loadEnv(), loadPrompt(), loadLanguage()]);
  }, []);

  const llmDirty = llm !== null && (baseUrl !== llm.baseUrl || model !== llm.model || keyEdit.trim() !== "");
  const envUpdates = Object.fromEntries((fields ?? [])
    .filter((field) => field.key in envEdits && envEdits[field.key] !== field.value)
    .map((field) => [field.key, envEdits[field.key]]));
  const envDirty = Object.keys(envUpdates).length > 0;
  const promptDirty = promptInitial !== null && prompt !== promptInitial;
  const dirty = llmDirty || envDirty || promptDirty;
  const selectedPreset = llm?.presets.find((item) => item.name === preset);

  function editField(field: EnvField, value: string) {
    setSaved(false);
    setEnvEdits((previous) => {
      const next = { ...previous };
      if (value === field.value) delete next[field.key];
      else next[field.key] = value;
      return next;
    });
  }

  function choosePreset(name: string) {
    setSaved(false);
    setPreset(name);
    const selected = llm?.presets.find((item) => item.name === name);
    if (selected) {
      setBaseUrl(selected.baseUrl);
      setModel(selected.model);
    }
  }

  function discard() {
    if (llm) {
      setBaseUrl(llm.baseUrl);
      setModel(llm.model);
      setPreset(llm.presets.find((item) => item.baseUrl === llm.baseUrl && item.model === llm.model)?.name ?? "");
    }
    setKeyEdit("");
    setShowKey(false);
    setEnvEdits({});
    if (promptInitial !== null) setPrompt(promptInitial);
    setSaveError(null);
    setSaved(false);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const errors: string[] = [];
    if (llmDirty) {
      try {
        await ipc.setLlmConfig(baseUrl.trim(), model.trim(), keyEdit.trim());
        await loadLlm();
      } catch (error) {
        errors.push(`${t("config.endpoint")}: ${String(error)}`);
      }
    }
    if (envDirty) {
      try {
        await ipc.writeEnvFields(envUpdates);
        await loadEnv(Object.keys(envUpdates));
      } catch (error) {
        errors.push(`${t("config.general")}: ${String(error)}`);
      }
    }
    if (promptDirty) {
      try {
        await ipc.setLetterPrompt(prompt.trim());
        await loadPrompt();
      } catch (error) {
        errors.push(`${t("config.letterPrompt")}: ${String(error)}`);
      }
    }
    setSaveError(errors.length > 0 ? errors.join("\n") : null);
    setSaved(errors.length === 0);
    setSaving(false);
  }

  async function changeLanguage(next: Lang) {
    languageChanged.current = true;
    setLang(next);
    setLanguageBusy(true);
    setLanguageError(null);
    setLanguageErrorKind(null);
    try {
      await ipc.setLanguage(next);
    } catch (error) {
      setLanguageError(String(error));
      setLanguageErrorKind("save");
    } finally {
      setLanguageBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-light)] pb-5">
        <div><p className="eyebrow">Workspace / Config</p><h2 className="mt-2 text-2xl font-semibold">{t("config.title")}</h2><p className="mt-2 text-xs text-[var(--muted-fg)]">{t("config.localNote")}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          {saved && !dirty && <span className="badge-invert" role="status">{t("config.saved")}</span>}
          {dirty && <span className="badge-outline">{t("config.unsaved")}</span>}
          <button type="button" className="btn-outline" onClick={discard} disabled={!dirty || saving}>{t("config.discard")}</button>
          <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>{saving ? t("btn.saving") : t("btn.save")}</button>
        </div>
      </header>

      {saveError && <pre className="whitespace-pre-wrap break-words border border-red-500/50 bg-red-950/20 p-3 text-xs text-red-300" role="alert">{saveError}</pre>}

      <section className="panel space-y-5" aria-labelledby="config-endpoint">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-light)] pb-4">
          <div><h3 id="config-endpoint" className="text-base font-semibold">{t("config.endpoint")}</h3><p className="mt-1 text-xs text-[var(--muted-fg)]">{t("config.endpointHint")}</p></div>
          {llm && <span className={llm.hasKey ? "badge-invert" : "badge-outline"}>{llm.hasKey ? t("config.configured") : t("config.notConfigured")}</span>}
        </div>
        {llmLoading && !llm && <p className="text-xs text-[var(--muted-fg)]">{t("common.loading")}</p>}
        {llmError && <div className="flex flex-wrap items-center gap-3 text-xs text-red-300" role="alert"><span>{t("config.loadFailed")}: {llmError}</span><button type="button" className="btn-ghost" onClick={() => void loadLlm().catch(() => {})} disabled={saving || llmLoading}>{t("config.retry")}</button></div>}
        {llm && <div className="grid gap-5 md:grid-cols-2">
          <label className="block md:col-span-2"><span className="field-label">{t("config.preset")}</span><select className="field-input" value={preset} onChange={(event) => choosePreset(event.target.value)} disabled={saving || llmLoading}><option value="">{t("config.custom")}</option>{llm.presets.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}</select></label>
          <label className="block"><span className="field-label">LLM_BASE_URL</span><input className="field-input font-mono" value={baseUrl} onChange={(event) => { setSaved(false); setBaseUrl(event.target.value); setPreset(""); }} placeholder={t("config.baseUrlPlaceholder")} disabled={saving || llmLoading} /></label>
          <label className="block"><span className="field-label">LLM_MODEL</span><input className="field-input font-mono" value={model} onChange={(event) => { setSaved(false); setModel(event.target.value); setPreset(""); }} placeholder={t("config.modelPlaceholder")} disabled={saving || llmLoading} /></label>
          <div className="md:col-span-2">
            <label htmlFor="config-api-key" className="field-label">LLM_API_KEY</label>
            <div className="flex gap-2"><input id="config-api-key" className="field-input min-w-0 flex-1 font-mono" type={showKey ? "text" : "password"} value={keyEdit} onChange={(event) => { setSaved(false); setKeyEdit(event.target.value); }} placeholder={llm.hasKey ? t("config.keyConfiguredPlaceholder") : t("config.keyEmptyPlaceholder")} autoComplete="off" disabled={saving || llmLoading} /><button type="button" className="btn-outline shrink-0" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? t("config.hideKeyAria") : t("config.showKeyAria")}>{showKey ? t("btn.hide") : t("btn.show")}</button></div>
            <p className="mt-2 text-xs text-[var(--muted-fg)]">{t("config.keyHint")}</p>
            {selectedPreset && <p className="mt-2 break-all text-xs text-[var(--muted-fg)]">{t("config.signup", { url: selectedPreset.signupUrl })}</p>}
          </div>
        </div>}
      </section>

      <section className="panel space-y-5" aria-labelledby="config-general">
        <div className="border-b border-[var(--border-light)] pb-4"><h3 id="config-general" className="text-base font-semibold">{t("config.general")}</h3><p className="mt-1 text-xs text-[var(--muted-fg)]">{t("config.generalHint")}</p></div>
        {envLoading && !fields && <p className="text-xs text-[var(--muted-fg)]">{t("common.loading")}</p>}
        {envError && <div className="flex flex-wrap items-center gap-3 text-xs text-red-300" role="alert"><span>{t("config.loadFailed")}: {envError}</span><button type="button" className="btn-ghost" onClick={() => void loadEnv().catch(() => {})} disabled={saving || envLoading}>{t("config.retry")}</button></div>}
        {fields && (fields.length === 0 ? <p className="text-xs text-[var(--muted-fg)]">{t("config.noFields")}</p> : <div className="divide-y divide-[var(--border-light)]">{fields.map((field) => {
          const translated = t(`field.${field.key}`);
          return <label key={field.key} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)] md:items-center">
            <span><span className="field-label break-all">{field.key}</span><span className="block text-sm">{translated === `field.${field.key}` ? field.label || field.key : translated}</span>{field.isSecret && <span className="mt-1 block text-xs text-[var(--muted-fg)]">{t("config.secret")}</span>}</span>
            <input className="field-input min-w-0 font-mono" type={field.isSecret ? "password" : "text"} value={envEdits[field.key] ?? field.value} onChange={(event) => editField(field, event.target.value)} disabled={saving || envLoading} />
          </label>;
        })}</div>)}
      </section>

      <section className="panel space-y-5" aria-labelledby="config-prompt">
        <div className="border-b border-[var(--border-light)] pb-4"><h3 id="config-prompt" className="text-base font-semibold">{t("config.letterPrompt")}</h3><p className="mt-1 text-xs text-[var(--muted-fg)]">{t("config.letterPromptHint")}</p></div>
        {promptLoading && promptInitial === null && <p className="text-xs text-[var(--muted-fg)]">{t("common.loading")}</p>}
        {promptError && <div className="flex flex-wrap items-center gap-3 text-xs text-red-300" role="alert"><span>{t("config.loadFailed")}: {promptError}</span><button type="button" className="btn-ghost" onClick={() => void loadPrompt().catch(() => {})} disabled={saving || promptLoading}>{t("config.retry")}</button></div>}
        {promptInitial !== null && <>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className={prompt.trim() ? "badge-invert" : "badge-outline"}>{prompt.trim() ? t("config.customActive") : t("config.defaultActive")}</span><button type="button" className="btn-ghost" onClick={() => { setSaved(false); setPrompt(""); }} disabled={!prompt || saving || promptLoading}>{t("btn.resetDefault")}</button></div>
          <textarea className="field-input min-h-40 resize-y font-mono text-sm leading-relaxed" value={prompt} onChange={(event) => { setSaved(false); setPrompt(event.target.value); }} placeholder={t("config.letterPromptPlaceholder")} disabled={saving || promptLoading} aria-label={t("config.letterPrompt")} />
          <details className="border-t border-[var(--border-light)] pt-4"><summary className="cursor-pointer text-xs text-[var(--muted-fg)]">{t("config.defaultReference")}</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted-fg)]">{promptDefault}</pre></details>
        </>}
      </section>

      <section className="panel space-y-4" aria-labelledby="config-language">
        <div><h3 id="config-language" className="text-base font-semibold">{t("config.language")}</h3><p className="mt-1 text-xs text-[var(--muted-fg)]">{t("config.languageHint")}</p></div>
        <select className="field-input max-w-sm" value={lang} onChange={(event) => void changeLanguage(event.target.value as Lang)} disabled={languageBusy}>{LANGS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        {languageLoading && <p className="text-xs text-[var(--muted-fg)]">{t("common.loading")}</p>}
        {languageError && <p className="text-xs text-red-300" role="alert">{t(languageErrorKind === "save" ? "config.languageSaveFailed" : "config.loadFailed")}: {languageError}</p>}
      </section>
    </div>
  );
}
