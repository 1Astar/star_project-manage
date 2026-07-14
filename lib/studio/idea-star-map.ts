import { isIdeaOnDate } from "@/lib/studio/idea-stream-utils";
import type { Idea, IdeaStatus, IdeaType, Project } from "@/lib/studio/types";

export type StarMapNodeKind = "star" | "planet" | "meteor";

export type StarMapNode = {
  id: string;
  kind: StarMapNodeKind;
  x: number;
  y: number;
  radius: number;
  color: string;
  glow: string;
  label: string;
  href: string;
  status: IdeaStatus;
  type: IdeaType;
  projectId: string | null;
  twinklePhase: number;
};

export type StarMapAnchor = {
  id: string;
  title: string;
  x: number;
  y: number;
  color: string;
};

export type StarMapLayout = {
  nodes: StarMapNode[];
  anchors: StarMapAnchor[];
  stats: {
    todayCount: number;
    activeProjects: number;
    starCount: number;
    planetCount: number;
    meteorCount: number;
  };
};

const TYPE_COLORS: Record<IdeaType, string> = {
  product: "#818cf8",
  feature: "#fbbf24",
  ui: "#f472b6",
  content: "#60a5fa",
  tech: "#34d399",
  business: "#c084fc",
};

const PROJECT_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6"];

function hashUnit(id: string, salt = 0): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function projectAnchors(projects: Project[]): StarMapAnchor[] {
  const active = projects.filter((p) => p.status !== "archived");
  const count = Math.max(active.length, 1);
  return active.map((project, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const radius = active.length <= 1 ? 0.22 : 0.28;
    return {
      id: project.id,
      title: project.title,
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius * 0.72,
      color: PROJECT_COLORS[index % PROJECT_COLORS.length],
    };
  });
}

function anchorForProject(anchors: StarMapAnchor[], projectId: string | null) {
  if (!projectId) return { x: 0.5, y: 0.5 };
  const hit = anchors.find((a) => a.id === projectId);
  return hit ? { x: hit.x, y: hit.y } : { x: 0.5, y: 0.5 };
}

function nodeKind(status: IdeaStatus): StarMapNodeKind {
  if (status === "converted" || status === "done") return "planet";
  if (status === "archived") return "meteor";
  return "star";
}

function nodeRadius(kind: StarMapNodeKind, priority?: string): number {
  if (kind === "planet") return 9;
  if (kind === "meteor") return 2.5;
  if (priority === "P0") return 5;
  if (priority === "P1") return 4;
  return 3;
}

export function buildStarMapLayout(ideas: Idea[], projects: Project[]): StarMapLayout {
  const anchors = projectAnchors(projects);
  const anchorMap = new Map(anchors.map((a) => [a.id, a]));
  const grouped = new Map<string, Idea[]>();

  for (const idea of ideas) {
    const key = idea.relatedProjectId ?? "__none__";
    const list = grouped.get(key) ?? [];
    list.push(idea);
    grouped.set(key, list);
  }

  const nodes: StarMapNode[] = [];

  for (const [groupKey, groupIdeas] of grouped) {
    const projectId = groupKey === "__none__" ? null : groupKey;
    const anchor = anchorForProject(anchors, projectId);
    const clusterColor = projectId ? anchorMap.get(projectId)?.color ?? "#94a3b8" : "#cbd5e1";

    groupIdeas.forEach((idea, index) => {
      const kind = nodeKind(idea.status);
      const spread = kind === "planet" ? 0.01 : projectId ? 0.07 : 0.18;
      const angle = hashUnit(idea.id, 1) * Math.PI * 2 + index * 0.55;
      const dist = (hashUnit(idea.id, 2) * 0.65 + 0.35) * spread;
      let x = anchor.x + Math.cos(angle) * dist;
      let y = anchor.y + Math.sin(angle) * dist;

      if (kind === "meteor") {
        x = 0.08 + hashUnit(idea.id, 3) * 0.84;
        y = 0.08 + hashUnit(idea.id, 4) * 0.2;
      }

      const typeColor = TYPE_COLORS[idea.type];
      const color = kind === "planet" ? clusterColor : typeColor;

      nodes.push({
        id: idea.id,
        kind,
        x: Math.min(0.94, Math.max(0.06, x)),
        y: Math.min(0.92, Math.max(0.08, y)),
        radius: nodeRadius(kind, idea.priority),
        color,
        glow: kind === "meteor" ? "#94a3b8" : color,
        label: idea.title,
        href: kind === "planet" && idea.relatedProjectId
          ? `/projects/${idea.relatedProjectId}`
          : "/stream",
        status: idea.status,
        type: idea.type,
        projectId: idea.relatedProjectId,
        twinklePhase: hashUnit(idea.id, 5) * Math.PI * 2,
      });
    });
  }

  const todayCount = ideas.filter((i) => isIdeaOnDate(i.createdAt, "today")).length;

  return {
    nodes,
    anchors,
    stats: {
      todayCount,
      activeProjects: anchors.length,
      starCount: nodes.filter((n) => n.kind === "star").length,
      planetCount: nodes.filter((n) => n.kind === "planet").length,
      meteorCount: nodes.filter((n) => n.kind === "meteor").length,
    },
  };
}
