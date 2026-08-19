import { getAppSetting, upsertAppSetting } from "@/lib/studio/app-settings";
import { getAllProjects } from "@/lib/studio/data";

export const BUG_FEEDBACK_TOKENS_KEY = "bug_feedback_tokens";

export type BugFeedbackTokenMap = Record<string, string>; // token -> studioProjectId

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

  const projects = await getAllProjects();
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
  const [projects, map] = await Promise.all([getAllProjects(), loadBugFeedbackTokens()]);
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
