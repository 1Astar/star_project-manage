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
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
    const settings = loadOpenAiSettings();
    if (!settings) {
      setConfigured(false);
      return;
    }
    setApiKey(settings.apiKey);
    setBaseUrl(settings.baseUrl ?? DEFAULT_OPENAI_BASE_URL);
    setModel(settings.model);
    setModelOptions(mergeModelOptions(settings.model, []));
    setConfigured(true);
  }, []);

  const selectOptions = useMemo(() => mergeModelOptions(model, modelOptions), [model, modelOptions]);

  function handleSave() {
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
    setSavedHint(`已保存 ${maskApiKey(trimmedKey)}，仅保存在本浏览器`);
    onSaved?.();
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
    } catch {
      setFetchHint("网络错误，请稍后重试");
    } finally {
      setFetchingModels(false);
    }
  }

  return (
    <details className="rounded-md border border-sky-100 bg-white/80 p-3">
      <summary className="cursor-pointer text-xs font-medium text-sky-800">
        OpenAI 配置（本机 localStorage）
        {configured ? (
          <span className="ml-2 font-normal text-emerald-600">已配置</span>
        ) : (
          <span className="ml-2 font-normal text-amber-600">未配置</span>
        )}
      </summary>

      <div className="mt-3 space-y-3">
        <p className="text-xs text-stone-500">
          Key 与 API 地址只存在你的浏览器，不会写入 Vercel 或 Supabase。拆解时由服务端按你填的地址转发。
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
            onClick={handleFetchModels}
            disabled={fetchingModels}
            className="rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60"
          >
            {fetchingModels ? "拉取中…" : "拉取模型"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            保存配置
          </button>
          {savedHint ? <span className="text-xs text-stone-500">{savedHint}</span> : null}
          {fetchHint ? <span className="text-xs text-stone-500">{fetchHint}</span> : null}
        </div>
      </div>
    </details>
  );
}
