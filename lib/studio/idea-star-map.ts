import { isIdeaOnDate } from "@/lib/studio/idea-stream-utils";
import { resolveFeatureModules } from "@/lib/studio/project-modules";
import type {
  ChangeSession,
  EvolutionLog,
  Idea,
  IdeaType,
  Project,
} from "@/lib/studio/types";

export type GraphNodeKind = "idea" | "project" | "module";

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  detail?: string;
  href?: string;
  color: string;
  radius: number;
  projectId?: string;
  moduleKey?: string;
  ideaId?: string;
  isToday?: boolean;
  childCount: number;
};

export type GraphEdge = {
  from: string;
  to: string;
};

export type StarMapGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  todayRootIds: string[];
  allRootIds: string[];
};

export type StarMapExtras = {
  acceptanceCount?: number;
  latestImproveDay?: string | null;
  changeSessions?: ChangeSession[];
  evolution?: EvolutionLog[];
};

export type StarMapLayout = {
  graph: StarMapGraph;
  stats: {
    todayCount: number;
    activeProjects: number;
    starCount: number;
    planetCount: number;
    meteorCount: number;
    acceptanceCount: number;
  };
};

const TYPE_COLORS: Record<IdeaType, string> = {
  product: "#a5b4fc",
  feature: "#fcd34d",
  ui: "#f9a8d4",
  content: "#7dd3fc",
  tech: "#6ee7b7",
  business: "#d8b4fe",
};

const PROJECT_COLORS = ["#818cf8", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"];
const MODULE_COLOR = "#94a3b8";

function moduleRoot(path: string): string {
  const t = path.trim();
  if (!t) return "未分板块";
  return t.split(/[·/、]+/)[0]?.trim() || "未分板块";
}

export function ideaNodeId(id: string) {
  return `idea:${id}`;
}
export function projectNodeId(id: string) {
  return `project:${id}`;
}
export function moduleNodeId(projectId: string, moduleName: string) {
  return `module:${projectId}:${moduleName}`;
}

/**
 * 可见子图：过滤根 + 已展开节点的直接孩子（点一个只摊一层）。
 * 今日模式下，从板块展开的灵感只保留今日。
 */
export function visibleSubgraph(
  graph: StarMapGraph,
  filter: "today" | "all",
  expandedIds: Set<string>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = children.get(e.from) ?? [];
    list.push(e.to);
    children.set(e.from, list);
  }

  const roots = filter === "today" ? graph.todayRootIds : graph.allRootIds;
  const visible = new Set<string>();
  for (const id of roots) {
    if (byId.has(id)) visible.add(id);
  }

  for (const id of [...visible]) {
    if (!expandedIds.has(id)) continue;
    const parent = byId.get(id);
    for (const childId of children.get(id) ?? []) {
      const child = byId.get(childId);
      if (!child) continue;
      if (
        filter === "today" &&
        parent?.kind === "module" &&
        child.kind === "idea" &&
        !child.isToday
      ) {
        continue;
      }
      visible.add(childId);
    }
  }

  return {
    nodes: graph.nodes.filter((n) => visible.has(n.id)),
    edges: graph.edges.filter((e) => visible.has(e.from) && visible.has(e.to)),
  };
}

export function buildStarMapLayout(
  ideas: Idea[],
  projects: Project[],
  extras: StarMapExtras = {}
): StarMapLayout {
  const activeProjects = projects.filter((p) => p.status !== "archived");
  const projectById = new Map(activeProjects.map((p) => [p.id, p]));
  const sessions = extras.changeSessions ?? [];
  const evolution = extras.evolution ?? [];

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  function addNode(n: GraphNode) {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  }

  activeProjects.forEach((project, i) => {
    const ideaCount = ideas.filter((x) => x.relatedProjectId === project.id).length;
    addNode({
      id: projectNodeId(project.id),
      kind: "project",
      label: project.title,
      detail: `${ideaCount} 条灵感`,
      href: `/projects/${project.id}`,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      radius: 11,
      projectId: project.id,
      childCount: 0,
    });
  });

  for (const project of activeProjects) {
    const pid = projectNodeId(project.id);
    const projectIdeas = ideas.filter((i) => i.relatedProjectId === project.id);
    const moduleNames = new Set<string>();
    for (const idea of projectIdeas) moduleNames.add(moduleRoot(idea.relatedModule));
    for (const s of sessions.filter((x) => x.projectId === project.id)) {
      if (s.module?.trim()) moduleNames.add(moduleRoot(s.module));
    }
    for (const e of evolution.filter((x) => x.projectId === project.id)) {
      if (e.module?.trim()) moduleNames.add(moduleRoot(e.module));
    }
    if (moduleNames.size === 0 && projectIdeas.length > 0) moduleNames.add("未分板块");

    const catalog = resolveFeatureModules(
      project.id,
      project.featureModules,
      project.githubRepo
    );
    for (const m of catalog) {
      if (projectIdeas.some((i) => moduleRoot(i.relatedModule) === moduleRoot(m))) {
        moduleNames.add(moduleRoot(m));
      }
    }

    for (const name of moduleNames) {
      const mid = moduleNodeId(project.id, name);
      const count = projectIdeas.filter((i) => moduleRoot(i.relatedModule) === name).length;
      const recent = sessions
        .filter((s) => s.projectId === project.id && moduleRoot(s.module || "") === name)
        .sort((a, b) =>
          (b.finishedAt || b.updatedAt).localeCompare(a.finishedAt || a.updatedAt)
        )[0];
      addNode({
        id: mid,
        kind: "module",
        label: name,
        detail: recent?.goal
          ? `${count} 条 · ${recent.goal.slice(0, 18)}${recent.goal.length > 18 ? "…" : ""}`
          : `${count} 条`,
        href: `/projects/${project.id}`,
        color: MODULE_COLOR,
        radius: 8,
        projectId: project.id,
        moduleKey: name,
        childCount: count,
      });
      edges.push({ from: pid, to: mid });
    }
  }

  for (const idea of ideas) {
    const iid = ideaNodeId(idea.id);
    const today = isIdeaOnDate(idea, "today");
    addNode({
      id: iid,
      kind: "idea",
      label: idea.title,
      detail: idea.oneLineIdea?.trim() || idea.relatedModule || undefined,
      href: `/stream?idea=${idea.id}`,
      color: TYPE_COLORS[idea.type] ?? "#a5b4fc",
      radius: today ? 6.5 : 5.5,
      projectId: idea.relatedProjectId ?? undefined,
      ideaId: idea.id,
      isToday: today,
      childCount: idea.relatedProjectId ? 1 : 0,
    });

    if (idea.relatedProjectId && projectById.has(idea.relatedProjectId)) {
      const mid = moduleNodeId(idea.relatedProjectId, moduleRoot(idea.relatedModule));
      if (seen.has(mid)) edges.push({ from: mid, to: iid });
      edges.push({ from: iid, to: projectNodeId(idea.relatedProjectId) });
    }
  }

  const outCount = new Map<string, number>();
  for (const e of edges) outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1);
  for (const n of nodes) n.childCount = outCount.get(n.id) ?? 0;

  const todayRootIds = ideas
    .filter((i) => isIdeaOnDate(i, "today"))
    .map((i) => ideaNodeId(i.id));
  const allRootIds =
    activeProjects.length > 0
      ? activeProjects.map((p) => projectNodeId(p.id))
      : ideas.map((i) => ideaNodeId(i.id));

  return {
    graph: { nodes, edges, todayRootIds, allRootIds },
    stats: {
      todayCount: todayRootIds.length,
      activeProjects: activeProjects.length,
      starCount: ideas.filter(
        (i) => i.status !== "converted" && i.status !== "done" && i.status !== "archived"
      ).length,
      planetCount: ideas.filter((i) => i.status === "converted" || i.status === "done").length,
      meteorCount: ideas.filter((i) => i.status === "archived").length,
      acceptanceCount: extras.acceptanceCount ?? 0,
    },
  };
}

/** 轻量力导向一步（无 d3）；pinned 节点位置不动 */
export function tickForceLayout(
  positions: Map<string, { x: number; y: number }>,
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  pinned?: Set<string>
) {
  const ids = nodes.map((n) => n.id);
  for (const id of ids) {
    if (!positions.has(id)) {
      positions.set(id, {
        x: width * (0.25 + Math.random() * 0.5),
        y: height * (0.25 + Math.random() * 0.5),
      });
    }
  }

  const snapshot = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    if (pinned?.has(id)) {
      const p = positions.get(id)!;
      snapshot.set(id, { x: p.x, y: p.y });
    }
  }

  const pos = (id: string) => positions.get(id)!;

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = pos(ids[i]!);
      const b = pos(ids[j]!);
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const minDist = 56;
      if (dist < minDist) {
        const push = ((minDist - dist) / dist) * 0.35;
        dx *= push;
        dy *= push;
        a.x += dx;
        a.y += dy;
        b.x -= dx;
        b.y -= dy;
      } else {
        const force = 420 / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.x += dx;
        a.y += dy;
        b.x -= dx;
        b.y -= dy;
      }
    }
  }

  for (const e of edges) {
    if (!positions.has(e.from) || !positions.has(e.to)) continue;
    const a = pos(e.from);
    const b = pos(e.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const target = 110;
    const pull = (dist - target) * 0.02;
    const fx = (dx / dist) * pull;
    const fy = (dy / dist) * pull;
    a.x += fx;
    a.y += fy;
    b.x -= fx;
    b.y -= fy;
  }

  let cx = 0;
  let cy = 0;
  for (const id of ids) {
    const p = pos(id);
    cx += p.x;
    cy += p.y;
  }
  cx /= Math.max(ids.length, 1);
  cy /= Math.max(ids.length, 1);
  const ox = width / 2 - cx;
  const oy = height / 2 - cy;
  const pad = 36;
  for (const id of ids) {
    const p = pos(id);
    p.x = Math.min(width - pad, Math.max(pad, p.x + ox * 0.08));
    p.y = Math.min(height - pad, Math.max(pad, p.y + oy * 0.08));
  }

  for (const [id, p] of snapshot) {
    const cur = positions.get(id);
    if (cur) {
      cur.x = p.x;
      cur.y = p.y;
    }
  }
}
