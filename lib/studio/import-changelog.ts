/**
 * 将 CHANGELOG 各版本条目导入为 Star PM 演进（带 releaseTag + 推断板块）
 */
import fs from "fs";
import path from "path";
import { inferModuleFromText } from "@/lib/studio/infer-modules";
import { resolveFeatureModules } from "@/lib/studio/project-modules";
import type { EvolutionLog, EvolutionLogType } from "@/lib/studio/types";

export type ChangelogSection = {
  tag: string;
  date: string;
  bullets: string[];
};

export function parseChangelogSections(md: string): ChangelogSection[] {
  const out: ChangelogSection[] = [];
  const parts = md.split(/^## /m).slice(1);
  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    const head = lines[0] || "";
    const m = head.match(/^(v[\d.]+)\s*[·•]\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const bullets = lines
      .slice(1)
      .filter((l) => l.trim().startsWith("- "))
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
    out.push({ tag: m[1], date: m[2], bullets });
  }
  return out;
}

export function stripBulletDecor(text: string): string {
  return text.replace(/^\*\*(.+?)\*\*[：:]?\s*/, "$1：").trim();
}

export type ChangelogImportItem = {
  title: string;
  after: string;
  releaseTag: string;
  module: string;
  logType: EvolutionLogType;
  reason: string;
  decision: string;
  createdAt: string;
};

/** 把 CHANGELOG 拆成可写入演进的条目（不直接写库） */
export function buildChangelogEvolutionItems(
  md: string,
  projectId: string,
  opts?: { featureModules?: string[] | null; githubRepo?: string | null }
): ChangelogImportItem[] {
  const allowed = resolveFeatureModules(
    projectId,
    opts?.featureModules,
    opts?.githubRepo
  );
  const sections = parseChangelogSections(md);
  const items: ChangelogImportItem[] = [];

  for (const section of sections) {
    for (const bullet of section.bullets) {
      const clean = stripBulletDecor(bullet);
      const title =
        clean.length > 80 ? `${clean.slice(0, 77)}…` : clean || `${section.tag} 变更`;
      const module =
        inferModuleFromText(`${title}\n${bullet}`, {
          projectId,
          githubRepo: opts?.githubRepo,
          allowed,
        }) || "";
      items.push({
        title,
        after: bullet,
        releaseTag: section.tag,
        module,
        logType: "feature_add",
        reason: module
          ? `自 CHANGELOG ${section.tag} 导入；板块由关键词推断为「${module}」`
          : `自 CHANGELOG ${section.tag} 导入；未能推断板块，请补齐`,
        decision: module ? "" : "【待补齐·板块】",
        createdAt: `${section.date}T12:00:00.000Z`,
      });
    }
  }
  return items;
}

export function readRepoChangelog(root = process.cwd()): string {
  return fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
}

/** 去重键：同项目同版本同标题视为已导入 */
export function changelogItemKey(projectId: string, item: ChangelogImportItem): string {
  return `${projectId}::${item.releaseTag}::${item.title}`;
}

export function filterNewChangelogItems(
  items: ChangelogImportItem[],
  existing: EvolutionLog[],
  projectId: string
): ChangelogImportItem[] {
  const have = new Set(
    existing
      .filter((e) => e.projectId === projectId)
      .map((e) => `${projectId}::${e.releaseTag ?? ""}::${e.title}`)
  );
  return items.filter((item) => !have.has(changelogItemKey(projectId, item)));
}
