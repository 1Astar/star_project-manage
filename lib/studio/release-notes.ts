import type { EvolutionLog, Idea, StudioRelease } from "@/lib/studio/types";
import type { GitHubCommit } from "@/lib/github/client";

/**
 * 语义化发版 Tag：整段为 v?MAJOR.MINOR[.PATCH[.BUILD]][+/-预发布]。
 * `stage/…`、`nest/…` 等过程 Tag 返回 false。
 */
export function isSemverReleaseTag(tag: string): boolean {
  const t = tag.trim();
  if (!t) return false;
  return /^v?\d+\.\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?$/i.test(t);
}

/** 拆成默认展示的语义化版本 vs 折叠的过程 Tag */
export function partitionReleaseTags<T extends { tag: string }>(
  releases: T[]
): { semver: T[]; process: T[] } {
  const semver: T[] = [];
  const process: T[] = [];
  for (const r of releases) {
    if (isSemverReleaseTag(r.tag)) semver.push(r);
    else process.push(r);
  }
  return { semver, process };
}

/** 简易版本排序：优先解析 v1.2.3，否则按字符串 */
export function compareVersionTags(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  if (pa && pb) {
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da !== db) return da - db;
    }
    return 0;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function parseVersionParts(tag: string): number[] | null {
  const m = tag.trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return m.slice(1).filter((x) => x !== undefined).map((x) => Number(x));
}

export function formatCommitsAsChangelog(commits: GitHubCommit[], limit = 40): string {
  const lines = commits
    .map((c) => (c.commit?.message ?? "").split("\n")[0]?.trim() ?? "")
    .filter(Boolean)
    .slice(0, limit);
  if (!lines.length) return "";
  return ["### 本版变更（commits）", ...lines.map((l) => `- ${l}`)].join("\n");
}

export function modulesForReleaseTag(
  tag: string,
  evolution: EvolutionLog[],
  ideas: Idea[] = []
): string[] {
  const set = new Set<string>();
  for (const e of evolution) {
    if (e.releaseTag === tag && e.module?.trim()) set.add(e.module.trim());
  }
  // 灵感无 releaseTag 时不计入发版聚合（避免误挂）
  void ideas;
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export type ModuleChangeGroup = {
  module: string;
  items: Array<{ title: string; detail?: string; source: "evolution" | "idea" }>;
};

/** 汇总某版本（或未挂版本）的板块变更，供 UI / GitHub Release */
export function groupChangesByModule(opts: {
  evolution: EvolutionLog[];
  ideas?: Idea[];
  releaseTag: string | null;
  /** 未挂版本：只取 releaseTag 为空的演进 */
  untaggedOnly?: boolean;
}): ModuleChangeGroup[] {
  const map = new Map<string, ModuleChangeGroup>();

  function push(
    module: string,
    item: { title: string; detail?: string; source: "evolution" | "idea" }
  ) {
    const key = module.trim() || "未分板块";
    const g = map.get(key) ?? { module: key, items: [] };
    g.items.push(item);
    map.set(key, g);
  }

  for (const e of opts.evolution) {
    const tag = e.releaseTag?.trim() || null;
    if (opts.untaggedOnly) {
      if (tag) continue;
    } else if (tag !== opts.releaseTag) {
      continue;
    }
    push(e.module || "未分板块", {
      title: e.title,
      detail: e.after || e.reason || undefined,
      source: "evolution",
    });
  }

  // 灵感：仅当 relatedModule 有值且（可选）在同项目上下文展示；不按 releaseTag 过滤除非将来扩展
  if (opts.ideas && opts.untaggedOnly) {
    for (const idea of opts.ideas) {
      if (!idea.relatedModule?.trim()) continue;
      push(idea.relatedModule, {
        title: idea.title,
        detail: idea.oneLineIdea || undefined,
        source: "idea",
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.module.localeCompare(b.module, "zh-CN"));
}

export function formatReleaseNotesMarkdown(opts: {
  title?: string;
  groups: ModuleChangeGroup[];
  commitChangelog?: string;
}): string {
  const parts: string[] = [];
  if (opts.title) parts.push(`# ${opts.title}`, "");
  if (opts.groups.length) {
    parts.push("## 按板块");
    for (const g of opts.groups) {
      parts.push("", `### ${g.module}`);
      for (const item of g.items) {
        const extra = item.detail ? ` — ${item.detail.replace(/\s+/g, " ").slice(0, 120)}` : "";
        parts.push(`- ${item.title}${extra}`);
      }
    }
  } else {
    parts.push("## 按板块", "", "_暂无带板块标签的演进/灵感。请在 MCP/站内写入时填写板块。_");
  }
  if (opts.commitChangelog?.trim()) {
    parts.push("", opts.commitChangelog.trim());
  }
  return parts.join("\n").trim() + "\n";
}

export function enrichReleaseDisplay(
  release: StudioRelease,
  evolution: EvolutionLog[],
  ideas: Idea[] = []
) {
  const modules = modulesForReleaseTag(release.tag, evolution, ideas);
  const groups = groupChangesByModule({
    evolution,
    ideas: [],
    releaseTag: release.tag,
  });
  return { modules, groups };
}
