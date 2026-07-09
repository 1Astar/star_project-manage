"use client";

import { useEffect, useState } from "react";
import {
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

export function OpenAiSettingsPanel({ onSaved }: OpenAiSettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_OPENAI_MODEL);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const settings = loadOpenAiSettings();
    if (!settings) {
      setConfigured(false);
      return;
    }
    setApiKey(settings.apiKey);
    setModel(settings.model);
    setConfigured(true);
  }, []);

  function handleSave() {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setSavedHint("请填写 API Key");
      return;
    }

    const next: OpenAiSettings = {
      apiKey: trimmedKey,
      model: model.trim() || DEFAULT_OPENAI_MODEL,
    };
    saveOpenAiSettings(next);
    setConfigured(true);
    setSavedHint(`已保存 ${maskApiKey(trimmedKey)}，仅保存在本浏览器`);
    onSaved?.();
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
          Key 只存在你的浏览器，不会写入 Vercel 或 Supabase。拆解时由本机带给服务端转发 OpenAI。
        </p>

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
            {OPENAI_MODEL_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            保存配置
          </button>
          {savedHint ? <span className="text-xs text-stone-500">{savedHint}</span> : null}
        </div>
      </div>
    </details>
  );
}
