"use client";

import type { RequirementLink } from "@/lib/types";

export type TimelineEntity = {
  id: string;
  kind: "idea" | "requirement" | "studio_task" | "evolution";
  title: string;
  at: string | null;
  note?: string | null;
};

const KIND_LABEL: Record<TimelineEntity["kind"], string> = {
  idea: "灵感",
  requirement: "需求",
  studio_task: "任务",
  evolution: "演进",
};

type Props = {
  requirementId: string;
  links: RequirementLink[];
  entities: TimelineEntity[];
};

export function RequirementMemoryTimeline({ requirementId, links, entities }: Props) {
  const byId = new Map(entities.map((e) => [`${e.kind}:${e.id}`, e]));

  const relatedIds = new Set<string>();
  relatedIds.add(`requirement:${requirementId}`);
  for (const link of links) {
    const touches =
      (link.source_type === "requirement" && link.source_id === requirementId) ||
      (link.target_type === "requirement" && link.target_id === requirementId);
    if (!touches) continue;
    relatedIds.add(`${link.source_type}:${link.source_id}`);
    relatedIds.add(`${link.target_type}:${link.target_id}`);
  }

  const nodes = [...relatedIds]
    .map((key) => byId.get(key))
    .filter(Boolean) as TimelineEntity[];

  nodes.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  if (!nodes.length) {
    return (
      <p className="text-xs text-slate-400">暂无关联时间线。同步灵感或添加关联后可见。</p>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-4">
      {nodes.map((node) => (
        <li key={`${node.kind}:${node.id}`} className="relative">
          <span className="absolute -left-[1.28rem] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-white" />
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {KIND_LABEL[node.kind]}
            {node.at ? ` · ${node.at.slice(0, 10)}` : ""}
          </div>
          <div className="text-sm font-medium text-slate-800">{node.title}</div>
          {node.note ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{node.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
