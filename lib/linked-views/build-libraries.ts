import { isOptimizationBug } from "@/lib/overview/matrix-rows";
import {
  mergeModuleChoices,
  moduleTreeFromNodes,
  peekModuleFields,
  splitModulePath,
  type LinkedViewModuleChoice,
} from "./module-path";
import { requirementLifecycleStatus } from "@/lib/requirement-status";
import {
  REQUIREMENT_TYPE_LABELS,
  TASK_STATUS_LABELS,
  type Bug,
  type CompetitorEntry,
  type ModuleNode,
  type ProjectLearningNote,
  type ProjectPrd,
  type Requirement,
} from "@/lib/types";
import type { LinkedViewSourceId } from "./config";
import type { LinkedViewRow } from "./query";
import { applyTitleHintToRow } from "./title-hints";

function reqModulePath(
  req: Requirement,
  modulesById: Map<string, ModuleNode>
): string {
  const leafId = req.module_l2_id || req.module_l1_id;
  if (!leafId) return "";
  const parts: string[] = [];
  let cur: ModuleNode | undefined = modulesById.get(leafId);
  for (let i = 0; i < 8 && cur; i++) {
    parts.unshift(cur.name.trim());
    cur = cur.parent_id ? modulesById.get(cur.parent_id) : undefined;
  }
  return parts.filter(Boolean).join("·");
}

function learningSectionTitle(
  note: ProjectLearningNote,
  byId: Map<string, ProjectLearningNote>
): string {
  if (note.kind === "section") return note.title || "";
  let cur: ProjectLearningNote | undefined = note;
  for (let i = 0; i < 4 && cur; i++) {
    if (cur.kind === "section") return cur.title || "";
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return "";
}

function kindLabel(kind: ProjectLearningNote["kind"]): string {
  if (kind === "point") return "子知识";
  if (kind === "topic") return "主题";
  return "板块";
}

export type LinkedViewLibraryRows = Record<LinkedViewSourceId, LinkedViewRow[]>;

export const EMPTY_LINKED_VIEW_LIBRARIES: LinkedViewLibraryRows = {
  requirement: [],
  bug: [],
  optimization: [],
  learning: [],
  prd: [],
  competitor: [],
};

export type { LinkedViewModuleChoice };

function pathToChoice(raw: string): LinkedViewModuleChoice | null {
  const { l1, l2 } = splitModulePath(raw);
  if (!l1) return null;
  return { name: l1, partitions: l2 ? [l2] : [] };
}

/** 一级模块 + 已出现过的二级分区（树里有二级也不自动写进标题） */
export function collectModuleTree(
  libraries: LinkedViewLibraryRows,
  extras: string[] = [],
  nodes: ModuleNode[] = []
): LinkedViewModuleChoice[] {
  const fromRows: LinkedViewModuleChoice[] = [];
  for (const rows of Object.values(libraries)) {
    for (const row of rows) {
      const choice = pathToChoice(row.cells?.module ?? "");
      if (choice) fromRows.push(choice);
    }
  }
  return mergeModuleChoices(
    [...moduleTreeFromNodes(nodes), ...fromRows],
    extras
  );
}

/** 命名/筛选用的一级模块名单 */
export function collectModuleNames(
  libraries: LinkedViewLibraryRows,
  extras: string[] = []
): string[] {
  return collectModuleTree(libraries, extras).map((m) => m.name);
}

function clipPeek(value: string | null | undefined, slim: boolean): string {
  const raw = value ?? "";
  if (!slim) return raw;
  // Hub SSR 不塞长正文，避免 CF Worker 内存/CPU 爆；Peek 仍有字段壳可编辑
  if (raw.length <= 160) return raw;
  return `${raw.slice(0, 160)}…`;
}

export function buildLinkedViewLibraryRows(input: {
  routeId: string;
  learnings: ProjectLearningNote[];
  bugs: Bug[];
  competitors: CompetitorEntry[];
  prds: ProjectPrd[];
  requirements: Requirement[];
  modules: ModuleNode[];
  /** Hub / 模块主页：截断大字段，防 RSC 载荷拖垮 Worker */
  slimPeek?: boolean;
}): LinkedViewLibraryRows {
  const routeId = input.routeId;
  const slim = input.slimPeek === true;
  const modulesById = new Map(input.modules.map((m) => [m.id, m]));
  const learnById = new Map(input.learnings.map((n) => [n.id, n]));

  const requirements: LinkedViewRow[] = input.requirements
    .filter((r) => r.title?.trim())
    .map((r) => {
      const modulePath = reqModulePath(r, modulesById);
      const status = requirementLifecycleStatus(r);
      return {
        id: r.id,
        title: r.title,
        href: `/projects/${routeId}/requirements/${r.id}`,
        badge: r.type ? REQUIREMENT_TYPE_LABELS[r.type] : undefined,
        cells: {
          module: modulePath,
          status,
          priority: r.priority ?? "",
          type: r.type ? REQUIREMENT_TYPE_LABELS[r.type] : "",
        },
        peekKind: "requirement" as const,
        fields: [
          ...peekModuleFields(modulePath),
          {
            key: "tags",
            label: "标签",
            value: (r.tags ?? []).join("、"),
          },
          {
            key: "detail_work",
            label: "详情",
            value: clipPeek(r.detail_work, slim),
            multiline: true,
          },
          {
            key: "acceptance_criteria",
            label: "验收",
            value: clipPeek(r.acceptance_criteria, slim),
            multiline: true,
          },
          { key: "priority", label: "优先级", value: r.priority ?? "" },
        ],
      };
    });

  const mapBug = (b: Bug): LinkedViewRow => ({
    id: b.id,
    title: b.title,
    href: `/projects/${routeId}/bugs/${b.id}`,
    badge: TASK_STATUS_LABELS[b.status] ?? b.status,
    cells: {
      module: b.module_path ?? "",
      status: TASK_STATUS_LABELS[b.status] ?? b.status,
      priority: b.priority ?? "",
    },
    peekKind: "bug",
    fields: [
      {
        key: "repro_steps",
        label: "操作步骤",
        value: clipPeek(b.repro_steps, slim),
        multiline: true,
      },
      {
        key: "expected_result",
        label: "预期",
        value: clipPeek(b.expected_result, slim),
        multiline: true,
      },
      {
        key: "actual_result",
        label: "实际 / 现状",
        value: clipPeek(b.actual_result, slim),
        multiline: true,
      },
      {
        key: "description",
        label: "描述 / 证据",
        value: clipPeek(b.description, slim),
        multiline: true,
      },
      {
        key: "suggestion",
        label: "优化建议",
        value: clipPeek(b.suggestion, slim),
        multiline: true,
      },
      ...peekModuleFields(b.module_path ?? ""),
    ],
  });

  const bugs = input.bugs.map(mapBug);
  const optimization = input.bugs.filter(isOptimizationBug).map(mapBug);

  const learning: LinkedViewRow[] = [];
  for (const n of input.learnings) {
    if (n.kind === "section") continue;
    learning.push({
      id: n.id,
      title: n.title,
      href: `/projects/${routeId}/learning`,
      badge: kindLabel(n.kind),
      cells: {
        module: learningSectionTitle(n, learnById),
        kind: kindLabel(n.kind),
      },
      peekKind: "learning",
      fields: [
        ...peekModuleFields(learningSectionTitle(n, learnById)),
        { key: "why_text", label: "为什么", value: n.why_text ?? "", multiline: true },
        {
          key: "principle",
          label: "原理 / 要点",
          value: n.principle ?? "",
          multiline: true,
        },
        { key: "protocol", label: "协议", value: n.protocol ?? "", multiline: true },
        {
          key: "tech_background",
          label: "技术背景",
          value: n.tech_background ?? "",
          multiline: true,
        },
        {
          key: "product_thinking",
          label: "产品思考",
          value: n.product_thinking ?? "",
          multiline: true,
        },
      ],
    });
  }

  const prds: LinkedViewRow[] = input.prds.map((p) => ({
    id: p.id,
    title: p.title,
    href: `/projects/${routeId}/prd`,
    badge: p.module_path ?? undefined,
    cells: { module: p.module_path ?? "" },
      peekKind: "prd",
      fields: peekModuleFields(p.module_path ?? ""),
  }));

  const competitor: LinkedViewRow[] = input.competitors.map((c) => ({
    id: c.id,
    title: c.title,
    href: `/projects/${routeId}/competitors`,
    cells: { module: c.module_path ?? "" },
      peekKind: "competitor",
      fields: [
        { key: "summary", label: "摘要", value: c.summary ?? "", multiline: true },
        { key: "url", label: "外链", value: c.url ?? "" },
        ...peekModuleFields(c.module_path ?? ""),
      ],
  }));

  const sortTitle = (a: LinkedViewRow, b: LinkedViewRow) =>
    a.title.localeCompare(b.title, "zh");

  return {
    requirement: requirements.sort(sortTitle).map((r) => applyTitleHintToRow(r, "requirement")),
    bug: bugs.sort(sortTitle).map((r) => applyTitleHintToRow(r, "bug")),
    optimization: optimization.sort(sortTitle).map((r) => applyTitleHintToRow(r, "optimization")),
    learning: learning.sort(sortTitle).map((r) => applyTitleHintToRow(r, "learning")),
    prd: prds.sort(sortTitle).map((r) => applyTitleHintToRow(r, "prd")),
    competitor: competitor.sort(sortTitle).map((r) => applyTitleHintToRow(r, "competitor")),
  };
}
