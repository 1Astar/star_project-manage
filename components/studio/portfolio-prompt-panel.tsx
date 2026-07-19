"use client";

import { useState } from "react";
import {
  CASE_STUDY_GENERATE_PROMPT,
  CASE_STUDY_SPINE,
  CASE_STUDY_TEMPLATE,
} from "@/lib/studio/portfolio-prompts";

type Tab = "spine" | "generate" | "template";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PortfolioPromptPanel({
  projectTitle,
  compact = false,
}: {
  projectTitle?: string;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("generate");
  const [copied, setCopied] = useState(false);

  const generateWithContext = projectTitle
    ? CASE_STUDY_GENERATE_PROMPT.replace(
        "【在此粘贴项目资料：定位、Why、IA、核心体验、视觉、版本、洞察等】",
        `【项目：${projectTitle}】\n【在此粘贴项目资料：定位、Why、IA、核心体验、视觉、版本、洞察等】`
      )
    : CASE_STUDY_GENERATE_PROMPT;

  const body =
    tab === "spine"
      ? CASE_STUDY_SPINE.join(" → ")
      : tab === "generate"
        ? generateWithContext
        : CASE_STUDY_TEMPLATE;

  async function handleCopy() {
    const ok = await copyText(body);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-violet-900">作品集 Prompt 模板</h3>
          <p className="mt-1 text-xs text-violet-700/80">
            Idea 补充 · Case Study；挂项目恢复/概览，不阻断 Idea → Project
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50"
        >
          {copied ? "已复制" : "复制当前内容"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["spine", "叙事主线"],
            ["generate", "生成 Prompt"],
            ["template", "Case 空模板"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === id
                ? "bg-violet-600 text-white"
                : "bg-white text-violet-700 border border-violet-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "spine" && !compact ? (
        <ol className="mt-3 grid gap-1 sm:grid-cols-2">
          {CASE_STUDY_SPINE.map((item, i) => (
            <li key={item} className="flex items-center gap-2 text-sm text-violet-900">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-violet-100 bg-white p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
          {body}
        </pre>
      )}
    </section>
  );
}
