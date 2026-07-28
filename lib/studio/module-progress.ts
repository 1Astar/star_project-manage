import { parseFeaturePathToChain, normalizeFeaturePath } from "@/lib/studio/project-modules";
import type { ChangeSession, EvolutionLog, Idea } from "@/lib/studio/types";
import { ideaOccurredAt } from "@/lib/studio/idea-stream-utils";
import {
  formatWorkDuration,
  formatWorkRange,
  sumWorkDurationMs,
  workDurationMs,
} from "@/lib/studio/work-hours";

export type ModuleProgressNodeKind = "evolution" | "idea" | "change";

export type ModuleProgressNode = {
  id: string;
  kind: ModuleProgressNodeKind;
  title: string;
  at: string;
  note?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs: number | null;
  rangeLabel: string | null;
};

export type ModuleProgressRow = {
  path: string;
  label: string;
  depth: number;
  proposedAt: string | null;
  nodes: ModuleProgressNode[];
  totalDurationMs: number;
  totalDurationLabel: string;
};

function moduleMatchesScope(modulePath: string, scopePath: string, exact: boolean): boolean {
  const m = normalizeFeaturePath(modulePath);
  const s = normalizeFeaturePath(scopePath);
  if (!s || !m) return false;
  if (exact) return m === s;
  return m === s || m.startsWith(`${s}·`);
}

function earliestIso(dates: Array<string | null | undefined>): string | null {
  const ok = dates.filter((d): d is string => Boolean(d?.trim())).sort();
  return ok[0] ?? null;
}

function toNodeFromEvolution(log: EvolutionLog): ModuleProgressNode {
  const startedAt = log.workStartedAt ?? null;
  const finishedAt = log.workFinishedAt ?? null;
  return {
    id: log.id,
    kind: "evolution",
    title: log.title,
    at: log.createdAt,
    note: log.reason || log.after || null,
    startedAt,
    finishedAt,
    durationMs: workDurationMs(startedAt, finishedAt),
    rangeLabel: formatWorkRange(startedAt, finishedAt),
  };
}

function toNodeFromIdea(idea: Idea): ModuleProgressNode {
  const at = ideaOccurredAt(idea);
  return {
    id: idea.id,
    kind: "idea",
    title: idea.title,
    at,
    note: idea.oneLineIdea || null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    rangeLabel: null,
  };
}

function toNodeFromSession(session: ChangeSession): ModuleProgressNode {
  const startedAt = session.createdAt;
  const finishedAt = session.finishedAt;
  return {
    id: session.id,
    kind: "change",
    title: session.goal || "变更会话",
    at: session.finishedAt || session.createdAt,
    note: session.result || session.reason || null,
    startedAt,
    finishedAt,
    durationMs: workDurationMs(startedAt, finishedAt),
    rangeLabel: formatWorkRange(startedAt, finishedAt),
  };
}

/**
 * 板块进程行：各大板块（聚合）+ 各完整路径子行。
 * 提出时间 = 范围内灵感 occurredAt 与演进 createdAt 取更早。
 */
export function buildModuleProgressRows(input: {
  modules: string[];
  evolution: EvolutionLog[];
  ideas: Idea[];
  changeSessions?: ChangeSession[];
  pathPrefix?: string | null;
}): ModuleProgressRow[] {
  const prefix = input.pathPrefix?.trim() || null;
  const sessions = input.changeSessions ?? [];

  const pathSet = new Set<string>();
  const consider = (raw: string) => {
    const path = normalizeFeaturePath(raw);
    if (!path) return;
    if (prefix && path !== prefix && !path.startsWith(`${prefix}·`)) return;
    const chain = parseFeaturePathToChain(path);
    if (chain[0]) pathSet.add(chain[0]!);
    pathSet.add(path);
  };

  for (const m of input.modules) consider(m);
  for (const log of input.evolution) consider(log.module);
  for (const idea of input.ideas) consider(idea.relatedModule);
  for (const s of sessions) consider(s.module);

  const paths = Array.from(pathSet).sort((a, b) => {
    const ca = parseFeaturePathToChain(a);
    const cb = parseFeaturePathToChain(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i += 1) {
      const c = ca[i]!.localeCompare(cb[i]!, "zh-CN");
      if (c !== 0) return c;
    }
    return ca.length - cb.length;
  });

  return paths.map((path) => {
    const chain = parseFeaturePathToChain(path);
    const hasChildren = paths.some((p) => p !== path && p.startsWith(`${path}·`));
    const exact = !hasChildren;

    const evolutions = input.evolution.filter((e) =>
      moduleMatchesScope(e.module, path, exact)
    );
    const ideas = input.ideas.filter((i) =>
      moduleMatchesScope(i.relatedModule, path, exact)
    );
    const chg = sessions.filter((s) => moduleMatchesScope(s.module, path, exact));

    const nodes: ModuleProgressNode[] = [
      ...evolutions.map(toNodeFromEvolution),
      ...ideas.map(toNodeFromIdea),
      ...chg.map(toNodeFromSession),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const proposedAt = earliestIso([
      ...ideas.map((i) => ideaOccurredAt(i)),
      ...evolutions.map((e) => e.createdAt),
    ]);

    const totalDurationMs = sumWorkDurationMs(
      nodes.map((n) => ({ startedAt: n.startedAt, finishedAt: n.finishedAt }))
    );

    return {
      path,
      label: chain[chain.length - 1] ?? path,
      depth: chain.length - 1,
      proposedAt,
      nodes,
      totalDurationMs,
      totalDurationLabel: formatWorkDuration(
        totalDurationMs > 0 ? totalDurationMs : null
      ),
    };
  });
}
