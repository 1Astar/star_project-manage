import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";
import {
  getPoolBundle,
  getProjectBundle,
  getProjects,
  updateRequirement,
} from "@/lib/db/local-store";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import { applyLifecycleStatus } from "@/lib/requirement-status";
import { getProjectById, getProjectIdeas, getProjectTasks } from "@/lib/studio/data";
import { updateStudioTask } from "@/lib/studio/mutations";
import { requirementIsDone, type Requirement } from "@/lib/types";

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/✅|\[done\]/gi, "")
    .replace(/[\s\[\]【】·\-_/P0-3p]/g, "");
}

function similar(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) >= 5;
  return false;
}

function looksMarkedDoneInTitle(title: string) {
  return /✅|\[done\]|（已完成）|\(已完成\)|关账/i.test(title);
}

/** 从「体系·功能面·能力」取末级/次末级作匹配词 */
function moduleMatchKeys(modules: string[]): string[] {
  const keys: string[] = [];
  for (const m of modules) {
    const parts = m.split("·").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    keys.push(parts[parts.length - 1]!);
    if (parts.length >= 2) keys.push(parts.slice(-2).join(""));
    keys.push(m.replace(/·/g, ""));
  }
  return [...new Set(keys)].filter((k) => k.length >= 2);
}

/**
 * 保守地把「已经做完」的需求/任务标成完成。
 */
export async function markShippedCompleteForProject(studioProjectId: string): Promise<{
  markedRequirements: number;
  markedTasks: number;
  samples: string[];
  scannedRequirements: number;
  pmSlugTried: string[];
}> {
  const studio = await getProjectById(studioProjectId);
  if (!studio) throw new Error("Studio 项目不存在");

  const samples: string[] = [];
  let markedTasks = 0;
  let markedRequirements = 0;

  const [tasks, ideas] = await Promise.all([
    getProjectTasks(studioProjectId),
    getProjectIdeas(studioProjectId),
  ]);
  const doneTasks = [...tasks.filter((t) => t.status === "done")];
  const doneIdeas = ideas.filter((i) => i.status === "done");

  for (const t of tasks) {
    if (t.status === "done") continue;
    if (!looksMarkedDoneInTitle(t.title)) continue;
    await updateStudioTask(t.id, { status: "done" });
    doneTasks.push({ ...t, status: "done" });
    markedTasks += 1;
    if (samples.length < 12) samples.push(`task:${t.title}`);
  }

  const slug = getPmSlugForStudioProject(studio);
  const pmProjects = await getProjects();
  const pmByName = pmProjects.find((p) => p.name === studio.title);
  const pmBySlug = pmProjects.find(
    (p) => p.slug === slug || p.slug === `studio-${studioProjectId}`
  );

  const slugTried = [
    slug,
    `studio-${studioProjectId}`,
    pmBySlug?.slug,
    pmByName?.slug,
    pmBySlug?.id,
    pmByName?.id,
  ].filter(Boolean) as string[];

  const byId = new Map<string, Requirement>();
  for (const key of slugTried) {
    const [pool, board] = await Promise.all([
      getPoolBundle(key).catch(() => null),
      getProjectBundle(key).catch(() => null),
    ]);
    for (const r of pool?.poolRequirements ?? []) byId.set(r.id, r);
    for (const r of board?.requirements ?? []) byId.set(r.id, r);
  }

  const all = [...byId.values()];
  const doneReqIds = new Set(all.filter((r) => requirementIsDone(r)).map((r) => r.id));
  const moduleKeys = moduleMatchKeys(studio.featureModules ?? []);
  const realLeaves = all.filter((r) => !all.some((x) => x.parent_id === r.id));

  for (const r of realLeaves) {
    if (doneReqIds.has(r.id)) continue;

    const hitTask = doneTasks.find((t) => similar(t.title, r.title));
    const hitIdea = doneIdeas.find((i) => similar(i.title, r.title));
    // 模块词命中：仅当标题与模块末级高度重合，且该模块能在已完成任务/灵感里找到旁证
    const hitModuleKey = moduleKeys.find((k) => {
      const nt = norm(r.title);
      const nk = norm(k);
      return nk.length >= 2 && (nt.includes(nk) || nk.includes(nt));
    });
    const moduleOk =
      Boolean(hitModuleKey) &&
      (Boolean(hitTask) ||
        Boolean(hitIdea) ||
        doneTasks.some((t) => similar(t.title, hitModuleKey!)) ||
        doneIdeas.some((i) => similar(i.title, hitModuleKey!)));

    const should =
      Boolean(hitTask) ||
      Boolean(hitIdea) ||
      moduleOk ||
      r.status === "done" ||
      looksMarkedDoneInTitle(r.title) ||
      (r.status_tags ?? []).some((t) => t === "已完成" || t === "已做");

    if (!should) continue;

    try {
      await updateRequirement(
        r.id,
        {
          status_tags: applyLifecycleStatus(r.status_tags, "完成"),
          completed_at: r.completed_at ?? new Date().toISOString(),
        },
        { name: AGENT_ACTOR_NAME, role: "ai" }
      );
      doneReqIds.add(r.id);
      markedRequirements += 1;
      if (samples.length < 24) {
        const why = hitTask
          ? `←task`
          : hitIdea
            ? `←idea`
            : moduleOk
              ? `←module`
              : `←status`;
        samples.push(`req:${r.title}${why}`);
      }
    } catch {
      /* 父/子约束等 */
    }
  }

  const parents = all.filter((r) => all.some((x) => x.parent_id === r.id));
  for (const r of parents) {
    if (doneReqIds.has(r.id)) continue;
    const kids = all.filter((x) => x.parent_id === r.id);
    if (kids.length === 0) continue;
    if (!kids.every((k) => doneReqIds.has(k.id))) continue;
    try {
      await updateRequirement(
        r.id,
        { status_tags: applyLifecycleStatus(r.status_tags, "完成") },
        { name: AGENT_ACTOR_NAME, role: "ai" }
      );
      doneReqIds.add(r.id);
      markedRequirements += 1;
      if (samples.length < 28) samples.push(`parent:${r.title}`);
    } catch {
      /* ignore */
    }
  }

  return {
    markedRequirements,
    markedTasks,
    samples,
    scannedRequirements: all.length,
    pmSlugTried: slugTried,
  };
}
