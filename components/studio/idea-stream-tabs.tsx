"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type StreamView = "timeline" | "table";

const VIEWS: { id: StreamView; label: string }[] = [
  { id: "timeline", label: "时间线" },
  { id: "table", label: "表格" },
];

export function IdeaStreamTabs({ currentView }: { currentView: StreamView }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchView(view: StreamView) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "timeline") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    const qs = params.toString();
    router.push(qs ? `/stream?${qs}` : "/stream");
  }

  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => switchView(item.id)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            currentView === item.id
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function StreamProjectTags({
  projects,
  currentProject,
  includePooled,
}: {
  projects: { id: string; label: string }[];
  currentProject: string | null;
  includePooled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectProject(projectId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!projectId) {
      params.delete("project");
    } else {
      params.set("project", projectId);
    }
    const qs = params.toString();
    router.push(qs ? `/stream?${qs}` : "/stream");
  }

  function togglePooled() {
    const params = new URLSearchParams(searchParams.toString());
    if (includePooled) {
      params.delete("pooled");
    } else {
      params.set("pooled", "1");
    }
    const qs = params.toString();
    router.push(qs ? `/stream?${qs}` : "/stream");
  }

  const tags = [
    { id: null as string | null, label: "全部" },
    ...projects.map((p) => ({ id: p.id, label: p.label })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => {
        const active = (currentProject ?? null) === tag.id;
        return (
          <button
            key={tag.id ?? "__all__"}
            type="button"
            onClick={() => selectProject(tag.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              active
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {tag.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={togglePooled}
        title="已同步进需求池的灵感默认隐藏，点此显示"
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          includePooled
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
        )}
      >
        {includePooled ? "含已入池 ✓" : "含已入池"}
      </button>
    </div>
  );
}
