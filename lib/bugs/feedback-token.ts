import { getAppSetting, upsertAppSetting } from "@/lib/studio/app-settings";
import { getStudioSnapshot } from "@/lib/studio/store";

export const BUG_FEEDBACK_TOKENS_KEY = "bug_feedback_tokens";

export type BugFeedbackTokenMap = Record<string, string>; // token -> studioProjectId

/** 首批三端：随心而行 / 小手机 / Star PM */
export const PRIORITY_FEEDBACK_PROJECTS = [
  {
    studioProjectId: "proj-moonpie",
    title: "随心而行",
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-02c0940a",
    title: "小手机 / AI Companion",
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-star-pm",
    title: "Star PM",
    envKey: "NEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN",
  },
] as const;

export const DEFAULT_FEEDBACK_ENDPOINT =
  "https://pm.starry-studio.cn/api/public/bug-feedback";
export const DEFAULT_FEEDBACK_WIDGET =
  "https://pm.starry-studio.cn/bug-feedback-widget.js";

async function listStudioProjectsForTokens() {
  const { projects } = await getStudioSnapshot();
  return projects.filter((p) => p.status !== "archived" && p.status !== "parking");
}

function parseMap(raw: unknown): BugFeedbackTokenMap {
  if (!raw || typeof raw !== "object") return {};
  const out: BugFeedbackTokenMap = {};
  for (const [token, projectId] of Object.entries(raw as Record<string, unknown>)) {
    const t = token.trim();
    const p = typeof projectId === "string" ? projectId.trim() : "";
    if (t && p) out[t] = p;
  }
  return out;
}

function parseEnvMap(): BugFeedbackTokenMap {
  const raw = process.env.BUG_FEEDBACK_TOKENS?.trim();
  if (!raw) return {};
  try {
    return parseMap(JSON.parse(raw));
  } catch {
    // tok:proj-id,tok2:proj-id2
    const out: BugFeedbackTokenMap = {};
    for (const part of raw.split(/[,;\n]/)) {
      const [token, projectId] = part.split(":").map((s) => s.trim());
      if (token && projectId) out[token] = projectId;
    }
    return out;
  }
}

export async function loadBugFeedbackTokens(): Promise<BugFeedbackTokenMap> {
  const fromEnv = parseEnvMap();
  try {
    const row = await getAppSetting(BUG_FEEDBACK_TOKENS_KEY);
    const fromDb = parseMap(row?.value);
    return { ...fromEnv, ...fromDb };
  } catch {
    return fromEnv;
  }
}

export async function saveBugFeedbackTokens(map: BugFeedbackTokenMap): Promise<BugFeedbackTokenMap> {
  const cleaned = parseMap(map);
  await upsertAppSetting(BUG_FEEDBACK_TOKENS_KEY, cleaned);
  return cleaned;
}

export async function resolveStudioProjectIdByToken(
  token: string
): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const map = await loadBugFeedbackTokens();
  return map[trimmed] ?? null;
}

export function mintFeedbackToken(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `bfb_${rand.slice(0, 24)}`;
}

export async function ensureProjectFeedbackToken(
  studioProjectId: string
): Promise<{ token: string; created: boolean }> {
  const map = await loadBugFeedbackTokens();
  const existing = Object.entries(map).find(([, id]) => id === studioProjectId);
  if (existing) return { token: existing[0], created: false };

  const projects = await listStudioProjectsForTokens();
  if (!projects.some((p) => p.id === studioProjectId)) {
    throw new Error(`项目不存在：${studioProjectId}`);
  }

  const token = mintFeedbackToken();
  map[token] = studioProjectId;
  await saveBugFeedbackTokens(map);
  return { token, created: true };
}

export async function rotateProjectFeedbackToken(
  studioProjectId: string
): Promise<string> {
  const map = await loadBugFeedbackTokens();
  for (const [token, id] of Object.entries(map)) {
    if (id === studioProjectId) delete map[token];
  }
  const token = mintFeedbackToken();
  map[token] = studioProjectId;
  await saveBugFeedbackTokens(map);
  return token;
}

export async function listProjectFeedbackTokens(): Promise<
  Array<{ studioProjectId: string; title: string; token: string | null }>
> {
  const [projects, map] = await Promise.all([listStudioProjectsForTokens(), loadBugFeedbackTokens()]);
  const byProject = new Map<string, string>();
  for (const [token, id] of Object.entries(map)) byProject.set(id, token);

  return projects
    .filter((p) => p.status !== "archived" && p.status !== "parking")
    .map((p) => ({
      studioProjectId: p.id,
      title: p.title,
      token: byProject.get(p.id) ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "zh"));
}

export async function getProjectFeedbackToken(
  studioProjectId: string
): Promise<string | null> {
  const map = await loadBugFeedbackTokens();
  const hit = Object.entries(map).find(([, id]) => id === studioProjectId);
  return hit?.[0] ?? null;
}

export async function ensurePriorityFeedbackTokens(): Promise<
  Array<{ studioProjectId: string; title: string; token: string; created: boolean }>
> {
  const out: Array<{
    studioProjectId: string;
    title: string;
    token: string;
    created: boolean;
  }> = [];
  for (const row of PRIORITY_FEEDBACK_PROJECTS) {
    const result = await ensureProjectFeedbackToken(row.studioProjectId);
    out.push({
      studioProjectId: row.studioProjectId,
      title: row.title,
      token: result.token,
      created: result.created,
    });
  }
  return out;
}

export async function ensureAllFeedbackTokens(): Promise<
  Array<{ studioProjectId: string; title: string; token: string; created: boolean }>
> {
  const listed = await listProjectFeedbackTokens();
  const out: Array<{
    studioProjectId: string;
    title: string;
    token: string;
    created: boolean;
  }> = [];
  for (const row of listed) {
    const result = await ensureProjectFeedbackToken(row.studioProjectId);
    out.push({
      studioProjectId: row.studioProjectId,
      title: row.title,
      token: result.token,
      created: result.created,
    });
  }
  return out;
}

function envKeyForProject(studioProjectId: string): string {
  const spec = PRIORITY_FEEDBACK_PROJECTS.find((p) => p.studioProjectId === studioProjectId);
  return spec?.envKey ?? "VITE_STAR_PM_FEEDBACK_TOKEN";
}

export function formatFeedbackTokensEnv(
  items: Array<{ studioProjectId: string; title: string; token: string | null }>
): string {
  const lines = [
    "# Star PM Bug 反馈 token（勿提交 git）",
    `# 接口 ${DEFAULT_FEEDBACK_ENDPOINT}`,
    `# Widget ${DEFAULT_FEEDBACK_WIDGET}`,
    "# 每个项目单独复制到对应产品的 .env.local",
    "",
  ];
  const ordered = [...items].sort((a, b) => {
    const ai = PRIORITY_FEEDBACK_PROJECTS.findIndex((p) => p.studioProjectId === a.studioProjectId);
    const bi = PRIORITY_FEEDBACK_PROJECTS.findIndex((p) => p.studioProjectId === b.studioProjectId);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.title.localeCompare(b.title, "zh");
  });
  for (const item of ordered) {
    const token = item.token ?? "";
    const envKey = envKeyForProject(item.studioProjectId);
    lines.push(`# ${item.title} (${item.studioProjectId})`);
    lines.push(`${envKey}=${token}`);
    if (item.studioProjectId === "proj-star-pm") {
      lines.push(`STAR_PM_FEEDBACK_TOKEN=${token}`);
    }
    lines.push(`VITE_STAR_PM_FEEDBACK_ENDPOINT=${DEFAULT_FEEDBACK_ENDPOINT}`);
    lines.push(`VITE_STAR_PM_FEEDBACK_WIDGET=${DEFAULT_FEEDBACK_WIDGET}`);
    lines.push("");
  }
  return lines.join("\n");
}
