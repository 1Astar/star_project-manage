"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RequirementStatusKanban,
  requirementColumn,
  type RequirementKanbanItem,
} from "@/components/requirement-status-kanban";
import type { RequirementBoardItem } from "@/lib/db/local-store";
import { REQUIREMENT_DONE_TAG } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  initialItems: RequirementBoardItem[];
  projects: Array<{ id: string; name: string; slug: string }>;
};

export function GlobalRequirementBoard({ initialItems, projects }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [hideDone, setHideDone] = useState(true);

  const kanbanItems: RequirementKanbanItem[] = useMemo(() => {
    return initialItems
      .filter((item) => {
        if (projectId && item.project_id !== projectId) return false;
        if (hideDone) {
          const col = requirementColumn(item.requirement);
          if (col === REQUIREMENT_DONE_TAG || col === "完成") return false;
        }
        return true;
      })
      .map((item) => ({
        req: item.requirement,
        projectSlug: item.project_slug,
        projectName: item.project_name,
      }));
  }, [initialItems, projectId, hideDone]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>项目</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className={cn("rounded border-slate-300")}
          />
          隐藏已完成
        </label>
        <span className="text-xs text-slate-400">共 {kanbanItems.length} 条叶子需求</span>
      </div>

      <RequirementStatusKanban
        items={kanbanItems}
        showProjectName
        onOpen={(reqId, slug) => {
          router.push(`/projects/${slug}/requirements/${reqId}`);
        }}
      />
    </div>
  );
}
