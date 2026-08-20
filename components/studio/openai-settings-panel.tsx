"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  loadOpenAiSettings,
  maskApiKey,
  OPENAI_MODEL_OPTIONS,
  saveOpenAiSettings,
  type OpenAiSettings,
} from "@/lib/studio/ai/openai-settings";

type OpenAiSettingsPanelProps = {
  onSaved?: () => void;
};

function mergeModelOptions(currentModel: string, fetched: string[]): string[] {
  const merged = [...OPENAI_MODEL_OPTIONS, ...fetched];
  if (currentModel.trim()) merged.push(currentModel.trim());
  return [...new Set(merged)];
}

export function OpenAiSettingsPanel({ onSaved }: OpenAiSettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OPENAI_BASE_URL);
  const [model, setModel] = useState(DEFAULT_OPENAI_MODEL);
  const [modelOptions, setModelOptions] = useState<string[]>([...OPENAI_MODEL_OPTIONS]);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [fetchHint, setFetchHint] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const settings = loadOpenAiSettings();
    if (settings) {
      setApiKey(settings.apiKey);
      setBaseUrl(settings.baseUrl ?? DEFAULT_OPENAI_BASE_URL);
      setModel(settings.model);
      setModelOptions(mergeModelOptions(settings.model, []));
      setConfigured(true);
    }

    void fetch("/api/studio/openai-settings")
      .then((res) => res.json())
      .then((data) => {
        setServerConfigured(Boolean(data.configured));
        if (!settings && data.configured && data.settings) {
          setBaseUrl(data.settings.baseUrl || DEFAULT_OPENAI_BASE_URL);
          setModel(data.settings.model || DEFAULT_OPENAI_MODEL);
          setModelOptions(mergeModelOptions(data.settings.model || "", []));
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const selectOptions = useMemo(() => mergeModelOptions(model, modelOptions), [model, modelOptions]);

  async function handleSave() {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setSavedHint("请填写 API Key");
      return;
    }

    const next: OpenAiSettings = {
      apiKey: trimmedKey,
      model: model.trim() || DEFAULT_OPENAI_MODEL,
      baseUrl: baseUrl.trim() || DEFAULT_OPENAI_BASE_URL,
    };
    saveOpenAiSettings(next);
    setConfigured(true);
    setSaving(true);
    setSavedHint("本机已保存，正在同步服务端…");

    try {
      const res = await fetch("/api/studio/openai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) {
        setSavedHint(
          `本机已保存 ${maskApiKey(trimmedKey)}；服务端同步失败：${data.error ?? res.status}`
        );
        return;
      }
      setServerConfigured(true);
      setSavedHint(
        `已保存 ${maskApiKey(trimmedKey)}：本机 + 服务端（反馈可自动挂需求）`
      );
      onSaved?.();
    } catch {
      setSavedHint(`本机已保存 ${maskApiKey(trimmedKey)}；服务端同步网络错误`);
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchModels() {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setFetchHint("请先填写 API Key");
      return;
    }

    setFetchingModels(true);
    setFetchHint(null);

    try {
      const res = await fetch("/api/studio/openai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openAiApiKey: trimmedKey,
          openAiBaseUrl: baseUrl.trim() || DEFAULT_OPENAI_BASE_URL,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchHint(data.error ?? "拉取模型失败");
        return;
      }

      const models = Array.isArray(data.models) ? (data.models as string[]) : [];
      if (models.length === 0) {
        setFetchHint("未获取到模型");
        return;
      }

      setModelOptions(mergeModelOptions(model, models));
      if (!models.includes(model)) {
        setModel(models[0]);
      }
      setFetchHint(`已拉取 ${models.length} 个模型`);
    } catch (e) {
      setFetchHint(
        e instanceof Error ? `网络错误：${e.message}` : "网络错误，请稍后重试"
      );
    } finally {
      setFetchingModels(false);
    }
  }

  async function handleTestConnection() {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setFetchHint("请先填写 API Key");
      return;
    }

    setFetchingModels(true);
    setFetchHint("正在测试联通…");

    try {
      const res = await fetch("/api/studio/openai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ping: true,
          openAiApiKey: trimmedKey,
          openAiBaseUrl: baseUrl.trim() || DEFAULT_OPENAI_BASE_URL,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchHint(`联通失败：${data.error ?? res.status}`);
        return;
      }
      const samples = Array.isArray(data.sampleModels)
        ? (data.sampleModels as string[]).slice(0, 3).join("、")
        : "";
      setFetchHint(
        `联通成功 · ${data.latencyMs ?? "?"}ms · ${data.modelsCount ?? 0} 个模型` +
          (samples ? `（如 ${samples}）` : "")
      );
      if (Array.isArray(data.sampleModels) && data.sampleModels.length) {
        setModelOptions(mergeModelOptions(model, data.sampleModels as string[]));
      }
    } catch (e) {
      setFetchHint(
        e instanceof Error
          ? `联通失败（网络）：${e.message}`
          : "联通失败：网络错误"
      );
    } finally {
      setFetchingModels(false);
    }
  }

  return (
    <details className="rounded-md border border-sky-100 bg-white/80 p-3">
      <summary className="cursor-pointer text-xs font-medium text-sky-800">
        OpenAI 配置（本机 + 服务端）
        {configured || serverConfigured ? (
          <span className="ml-2 font-normal text-emerald-600">
            {serverConfigured ? "服务端可用" : "仅本机"}
          </span>
        ) : (
          <span className="ml-2 font-normal text-amber-600">未配置</span>
        )}
      </summary>

      <div className="mt-3 space-y-3">
        <p className="text-xs text-stone-500">
          保存后同步到服务端（管理员），公开 Bug 反馈才能用模型自动挂需求；本机仍保留一份供页面内拆解。
        </p>

        <label className="block text-xs text-stone-600">
          API 地址
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block text-xs text-stone-600">
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block text-xs text-stone-600">
          模型
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 block w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
          >
            {selectOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleTestConnection()}
            disabled={fetchingModels}
            className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            {fetchingModels ? "测试中…" : "测试联通"}
          </button>
          <button
            type="button"
            onClick={() => void handleFetchModels()}
            disabled={fetchingModels}
            className="rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60"
          >
            {fetchingModels ? "拉取中…" : "拉取模型"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存配置"}
          </button>
          {savedHint ? <span className="text-xs text-stone-500">{savedHint}</span> : null}
          {fetchHint ? <span className="text-xs text-stone-500">{fetchHint}</span> : null}
        </div>
      </div>
    </details>
  );
}
