import type {
  Bug,
  CompetitorEntry,
  ModuleNode,
  ProjectLearningNote,
  ProjectPrd,
  Requirement,
} from "@/lib/types";
import { resolveFeatureModules } from "@/lib/studio/project-modules";
import type { StudioCustomFieldValue } from "@/lib/studio/types";

export const MODULE_BIOS_FIELD = "moduleBiosJson";

/** URL 段：中文模块名可直接 encode */
export function encodeModuleKey(name: string): string {
  return encodeURIComponent(name.trim());
}

export function decodeModuleKey(key: string): string {
  try {
    return decodeURIComponent(key).trim();
  } catch {
    return key.trim();
  }
}

/** 板块路径取首段：文件·上传 → 文件 */
export function moduleRootName(path: string | null | undefined): string {
  const raw = (path ?? "").trim();
  if (!raw) return "";
  return raw.split(/[>/·\-|／]/)[0]?.trim() || "";
}

export function belongsToModule(
  moduleName: string,
  pathOrSection: string | null | undefined
): boolean {
  const name = moduleName.trim();
  if (!name) return false;
  const raw = (pathOrSection ?? "").trim();
  if (!raw) return false;
  if (raw === name) return true;
  return moduleRootName(raw) === name;
}

export function parseModuleBios(
  customFields: Record<string, StudioCustomFieldValue> | null | undefined
): Record<string, string> {
  const raw = customFields?.[MODULE_BIOS_FIELD];
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && k.trim()) out[k.trim()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeModuleBios(bios: Record<string, string>): string {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(bios)) {
    const key = k.trim();
    if (!key) continue;
    cleaned[key] = v;
  }
  return JSON.stringify(cleaned);
}

export type ProductModuleSummary = {
  name: string;
  key: string;
  bio: string;
  counts: {
    learning: number;
    requirement: number;
    prd: number;
    bug: number;
    competitor: number;
  };
};

export type ModuleHomeLinkItem = {
  id: string;
  title: string;
  href: string;
  badge?: string;
  summary: string;
  peekKind?: "learning" | "bug" | "competitor" | "requirement";
  fields?: Array<{
    key: string;
    label: string;
    value: string;
    multiline?: boolean;
  }>;
};

export type ProductModuleHome = {
  name: string;
  key: string;
  bio: string;
  learnings: ModuleHomeLinkItem[];
  requirements: ModuleHomeLinkItem[];
  prds: ModuleHomeLinkItem[];
  bugs: ModuleHomeLinkItem[];
  competitors: ModuleHomeLinkItem[];
};

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

function reqModuleName(
  req: Requirement,
  modulesById: Map<string, ModuleNode>
): string {
  const leafId = req.module_l2_id || req.module_l1_id;
  if (!leafId) return "";
  const leaf = modulesById.get(leafId);
  if (!leaf) return "";
  if (!leaf.parent_id) return leaf.name;
  let cur: ModuleNode | undefined = leaf;
  for (let i = 0; i < 8 && cur; i++) {
    if (!cur.parent_id) return cur.name;
    cur = modulesById.get(cur.parent_id);
  }
  return leaf.name;
}

/** 汇总产品模块名单（功能板块 + 学习板块 + 路径首段 + 需求模块树 L1） */
export function collectProductModuleNames(input: {
  studioProjectId: string | null | undefined;
  featureModules: string[] | null | undefined;
  githubRepo?: string | null;
  learnings: ProjectLearningNote[];
  bugs: Bug[];
  competitors: CompetitorEntry[];
  prds: ProjectPrd[];
  requirements: Requirement[];
  modules: ModuleNode[];
}): string[] {
  const names = new Set<string>();
  const custom = (input.featureModules ?? []).map((m) => m.trim()).filter(Boolean);
  if (custom.length > 0) {
    for (const m of custom) {
      const root = moduleRootName(m) || m;
      if (root) names.add(root);
    }
  }

  for (const n of input.learnings) {
    if (n.kind === "section" && n.title.trim()) names.add(n.title.trim());
  }
  for (const b of input.bugs) {
    const r = moduleRootName(b.module_path);
    if (r) names.add(r);
  }
  for (const c of input.competitors) {
    const r = moduleRootName(c.module_path);
    if (r) names.add(r);
  }
  for (const p of input.prds) {
    const r = moduleRootName(p.module_path);
    if (r) names.add(r);
  }

  const modulesById = new Map(input.modules.map((m) => [m.id, m]));
  for (const m of input.modules) {
    if (m.level === 1 && m.name.trim()) names.add(m.name.trim());
  }
  for (const r of input.requirements) {
    const name = reqModuleName(r, modulesById);
    if (name) names.add(name);
  }

  if (names.size === 0 && input.studioProjectId) {
    for (const m of resolveFeatureModules(
      input.studioProjectId,
      input.featureModules,
      input.githubRepo
    )) {
      const root = moduleRootName(m) || m;
      if (root) names.add(root);
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b, "zh"));
}

export function buildProductModuleSummaries(input: {
  routeId: string;
  studioProjectId: string | null | undefined;
  featureModules: string[] | null | undefined;
  githubRepo?: string | null;
  customFields?: Record<string, StudioCustomFieldValue> | null;
  learnings: ProjectLearningNote[];
  bugs: Bug[];
  competitors: CompetitorEntry[];
  prds: ProjectPrd[];
  requirements: Requirement[];
  modules: ModuleNode[];
}): ProductModuleSummary[] {
  const bios = parseModuleBios(input.customFields);
  const names = collectProductModuleNames(input);
  return names.map((name) => {
    const home = buildProductModuleHome({ ...input, moduleName: name, bios });
    return {
      name,
      key: encodeModuleKey(name),
      bio: home.bio,
      counts: {
        learning: home.learnings.length,
        requirement: home.requirements.length,
        prd: home.prds.length,
        bug: home.bugs.length,
        competitor: home.competitors.length,
      },
    };
  });
}

export function buildProductModuleHome(input: {
  routeId: string;
  moduleName: string;
  bios?: Record<string, string>;
  customFields?: Record<string, StudioCustomFieldValue> | null;
  learnings: ProjectLearningNote[];
  bugs: Bug[];
  competitors: CompetitorEntry[];
  prds: ProjectPrd[];
  requirements: Requirement[];
  modules: ModuleNode[];
}): ProductModuleHome {
  const name = input.moduleName.trim();
  const bios = input.bios ?? parseModuleBios(input.customFields);
  const byId = new Map(input.learnings.map((n) => [n.id, n]));
  const modulesById = new Map(input.modules.map((m) => [m.id, m]));
  const routeId = input.routeId;

  const learnings: ModuleHomeLinkItem[] = [];
  for (const n of input.learnings) {
    if (n.kind === "section") continue;
    const section = learningSectionTitle(n, byId);
    if (!belongsToModule(name, section)) continue;
    const summary = [n.principle, n.why_text, n.product_thinking]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 160);
    learnings.push({
      id: n.id,
      title: n.title,
      href: `/projects/${routeId}/learning`,
      badge: n.kind === "point" ? "子知识" : "主题",
      summary,
      peekKind: "learning",
      fields: [
        { key: "why_text", label: "为什么", value: n.why_text ?? "", multiline: true },
        { key: "principle", label: "原理 / 要点", value: n.principle ?? "", multiline: true },
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

  const requirements: ModuleHomeLinkItem[] = [];
  for (const r of input.requirements) {
    if (!r.title?.trim()) continue;
    if (!belongsToModule(name, reqModuleName(r, modulesById))) continue;
    requirements.push({
      id: r.id,
      title: r.title,
      href: `/projects/${routeId}/requirements/${r.id}`,
      badge: r.type,
      summary: [r.detail_work, r.acceptance_criteria]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, 160),
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
    });
  }

  const prds: ModuleHomeLinkItem[] = [];
  for (const p of input.prds) {
    if (!belongsToModule(name, p.module_path)) continue;
    prds.push({
      id: p.id,
      title: p.title,
      href: `/projects/${routeId}/prd`,
      badge: p.module_path ?? undefined,
      summary: (p.module_path ?? "").slice(0, 160),
    });
  }

  const bugs: ModuleHomeLinkItem[] = [];
  for (const b of input.bugs) {
    if (!belongsToModule(name, b.module_path)) continue;
    bugs.push({
      id: b.id,
      title: b.title,
      href: `/projects/${routeId}/bugs/${b.id}`,
      badge: b.status,
      summary: [b.actual_result, b.suggestion, b.description]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, 160),
      peekKind: "bug",
      fields: [
        {
          key: "repro_steps",
          label: "操作步骤",
          value: b.repro_steps ?? "",
          multiline: true,
        },
        {
          key: "expected_result",
          label: "预期",
          value: b.expected_result ?? "",
          multiline: true,
        },
        {
          key: "actual_result",
          label: "实际 / 现状",
          value: b.actual_result ?? "",
          multiline: true,
        },
        {
          key: "description",
          label: "描述 / 证据",
          value: b.description ?? "",
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
    });
  }

  const competitors: ModuleHomeLinkItem[] = [];
  for (const c of input.competitors) {
    if (!belongsToModule(name, c.module_path)) continue;
    competitors.push({
      id: c.id,
      title: c.title,
      href: `/projects/${routeId}/competitors`,
      summary: (c.summary ?? "").slice(0, 160),
      peekKind: "competitor",
      fields: [
        { key: "summary", label: "摘要", value: c.summary ?? "", multiline: true },
        { key: "url", label: "外链", value: c.url ?? "" },
        { key: "module_path", label: "板块 / 模块", value: c.module_path ?? "" },
      ],
    });
  }

  const sortTitle = (a: ModuleHomeLinkItem, b: ModuleHomeLinkItem) =>
    a.title.localeCompare(b.title, "zh");
  learnings.sort(sortTitle);
  requirements.sort(sortTitle);
  prds.sort(sortTitle);
  bugs.sort(sortTitle);
  competitors.sort(sortTitle);

  return {
    name,
    key: encodeModuleKey(name),
    bio: bios[name] ?? "",
    learnings,
    requirements,
    prds,
    bugs,
    competitors,
  };
}
