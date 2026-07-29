/**
 * 按小版本建/对齐规划迭代；可选按首次提出时间挂需求；用可追溯证据回填叶子工时。
 * 硬规则：无聊天/会话时间戳不瞎填。
 * 挂期：默认不覆盖（assignIterations=false）；规划范围应人定/半自动，时间窗复盘看 completed_at。
 */
import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";
import {
  createPlanningIteration,
  getProjects,
  updateRequirement,
} from "@/lib/db/local-store";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { isLeafRequirement } from "@/lib/requirement-tree";
import { requirementIsDone, requirementIsCancelled } from "@/lib/types";
import type { Requirement } from "@/lib/types";
import {
  getAllEvolutionLogs,
  getProjectChangeSessions,
  getProjectIdeas,
  getProjectTasks,
} from "@/lib/studio/data";
import { updateStudioEvolution } from "@/lib/studio/mutations";
import type { ChangeSession, EvolutionLog, Idea } from "@/lib/studio/types";

export type PeriodDef = {
  name: string;
  release_tag: string;
  /** inclusive start YYYY-MM-DD Asia/Shanghai calendar */
  start: string;
  /** exclusive end YYYY-MM-DD; null = open */
  end: string | null;
  /** title/module keyword override (any match → this period) */
  keywords?: string[];
  /** keyword match only applies if proposal day >= this */
  keywordFrom?: string;
  /** 仅关键词命中才归本期（逻辑小版本，不参与纯日期桶） */
  keywordOnly?: boolean;
};

const STAR_PM_PERIODS: PeriodDef[] = [
  {
    name: "202607 V1.2 Studio 整合",
    release_tag: "v1.2",
    start: "2026-06-22",
    end: "2026-07-01",
  },
  {
    name: "v1.7",
    release_tag: "v1.7",
    start: "2026-07-01",
    end: "2026-07-19",
  },
  {
    name: "v1.8",
    release_tag: "v1.8",
    start: "2026-07-19",
    end: "2026-07-20",
  },
  {
    name: "v1.9",
    release_tag: "v1.9",
    start: "2026-07-20",
    end: "2026-07-21",
  },
  {
    name: "v1.10",
    release_tag: "v1.10",
    start: "2026-07-21",
    end: null,
  },
];

/** 随心而行：真实 0.2/0.3 + 逻辑小版本（不改 git tag） */
const MOONPIE_PERIODS: PeriodDef[] = [
  {
    name: "v0.2",
    release_tag: "v0.2",
    start: "2026-07-01",
    end: "2026-07-22",
  },
  {
    name: "v0.3·人生宇宙",
    release_tag: "v0.3",
    start: "2026-07-22",
    end: null,
    keywords: ["人生宇宙", "平行人生", "预测打卡", "选择模拟", "轻画像"],
  },
  {
    name: "v0.4·八字",
    release_tag: "v0.3.x·逻辑0.4",
    start: "2026-07-22",
    end: null,
    keywords: ["八字", "四柱", "合盘", "纳音", "流年旁列", "日主十神"],
    keywordFrom: "2026-07-01",
    keywordOnly: true,
  },
  {
    name: "v0.5·Mystic Engine",
    release_tag: "v0.3.x·逻辑0.5",
    start: "2026-07-27",
    end: null,
    keywords: ["Mystic Engine", "OfflineAnswer", "离线答问", "此刻解读引擎"],
    keywordFrom: "2026-07-01",
    keywordOnly: true,
  },
];

/** 其它项目：按 Studio currentStage / 默认一期 */
function defaultPeriodsForProject(title: string): PeriodDef[] {
  return [
    {
      name: "v本期",
      release_tag: "current",
      start: "2026-01-01",
      end: null,
    },
  ];
}

const PERIODS_BY_STUDIO: Record<string, PeriodDef[]> = {
  "proj-star-pm": STAR_PM_PERIODS,
  "proj-moonpie": MOONPIE_PERIODS,
  "proj-ai-pet": [
    {
      name: "一期·情感芯片",
      release_tag: "p1",
      start: "2026-01-01",
      end: null,
      keywords: ["【一期】", "一期：", "一期·"],
      keywordOnly: true,
    },
    {
      name: "二期·稳定出海",
      release_tag: "p2",
      start: "2026-01-01",
      end: null,
      keywords: ["【二期", "二期：", "二期·"],
      keywordOnly: true,
    },
    {
      name: "三期·养成解锁",
      release_tag: "p3",
      start: "2026-01-01",
      end: null,
      keywords: ["【三期", "三期：", "三期·"],
      keywordOnly: true,
    },
    {
      name: "v本期",
      release_tag: "current",
      start: "2026-01-01",
      end: null,
    },
  ],
  "proj-c84ff6fa": [
    {
      name: "一期·小程序收敛",
      release_tag: "p1",
      start: "2026-01-01",
      end: null,
      keywords: ["【一期", "一期：", "一期·"],
      keywordOnly: true,
    },
    {
      name: "二期·型号工单",
      release_tag: "p2",
      start: "2026-01-01",
      end: null,
      keywords: ["【二期", "二期：", "二期·"],
      keywordOnly: true,
    },
    {
      name: "三期·经销商分流",
      release_tag: "p3",
      start: "2026-01-01",
      end: null,
      keywords: ["【三期", "三期：", "三期·"],
      keywordOnly: true,
    },
    {
      name: "v2·三Tab",
      release_tag: "v2",
      start: "2026-01-01",
      end: null,
      keywords: ["【v2", "v2·", "v2 "],
      keywordOnly: true,
    },
    {
      name: "v本期",
      release_tag: "current",
      start: "2026-01-01",
      end: null,
    },
  ],
};

const BULK_HOURS_TITLE =
  /工时回填|工时补录|对话估算合计|工时·对话/;

function shanghaiDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
}

function hoursBetween(startIso: string, endIso: string): number {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round(((b - a) / 3600000) * 10) / 10;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_\-·/\\（）()【】\[\]「」""'':：,.。!?！？]/g, "")
    .trim();
}

function titleMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  return false;
}

/** 中文/英文关键词重叠打分，≥2 才算命中 */
function overlapScore(a: string, b: string): number {
  const tokens = (s: string) => {
    const out = new Set<string>();
    const compact = norm(s);
    // 2–4 字滑动中文块
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= compact.length; i++) {
        const t = compact.slice(i, i + n);
        if (/[\u4e00-\u9fff]/.test(t)) out.add(t);
      }
    }
    for (const m of s.toLowerCase().match(/[a-z]{3,}/g) ?? []) out.add(m);
    return out;
  };
  const A = tokens(a);
  const B = tokens(b);
  let score = 0;
  for (const t of A) if (B.has(t)) score += t.length >= 3 ? 2 : 1;
  return score;
}

function bestReqByText(reqs: Requirement[], text: string): Requirement | null {
  let best: Requirement | null = null;
  let bestScore = 0;
  for (const r of reqs) {
    if (titleMatch(r.title, text)) return r;
    const s = overlapScore(r.title, text);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return bestScore >= 4 ? best : null;
}

function pickPeriod(
  periods: PeriodDef[],
  day: string,
  haystack: string
): PeriodDef {
  // 逻辑小版本关键词优先（不受导入日干扰）
  const keywordHits = periods.filter((p) => {
    if (!p.keywords?.length) return false;
    if (p.keywordFrom && day < p.keywordFrom) return false;
    if (p.name.includes("八字") && /紫微/.test(haystack)) return false;
    return p.keywords.some((k) => haystack.includes(k));
  });
  if (keywordHits.length) {
    return keywordHits.sort((a, b) => b.start.localeCompare(a.start))[0]!;
  }

  // 标题里的显式版本（CHANGELOG 导入常带 v0.2.x，但 submitted_at 是导入日）
  const ver = haystack.match(/\bv?(\d+)\.(\d+)(?:\.\d+)?\b/);
  if (ver) {
    const minorKey = `v${ver[1]}.${ver[2]}`;
    const byTag = periods.find(
      (p) =>
        !p.keywordOnly &&
        (p.release_tag === minorKey ||
          p.release_tag.startsWith(minorKey) ||
          p.name === minorKey ||
          p.name.startsWith(minorKey + "·"))
    );
    if (byTag) return byTag;
    if (ver[1] === "0" && Number(ver[2]) < 2) {
      const earliest = periods
        .filter((p) => !p.keywordOnly)
        .sort((a, b) => a.start.localeCompare(b.start))[0];
      if (earliest) return earliest;
    }
  }

  const byDate = periods.filter((p) => {
    if (p.keywordOnly) return false;
    if (day < p.start) return false;
    if (p.end && day >= p.end) return false;
    return true;
  });
  if (byDate.length) {
    return byDate.sort((a, b) => b.start.localeCompare(a.start))[0]!;
  }
  return periods.filter((p) => !p.keywordOnly).slice(-1)[0] ?? periods[periods.length - 1]!;
}

async function resolvePmProject(studioOrSlug: string) {
  const ctx = await resolveProjectRoute(studioOrSlug);
  const pmAll = await getProjects();
  const pm =
    (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
    pmAll.find((p) => p.id === studioOrSlug) ||
    pmAll.find((p) => p.slug === studioOrSlug) ||
    (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);
  if (!pm) throw new Error(`找不到 PM 项目：${studioOrSlug}`);
  return { pm, studioId: ctx.studio?.id ?? (studioOrSlug.startsWith("proj-") ? studioOrSlug : null) };
}

function firstProposalIso(
  req: Requirement,
  ideasById: Map<string, Idea>
): string {
  const candidates: string[] = [];
  if (req.submitted_at) candidates.push(req.submitted_at);
  if (req.created_at) candidates.push(req.created_at);
  if (req.studio_idea_id) {
    const idea = ideasById.get(req.studio_idea_id);
    if (idea?.occurredAt) candidates.push(idea.occurredAt);
    if (idea?.createdAt) candidates.push(idea.createdAt);
  }
  candidates.sort();
  return candidates[0] ?? req.created_at;
}

export type AlignResult = {
  projectId: string;
  pmSlug: string;
  periodsCreated: Array<{ id: string; name: string; release_tag: string | null }>;
  periodsReused: Array<{ id: string; name: string }>;
  /** 实际改写 iteration_id 的条数；assignIterations=false 时为 0 */
  requirementsAssigned: number;
  /** 仅建议归期（未写库）条数 */
  requirementsSuggested: number;
  hoursFilled: number;
  hoursSkippedNoEvidence: number;
  bulkEvolutionsCleared: number;
  attributedEvolutionsCleared: number;
  assignIterations: boolean;
  preview: Array<{ title: string; period: string; hours: number | null }>;
};

export async function alignProjectPeriodsAndHours(
  projectId: string,
  opts?: {
    dryRun?: boolean;
    fillHours?: boolean;
    clearAttributedWork?: boolean;
    /** 默认 false：只建议归期，不覆盖已有 iteration_id */
    assignIterations?: boolean;
  }
): Promise<AlignResult> {
  const dryRun = opts?.dryRun === true;
  const fillHours = opts?.fillHours !== false;
  const assignIterations = opts?.assignIterations === true;
  const { pm, studioId } = await resolvePmProject(projectId);

  const periods =
    (studioId && PERIODS_BY_STUDIO[studioId]) ||
    PERIODS_BY_STUDIO[projectId] ||
    defaultPeriodsForProject(pm.name);

  const { readDb } = await import("@/lib/db/local-store");
  const db = await readDb();
  const existingIters = db.iterations.filter(
    (i) => i.project_id === pm.id && i.name !== "需求池"
  );

  const periodIdByName = new Map<string, string>();
  const periodsCreated: AlignResult["periodsCreated"] = [];
  const periodsReused: AlignResult["periodsReused"] = [];

  for (const def of periods) {
    const found = existingIters.find(
      (i) => i.name === def.name || i.release_tag === def.release_tag
    );
    if (found) {
      periodIdByName.set(def.name, found.id);
      periodsReused.push({ id: found.id, name: found.name });
      if (
        !dryRun &&
        (found.release_tag !== def.release_tag ||
          found.start_date !== def.start ||
          found.end_date !== def.end)
      ) {
        const { updatePlanningIteration } = await import("@/lib/db/local-store");
        await updatePlanningIteration(found.id, {
          release_tag: def.release_tag,
          start_date: def.start,
          end_date: def.end,
        });
      }
      continue;
    }
    if (dryRun) {
      periodIdByName.set(def.name, `dry-${def.name}`);
      periodsCreated.push({
        id: `dry-${def.name}`,
        name: def.name,
        release_tag: def.release_tag,
      });
      continue;
    }
    const created = await createPlanningIteration({
      projectId: pm.id,
      name: def.name,
      start_date: def.start,
      end_date: def.end,
      release_tag: def.release_tag,
    });
    periodIdByName.set(def.name, created.id);
    periodsCreated.push({
      id: created.id,
      name: created.name,
      release_tag: created.release_tag,
    });
  }

  const ideas = studioId ? await getProjectIdeas(studioId) : [];
  const ideasById = new Map(ideas.map((i) => [i.id, i]));
  const allEvos = studioId ? await getAllEvolutionLogs() : [];
  const evolutions = studioId
    ? allEvos.filter((e) => e.projectId === studioId)
    : [];
  const sessions = studioId ? await getProjectChangeSessions(studioId) : [];
  const tasks = studioId ? await getProjectTasks(studioId) : [];

  const reqs = db.requirements.filter((r) => r.project_id === pm.id);
  let requirementsAssigned = 0;
  let requirementsSuggested = 0;
  let hoursFilled = 0;
  let hoursSkippedNoEvidence = 0;
  const preview: AlignResult["preview"] = [];
  const attributedEvoIds = new Set<string>();
  const dirtyReqs: Requirement[] = [];

  // Precompute session hours by requirementId / fuzzy title
  const hoursByReqId = new Map<string, number>();
  function addHours(reqId: string, h: number) {
    if (h <= 0) return;
    hoursByReqId.set(reqId, Math.round(((hoursByReqId.get(reqId) ?? 0) + h) * 10) / 10);
  }

  for (const s of sessions as ChangeSession[]) {
    if (!s.finishedAt || !s.createdAt) continue;
    const h = hoursBetween(s.createdAt, s.finishedAt);
    if (h <= 0) continue;
    if (s.requirementId) {
      addHours(s.requirementId, h);
      continue;
    }
    const blob = [s.goal, s.reason, s.result, ...(s.doneItems ?? []), ...(s.aiOps ?? [])]
      .filter(Boolean)
      .join(" ");
    const hit = bestReqByText(reqs, blob);
    if (hit) addHours(hit.id, h);
  }

  for (const e of evolutions as EvolutionLog[]) {
    if (BULK_HOURS_TITLE.test(e.title ?? "")) continue;
    if (!e.workStartedAt || !e.workFinishedAt) continue;
    const h = hoursBetween(e.workStartedAt, e.workFinishedAt);
    if (h <= 0) continue;
    const blob = `${e.title} ${e.module ?? ""} ${e.after ?? ""} ${e.decision ?? ""}`;
    const hit = bestReqByText(reqs, blob);
    if (hit) {
      addHours(hit.id, h);
      attributedEvoIds.add(e.id);
    }
  }

  // Studio 任务上已写的 estimate/actual（有数才写）
  for (const t of tasks) {
    const h = t.actualHours ?? t.estimateHours;
    if (h == null || !(h > 0)) continue;
    const hit = bestReqByText(reqs, t.title);
    if (hit) addHours(hit.id, h);
  }

  const stamp = new Date().toISOString();
  for (const req of reqs) {
    if (requirementIsCancelled(req) || req.force_closed) continue;
    const proposal = firstProposalIso(req, ideasById);
    const day = shanghaiDay(proposal) ?? "2026-07-21";
    const haystack = `${req.title} ${req.detail_work ?? ""} ${req.sub_function ?? ""}`;
    const period = pickPeriod(periods, day, haystack);
    const iterId = periodIdByName.get(period.name);
    if (!iterId || String(iterId).startsWith("dry-")) {
      if (preview.length < 40) {
        preview.push({ title: req.title, period: period.name, hours: null });
      }
      continue;
    }

    let changed = false;
    if (req.iteration_id !== iterId) {
      requirementsSuggested += 1;
      if (assignIterations) {
        requirementsAssigned += 1;
        if (!dryRun) {
          req.iteration_id = iterId;
          req.updated_at = stamp;
          changed = true;
        }
      }
    }

    let hours: number | null = null;
    if (fillHours && isLeafRequirement(req, reqs)) {
      const evidence = hoursByReqId.get(req.id);
      const already = req.product_estimate_hours;
      if (evidence != null && evidence > 0) {
        hours = evidence;
        if (already == null || already !== evidence) {
          hoursFilled += 1;
          if (!dryRun) {
            req.product_estimate_hours = evidence;
            req.updated_at = stamp;
            changed = true;
          }
        }
      } else if (
        already == null &&
        (requirementIsDone(req) || req.status === "in_progress")
      ) {
        hoursSkippedNoEvidence += 1;
      }
    }

    if (changed) dirtyReqs.push(req);

    if (preview.length < 40) {
      preview.push({
        title: req.title,
        period: period.name,
        hours:
          hours ??
          req.product_estimate_hours ??
          (isLeafRequirement(req, reqs) ? hoursByReqId.get(req.id) ?? null : null),
      });
    }
  }

  if (!dryRun && dirtyReqs.length) {
    const { upsertRequirementRow } = await import("@/lib/db/supabase-store");
    const { isSupabaseConfigured } = await import("@/lib/supabase/config");
    if (isSupabaseConfigured()) {
      const chunk = 25;
      for (let i = 0; i < dirtyReqs.length; i += chunk) {
        const slice = dirtyReqs.slice(i, i + chunk);
        await Promise.all(slice.map((r) => upsertRequirementRow(r)));
      }
    } else {
      for (const r of dirtyReqs) {
        await updateRequirement(
          r.id,
          {
            iteration_id: r.iteration_id,
            product_estimate_hours: r.product_estimate_hours,
          },
          { name: AGENT_ACTOR_NAME, role: "ai" }
        );
      }
    }
  }

  let bulkEvolutionsCleared = 0;
  let attributedEvolutionsCleared = 0;
  // 默认不清空演进工时：概况「消耗」仍走对话起止；预计改走需求叶子，已防双计。
  // 仅当显式 clearAttributedWork 时清空已归因演进的起止。
  if (fillHours && !dryRun && opts?.clearAttributedWork) {
    for (const e of evolutions as EvolutionLog[]) {
      const isBulk = BULK_HOURS_TITLE.test(e.title ?? "");
      const isAttributed = attributedEvoIds.has(e.id);
      if (!isBulk && !isAttributed) continue;
      if (!e.workStartedAt && !e.workFinishedAt) continue;
      await updateStudioEvolution(e.id, {
        workStartedAt: null,
        workFinishedAt: null,
        after:
          (e.after ?? "") +
          (isBulk
            ? "\n【工时已拆到需求叶子 product_estimate_hours，汇总演进起止已清空防双计】"
            : "\n【工时已归因到匹配需求，演进起止已清空防双计】"),
      });
      if (isBulk) bulkEvolutionsCleared += 1;
      else attributedEvolutionsCleared += 1;
    }
  }

  return {
    projectId: studioId ?? projectId,
    pmSlug: pm.slug,
    periodsCreated,
    periodsReused,
    requirementsAssigned,
    requirementsSuggested,
    hoursFilled,
    hoursSkippedNoEvidence,
    bulkEvolutionsCleared,
    attributedEvolutionsCleared,
    assignIterations,
    preview,
  };
}

export async function alignAllActiveProjects(opts?: {
  dryRun?: boolean;
  fillHours?: boolean;
  assignIterations?: boolean;
  projectIds?: string[];
}): Promise<AlignResult[]> {
  const ids =
    opts?.projectIds ??
    [
      "proj-star-pm",
      "proj-moonpie",
      "proj-02c0940a",
      "proj-3e2817ff",
      "proj-ai-pet",
      "proj-d86aa868",
      "proj-1121a3da",
      "proj-star-lab-os",
      "proj-personal-tools",
      "proj-ai-controller",
      "proj-c84ff6fa",
    ];
  const out: AlignResult[] = [];
  for (const id of ids) {
    try {
      out.push(await alignProjectPeriodsAndHours(id, opts));
    } catch (e) {
      out.push({
        projectId: id,
        pmSlug: "?",
        periodsCreated: [],
        periodsReused: [],
        requirementsAssigned: 0,
        requirementsSuggested: 0,
        hoursFilled: 0,
        hoursSkippedNoEvidence: 0,
        bulkEvolutionsCleared: 0,
        attributedEvolutionsCleared: 0,
        assignIterations: opts?.assignIterations === true,
        preview: [
          {
            title: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
            period: "-",
            hours: null,
          },
        ],
      });
    }
  }
  return out;
}
