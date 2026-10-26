/**
 * 总览「关联关系层」：正向 + 反向交叉关联 + 同板块 PRD。
 * 观感对齐 Notion Relation：属性行 + 可点开的关联 token。
 */
import {
  isOptimizationBug,
  sectionFromModulePath,
  type OverviewMatrixRow,
} from "@/lib/overview/matrix-rows";
import { encodeModuleKey } from "@/lib/modules/product-module-home";
import type {
  Bug,
  CompetitorEntry,
  ProjectLearningNote,
  ProjectPrd,
  Requirement,
} from "@/lib/types";

export type OverviewRelationGroupKey =
  | "module"
  | "learning"
  | "bug"
  | "optimization"
  | "requirement"
  | "prd"
  | "competitor";

export type OverviewRelationItem = {
  id: string;
  title: string;
  href?: string;
  badge?: string;
  /** 可 Peek；产品板块 / PRD 仅跳转 */
  peekKind?: "learning" | "bug" | "competitor" | "requirement";
  fields?: Array<{
    key: string;
    label: string;
    value: string;
    multiline?: boolean;
  }>;
};

export type OverviewRelationGroup = {
  key: OverviewRelationGroupKey;
  label: string;
  items: OverviewRelationItem[];
};

export type OverviewRelationBundle = {
  /** peekKind:entityId */
  key: string;
  title: string;
  rowType: string;
  groups: OverviewRelationGroup[];
};

const GROUP_ORDER: Array<{ key: OverviewRelationGroupKey; label: string }> = [
  { key: "module", label: "产品板块" },
  { key: "learning", label: "知识点" },
  { key: "bug", label: "相关 Bug" },
  { key: "optimization", label: "优化建议" },
  { key: "requirement", label: "需求" },
  { key: "prd", label: "PRD" },
  { key: "competitor", label: "竞品" },
];

export function overviewRelationKey(
  peekKind: OverviewMatrixRow["peekKind"],
  entityId: string
): string {
  return `${peekKind}:${entityId}`;
}

function dedupeItems(items: OverviewRelationItem[]): OverviewRelationItem[] {
  const seen = new Set<string>();
  const out: OverviewRelationItem[] = [];
  for (const it of items) {
    const k = `${it.peekKind ?? "nav"}:${it.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "zh"));
}

function learningItem(
  n: ProjectLearningNote,
  routeId: string
): OverviewRelationItem {
  return {
    id: n.id,
    title: n.title,
    href: `/projects/${routeId}/learning`,
    badge: n.kind === "point" ? "子知识" : n.kind === "topic" ? "主题" : "板块",
    peekKind: "learning",
    fields: [
      { key: "why_text", label: "为什么", value: n.why_text ?? "", multiline: true },
      { key: "principle", label: "原理 / 要点", value: n.principle ?? "", multiline: true },
      {
        key: "product_thinking",
        label: "产品思考",
        value: n.product_thinking ?? "",
        multiline: true,
      },
    ],
  };
}

function bugItem(b: Bug, routeId: string): OverviewRelationItem {
  const opt = isOptimizationBug(b);
  return {
    id: b.id,
    title: b.title,
    href: `/projects/${routeId}/bugs/${b.id}`,
    badge: opt ? "优化" : undefined,
    peekKind: "bug",
    fields: [
      {
        key: "repro_steps",
        label: "操作步骤",
        value: b.repro_steps ?? "",
        multiline: true,
      },
      {
        key: "actual_result",
        label: "实际 / 现状",
        value: b.actual_result ?? "",
        multiline: true,
      },
      {
        key: "suggestion",
        label: "优化建议",
        value: b.suggestion ?? "",
        multiline: true,
      },
      { key: "module_path", label: "板块 / 模块", value: b.module_path ?? "" },
    ],
  };
}

function reqItem(r: Requirement, routeId: string): OverviewRelationItem {
  return {
    id: r.id,
    title: r.title,
    href: `/projects/${routeId}/requirements/${r.id}`,
    badge: r.in_pool ? "池" : "上板",
    peekKind: "requirement",
    fields: [
      {
        key: "detail_work",
        label: "详情",
        value: r.detail_work ?? "",
        multiline: true,
      },
      {
        key: "acceptance_criteria",
        label: "验收",
        value: r.acceptance_criteria ?? "",
        multiline: true,
      },
      { key: "priority", label: "优先级", value: r.priority ?? "" },
    ],
  };
}

function competitorItem(
  c: CompetitorEntry,
  routeId: string
): OverviewRelationItem {
  return {
    id: c.id,
    title: c.title,
    href: `/projects/${routeId}/competitors`,
    peekKind: "competitor",
    fields: [
      { key: "summary", label: "摘要", value: c.summary ?? "", multiline: true },
      { key: "url", label: "外链", value: c.url ?? "" },
      { key: "module_path", label: "板块 / 模块", value: c.module_path ?? "" },
    ],
  };
}

function prdItem(p: ProjectPrd, routeId: string): OverviewRelationItem {
  return {
    id: p.id,
    title: p.title,
    href: `/projects/${routeId}/prd`,
    badge: p.module_path ?? undefined,
  };
}

function moduleItem(
  section: string,
  projectSlug: string
): OverviewRelationItem | null {
  const name = section.trim();
  if (!name || name === "未分板块") return null;
  return {
    id: `module:${name}`,
    title: name,
    href: `/projects/${projectSlug}/modules/${encodeModuleKey(name)}`,
    badge: "模块主页",
  };
}

function pushUnique(
  bag: Map<string, OverviewRelationItem>,
  item: OverviewRelationItem
) {
  const k = `${item.peekKind ?? "nav"}:${item.id}`;
  if (!bag.has(k)) bag.set(k, item);
}

/**
 * 为每条总览实体预计算关联包（服务端一次算完，客户端按选中行取用）。
 */
export function buildOverviewRelationIndex(input: {
  routeId: string;
  projectSlug: string;
  rows: OverviewMatrixRow[];
  learnings: ProjectLearningNote[];
  bugs: Bug[];
  competitors: CompetitorEntry[];
  requirements: Requirement[];
  prds: ProjectPrd[];
}): Record<string, OverviewRelationBundle> {
  const {
    routeId,
    projectSlug,
    rows,
    learnings,
    bugs,
    competitors,
    requirements,
    prds,
  } = input;

  const learnById = new Map(learnings.map((n) => [n.id, n]));
  const bugById = new Map(bugs.map((b) => [b.id, b]));
  const compById = new Map(competitors.map((c) => [c.id, c]));
  const reqById = new Map(requirements.map((r) => [r.id, r]));

  const prdsBySection = new Map<string, ProjectPrd[]>();
  for (const p of prds) {
    const sec = sectionFromModulePath(p.module_path);
    if (sec === "未分板块") continue;
    const list = prdsBySection.get(sec) ?? [];
    list.push(p);
    prdsBySection.set(sec, list);
  }

  const out: Record<string, OverviewRelationBundle> = {};

  for (const row of rows) {
    const key = overviewRelationKey(row.peekKind, row.entityId);
    const learningBag = new Map<string, OverviewRelationItem>();
    const bugBag = new Map<string, OverviewRelationItem>();
    const optBag = new Map<string, OverviewRelationItem>();
    const reqBag = new Map<string, OverviewRelationItem>();
    const compBag = new Map<string, OverviewRelationItem>();
    const prdBag = new Map<string, OverviewRelationItem>();

    const addBug = (b: Bug | undefined) => {
      if (!b) return;
      if (b.id === row.entityId && row.peekKind === "bug") return;
      const item = bugItem(b, routeId);
      if (isOptimizationBug(b)) pushUnique(optBag, item);
      else pushUnique(bugBag, item);
    };
    const addLearning = (n: ProjectLearningNote | undefined) => {
      if (!n || n.kind === "section") return;
      if (n.id === row.entityId && row.peekKind === "learning") return;
      pushUnique(learningBag, learningItem(n, routeId));
    };
    const addReq = (r: Requirement | undefined) => {
      if (!r) return;
      if (r.id === row.entityId && row.peekKind === "requirement") return;
      pushUnique(reqBag, reqItem(r, routeId));
    };
    const addComp = (c: CompetitorEntry | undefined) => {
      if (!c) return;
      if (c.id === row.entityId && row.peekKind === "competitor") return;
      pushUnique(compBag, competitorItem(c, routeId));
    };

    // —— 正向 ——
    if (row.peekKind === "learning") {
      const n = learnById.get(row.entityId);
      if (n) {
        for (const id of n.linked_requirement_ids ?? []) addReq(reqById.get(id));
        for (const id of n.linked_competitor_ids ?? []) addComp(compById.get(id));
        for (const id of n.linked_bug_ids ?? []) addBug(bugById.get(id));
        for (const s of n.suggestions ?? []) {
          if (s.linked_requirement_id) addReq(reqById.get(s.linked_requirement_id));
        }
      }
    } else if (row.peekKind === "bug") {
      const b = bugById.get(row.entityId);
      if (b) {
        for (const id of b.linked_learning_note_ids ?? [])
          addLearning(learnById.get(id));
        for (const id of b.linked_competitor_ids ?? []) addComp(compById.get(id));
      }
    } else if (row.peekKind === "competitor") {
      const c = compById.get(row.entityId);
      if (c) {
        for (const id of c.linked_learning_note_ids ?? [])
          addLearning(learnById.get(id));
        for (const id of c.linked_requirement_ids ?? []) addReq(reqById.get(id));
        for (const id of c.linked_bug_ids ?? []) addBug(bugById.get(id));
      }
    } else if (row.peekKind === "requirement") {
      // 需求侧关联挂在对方实体上：反向扫
    }

    // —— 反向 ——
    for (const n of learnings) {
      if (n.kind === "section") continue;
      const hitReq =
        row.peekKind === "requirement" &&
        (n.linked_requirement_ids ?? []).includes(row.entityId);
      const hitBug =
        row.peekKind === "bug" &&
        (n.linked_bug_ids ?? []).includes(row.entityId);
      const hitComp =
        row.peekKind === "competitor" &&
        (n.linked_competitor_ids ?? []).includes(row.entityId);
      const hitSug =
        row.peekKind === "requirement" &&
        (n.suggestions ?? []).some((s) => s.linked_requirement_id === row.entityId);
      if (hitReq || hitBug || hitComp || hitSug) addLearning(n);
    }
    for (const b of bugs) {
      const hitLearn =
        row.peekKind === "learning" &&
        (b.linked_learning_note_ids ?? []).includes(row.entityId);
      const hitComp =
        row.peekKind === "competitor" &&
        (b.linked_competitor_ids ?? []).includes(row.entityId);
      if (hitLearn || hitComp) addBug(b);
    }
    for (const c of competitors) {
      const hitLearn =
        row.peekKind === "learning" &&
        (c.linked_learning_note_ids ?? []).includes(row.entityId);
      const hitReq =
        row.peekKind === "requirement" &&
        (c.linked_requirement_ids ?? []).includes(row.entityId);
      const hitBug =
        row.peekKind === "bug" &&
        (c.linked_bug_ids ?? []).includes(row.entityId);
      if (hitLearn || hitReq || hitBug) addComp(c);
    }

    // 同板块 PRD
    const sectionPrds = prdsBySection.get(row.section) ?? [];
    for (const p of sectionPrds) pushUnique(prdBag, prdItem(p, routeId));

    const mod = moduleItem(row.section, projectSlug);
    const groups: OverviewRelationGroup[] = GROUP_ORDER.map(({ key, label }) => {
      let items: OverviewRelationItem[] = [];
      if (key === "module") items = mod ? [mod] : [];
      else if (key === "learning") items = dedupeItems([...learningBag.values()]);
      else if (key === "bug") items = dedupeItems([...bugBag.values()]);
      else if (key === "optimization") items = dedupeItems([...optBag.values()]);
      else if (key === "requirement") items = dedupeItems([...reqBag.values()]);
      else if (key === "prd") items = dedupeItems([...prdBag.values()]);
      else if (key === "competitor") items = dedupeItems([...compBag.values()]);
      return { key, label, items };
    });

    out[key] = {
      key,
      title: row.title,
      rowType: row.rowType,
      groups,
    };
  }

  return out;
}
