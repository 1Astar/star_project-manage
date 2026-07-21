"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const BOARD_COLUMNS: ProjectStatus[] = [
  "mainline",
  "active",
  "demo",
  "parking",
  "archived",
];

async function patchStatus(projectId: string, status: ProjectStatus) {
  const res = await fetch(`/api/studio/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("save failed");
}

export function ProjectLibraryBoard({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDropColumn(status: ProjectStatus) {
    if (!dragId) return;
    const project = projects.find((p) => p.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!project || project.status === status) return;
    setError(null);
    try {
      await patchStatus(dragId, status);
      router.refresh();
    } catch {
      setError("更新状态失败");
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((status) => {
          const cards = projects.filter((p) => p.status === status);
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(status);
              }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                void onDropColumn(status);
              }}
              className={cn(
                "w-64 shrink-0 rounded-xl border bg-slate-50/80 p-3",
                overCol === status ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <StudioBadge
                  tone={
                    status === "mainline"
                      ? "mainline"
                      : status === "parking"
                        ? "warning"
                        : "muted"
                  }
                >
                  {PROJECT_STATUS_LABELS[status]}
                </StudioBadge>
                <span className="text-xs text-slate-400">{cards.length}</span>
              </div>
              <ul className="space-y-2">
                {cards.map((p) => (
                  <li
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing",
                      dragId === p.id && "opacity-50"
                    )}
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.title}
                    </Link>
                    {p.parentId ? (
                      <p className="mt-1 text-[11px] text-slate-400">子项目</p>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {p.positioning || "—"}
                    </p>
                    <div className="mt-2">
                      <StudioBadge tone={p.priority === "P0" ? "p0" : "muted"}>
                        {p.priority}
                      </StudioBadge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
