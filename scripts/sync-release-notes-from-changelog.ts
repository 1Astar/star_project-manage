/**
 * Sync GitHub Release bodies from CHANGELOG.md (Chinese notes + modules).
 * Usage: npx tsx --env-file=.env.local scripts/sync-release-notes-from-changelog.ts
 * Needs: GH_TOKEN or git credential / GITHUB_TOKEN
 */
import fs from "fs";
import path from "path";
import { inferModulesFromText } from "../lib/studio/infer-modules";
import { parseChangelogSections } from "../lib/studio/import-changelog";

const REPO = "1Astar/star_project-manage";
const ROOT = path.resolve(__dirname, "..");

function getToken(): string {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  throw new Error("需要 GH_TOKEN 或 GITHUB_TOKEN");
}

function buildBody(tag: string, date: string, bullets: string[]): string {
  const modules = inferModulesFromText(bullets.join("\n"), {
    projectId: "proj-star-pm",
  });
  const modLine = modules.length ? modules.join(" · ") : "设置";
  const lines = [
    `## Star PM ${tag} · ${date}`,
    "",
    `**涉及板块：** ${modLine}`,
    "",
    ...bullets.map((b) => (b.startsWith("- ") ? b : `- ${b}`)),
    "",
    "---",
    `完整变更见仓库 [\`CHANGELOG.md\`](https://github.com/${REPO}/blob/main/CHANGELOG.md)。`,
    "",
  ];
  return lines.join("\n");
}

async function gh<T>(
  token: string,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "star-pm-sync-release-notes",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${urlPath} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function main() {
  const token = getToken();
  const md = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const sections = parseChangelogSections(md);
  const releases = await gh<Array<{ id: number; tag_name: string; body: string | null }>>(
    token,
    "GET",
    `/repos/${REPO}/releases?per_page=100`
  );
  const byTag = new Map(releases.map((r) => [r.tag_name, r]));

  let updated = 0;
  for (const section of sections) {
    const rel = byTag.get(section.tag);
    if (!rel) {
      console.log(`skip ${section.tag}: no GitHub Release`);
      continue;
    }
    const body = buildBody(
      section.tag,
      section.date,
      section.bullets.map((b) => `- ${b}`)
    );
    await gh(token, "PATCH", `/repos/${REPO}/releases/${rel.id}`, {
      body,
      name: `Star PM ${section.tag}`,
    });
    updated += 1;
    console.log(`updated ${section.tag} (${section.bullets.length} bullets)`);
  }
  console.log(`done: ${updated} releases updated`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
