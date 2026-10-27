"use client";

import { useMemo, useState } from "react";
import { generateInvestigationTasksAction } from "@/lib/modules/investigation-actions";
import {
  isInvestigationPage,
  seedAnomaliesFromBody,
  seedDescriptionFromBody,
  seedObservedFromBody,
} from "@/lib/modules/generate-investigation-tasks";
import { loadOpenAiSettings } from "@/lib/studio/ai/openai-settings";

export function InvestigationAiPanel({
  pageTitle,
  moduleName,
  body,
  canEdit,
  onApplyBody,
}: {
  pageTitle: string;
  moduleName?: string;
  body: string;
  canEdit: boolean;
  onApplyBody: (nextBody: string) => void;
}) {
  const visible = useMemo(
    () => isInvestigationPage(pageTitle, body),
    [pageTitle, body]
  );

  const [open, setOpen] = useState(true);
  const [moduleField, setModuleField] = useState(moduleName?.trim() || "");
  const [featureGoal, setFeatureGoal] = useState(() =>
    seedDescriptionFromBody(body, pageTitle)
  );
  const [observedFeatures, setObservedFeatures] = useState(() =>
    seedObservedFromBody(body)
  );
  const [observedAnomalies, setObservedAnomalies] = useState(() =>
    seedAnomaliesFromBody(body)
  );
  const [revisionNote, setRevisionNote] = useState("");
  const [showPromptHint, setShowPromptHint] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  if (!canEdit || !visible) return null;

  async function run(mode: "generate" | "regenerate") {
    if (pending) return;
    setPending(true);
    setError(null);
    setHint(null);
    try {
      const local = loadOpenAiSettings();
      const result = await generateInvestigationTasksAction({
        pageTitle,
        moduleName: moduleField || moduleName,
        featureGoal,
        pageDescription: featureGoal,
        observedFeatures,
        observedAnomalies,
        currentBody: body,
        revisionNote,
        mode,
        credentials: local,
      });
      onApplyBody(result.body);
      setHint(
        result.method === "openai"
          ? mode === "regenerate"
            ? "已按说明重新生成（含拆解/方向/任务/待确认）"
            : "已生成测试分析（含拆解/方向/任务/待确认）"
          : "未配置 OpenAI Key，已用规则模板生成；可在灵感捕获里配置 Key 后重试"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setPending(false);
    }
  }

  function refillFromBody() {
    setFeatureGoal(seedDescriptionFromBody(body, pageTitle));
    setObservedFeatures(seedObservedFromBody(body));
    setObservedAnomalies(seedAnomaliesFromBody(body));
    if (moduleName?.trim()) setModuleField(moduleName.trim());
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-indigo-800"
        >
          {open ? "▾" : "▸"} AI 生成调查与测试任务
        </button>
        <span className="text-[11px] text-slate-500">
          产品测试分析助手 · 可重生成 + 修改说明
        </span>
      </div>
      {open ? (
        <div className="mt-2 space-y-2">
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-600">产品模块</span>
            <input
              value={moduleField}
              onChange={(e) => setModuleField(e.target.value)}
              placeholder="例：文件管理 / 任务中心 / 相册"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-300"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-600">功能目标</span>
            <textarea
              value={featureGoal}
              onChange={(e) => setFeatureGoal(e.target.value)}
              rows={2}
              placeholder="例：确认文件上传的入口、支持范围、进度反馈、异常处理与任务中心关系…"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-300"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-600">已观察到的功能（一行一项）</span>
            <textarea
              value={observedFeatures}
              onChange={(e) => setObservedFeatures(e.target.value)}
              rows={3}
              placeholder={"上传单个文件\n上传文件夹"}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-300"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-600">
              已观察到的异常（截图说明 / 操作过程 / 实际结果）
            </span>
            <textarea
              value={observedAnomalies}
              onChange={(e) => setObservedAnomalies(e.target.value)}
              rows={3}
              placeholder="例：复制大文件夹时进度条卡住，刷新后文件已到目标目录…"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-300"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-600">
              需要修改的说明（重新生成时优先落实）
            </span>
            <textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              rows={2}
              placeholder="例：补上拖拽上传与同名冲突；合并重复的进度类任务；强调任务中心联动"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-300"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void run("generate")}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {pending ? "生成中…" : "AI 生成"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void run("regenerate")}
              className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 disabled:opacity-40"
            >
              重新生成
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={refillFromBody}
              className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700"
            >
              从正文填入
            </button>
            <button
              type="button"
              onClick={() => setShowPromptHint((v) => !v)}
              className="rounded-md px-2 py-1 text-[11px] text-indigo-600 hover:underline"
            >
              {showPromptHint ? "收起准则" : "生成准则"}
            </button>
          </div>
          {showPromptHint ? (
            <p className="rounded-md border border-indigo-100 bg-white/80 p-2 text-[11px] leading-relaxed text-slate-600">
              覆盖完整用户链路（正常/边界/异常/网络/权限路径/限制/状态/数据完整性/跨模块/反馈）；区分已观察、待验证、已复现
              Bug、优化；未复现不写 Bug；合并重复；每条任务含目的/前置/步骤/预期/可能问题/类型；输出含功能拆解、测试方向（含推导来源）、精简任务、Bug
              方向、待确认规则与范围缺口。
            </p>
          ) : null}
          {hint ? <p className="text-[11px] text-emerald-700">{hint}</p> : null}
          {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
