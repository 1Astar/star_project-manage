import { sendPushPlus } from "@/lib/notify/pushplus";
import { absoluteAppUrl, resolveSiteBaseUrl } from "@/lib/notify/site-url";
import { pushDailyWorkbenchDigest } from "@/lib/notify/daily-digest";
import { updateChangeSession } from "@/lib/studio/mutations";
import type { ChangeSession } from "@/lib/studio/types";
import { readDb, writeDb } from "@/lib/db/local-store";
import {
  normalizeModulePath,
  UNCATEGORIZED_MODULE,
  type PmAcceptanceBundle,
} from "@/lib/workbench/acceptance-bundles";
import type { PmAcceptanceItem } from "@/lib/workbench/pm-inbox";

/** A=提醒 · B=用户明确免验 · C=小修/bug/文档/skill 可自动过 */
export type AcceptancePolicy = "remind" | "auto_pass_small" | "user_waived";

const SMALL_FIX_RE =
  /bug|修复|修了|小修|hotfix|typo|错别字|文案微调|样式微调|拼写|热修|小优化|polish|changelog|文档|readme|skill|SKILL\.md|规则微调|注释|格式化|lint/i;

export function looksLikeSmallFix(text: string): boolean {
  return SMALL_FIX_RE.test(text);
}

export function resolveAcceptancePolicy(input: {
  policy?: AcceptancePolicy | null;
  goal: string;
  result?: string;
  module?: string;
  pendingItems?: string[];
}): { policy: AcceptancePolicy; autoPass: boolean; reason: string } {
  if (input.policy === "user_waived") {
    return {
      policy: "user_waived",
      autoPass: true,
      reason: "用户明确免验 / 直接过",
    };
  }
  if (input.policy === "auto_pass_small") {
    return {
      policy: "auto_pass_small",
      autoPass: true,
      reason: "声明为小修/bug/文档/skill 自动验收",
    };
  }
  if (input.policy === "remind") {
    return { policy: "remind", autoPass: false, reason: "显式要求提醒验收" };
  }

  const pending = input.pendingItems ?? [];
  const blob = [input.goal, input.result ?? "", input.module ?? ""].join(" ");
  if (pending.length === 0 && looksLikeSmallFix(blob)) {
    return {
      policy: "auto_pass_small",
      autoPass: true,
      reason: "启发式：小修/文档/skill 且无未完成项 → 自动验收",
    };
  }

  return {
    policy: "remind",
    autoPass: false,
    reason: "默认：进入待验清单并提醒，需人手点通过",
  };
}

async function addAcceptanceNotification(
  session: ChangeSession,
  autoPass: boolean,
  module: string,
  projectTitle: string
) {
  try {
    const db = await readDb();
    const { getPmSlugForStudioProject } = await import("@/lib/project-bridge");
    const { getProjectById } = await import("@/lib/studio/data");
    const studio = await getProjectById(session.projectId);
    const slug = studio
      ? getPmSlugForStudioProject(studio)
      : `studio-${session.projectId}`;
    const pm =
      db.projects.find((p) => p.slug === slug) ||
      db.projects.find((p) => p.id === session.projectId) ||
      (await import("@/lib/project-bridge").then(({ findPmProjectForStudio }) =>
        findPmProjectForStudio(session.projectId, db.projects)
      ));
    const projectId = pm?.id ?? db.projects[0]?.id;
    if (!projectId) return;

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID().slice(0, 12)}`,
      project_id: projectId,
      recipient_name: null,
      type: autoPass ? "acceptance_auto_passed" : "acceptance_pending",
      title: autoPass
        ? `已自动验收：${projectTitle} / ${module}`
        : `待你验收：${projectTitle} / ${module}`,
      body: `chg:${session.id}`,
      link: `/?focus=pm-today`,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    await writeDb(db);
  } catch {
    // non-fatal
  }
}

/** 单会话兜底明细（尚无汇总包时） */
export function formatSessionAcceptanceLines(session: ChangeSession): string[] {
  const why = [session.goal, session.reason].filter(Boolean).join(" — ");
  const expected = (session.expected ?? []).filter(Boolean);
  return [
    `为何：${why || session.goal || "（未写）"}`,
    `结果：${session.result?.trim() || "（未写 result）"}`,
    expected.length
      ? ["怎么验：", ...expected.slice(0, 5).map((e, i) => `${i + 1}. ${e}`)].join("\n")
      : "怎么验：（未写 expected）",
  ];
}

function formatItemLine(item: PmAcceptanceItem, index: number): string {
  const tag = item.source === "formal" ? "正式" : "会话";
  const note = item.note ? ` · ${item.note}` : "";
  return `${index + 1}. [${tag}] ${item.title}${note}`;
}

/**
 * 按板块汇总推送正文：为何 / 结果 / 怎么验 + 明细列表。
 * 每个板块一条内容（可含多条会话/需求）。
 */
export function formatModuleAcceptancePush(input: {
  projectTitle: string;
  module: string;
  bundle?: PmAcceptanceBundle | null;
  /** 刚收工的会话，用于兜底或标「本轮」 */
  session?: ChangeSession | null;
  workbenchUrl: string;
  evolutionUrl?: string;
  policyReason?: string;
  autoPass?: boolean;
}): { title: string; content: string } {
  const module = normalizeModulePath(input.module);
  const bundle = input.bundle;
  const n = bundle?.itemCount ?? 1;
  const title = input.autoPass
    ? `Star PM · 已自动验收：${input.projectTitle} / ${module}`
    : `Star PM · 待你验收：${input.projectTitle} / ${module}（${n}项）`;

  const why = bundle?.why || (input.session
    ? [input.session.goal, input.session.reason].filter(Boolean).join(" — ")
    : "");
  const result =
    bundle?.result ||
    input.session?.result?.trim() ||
    "（待过目）";
  const how =
    bundle?.howToVerify?.length
      ? bundle.howToVerify
      : (input.session?.expected ?? []).filter(Boolean).slice(0, 5);

  const detailLines =
    bundle?.items?.length
      ? bundle.items.map((it, i) => formatItemLine(it, i))
      : input.session
        ? [`1. [会话] ${input.session.goal}`]
        : [];

  const contentPretty = [
    `【${input.projectTitle} · ${module}】共 ${n} 项待验`,
    "",
    `为何：${why || "（未写）"}`,
    `结果：${result}`,
    how.length
      ? ["怎么验：", ...how.map((e, i) => `${i + 1}. ${e}`)].join("\n")
      : "怎么验：（未写）",
    "",
    "明细：",
    ...detailLines.slice(0, 12),
    ...(detailLines.length > 12 ? [`…另有 ${detailLines.length - 12} 项`] : []),
    ...(module === UNCATEGORIZED_MODULE ? ["⚠ 缺板块，请补 module"] : []),
    ...(input.policyReason ? [`策略：${input.policyReason}`] : []),
    "",
    `工作台：${input.workbenchUrl}`,
    ...(input.evolutionUrl ? [`演进：${input.evolutionUrl}`] : []),
  ].join("\n");

  return { title, content: contentPretty };
}

/**
 * After finish_change_session: apply A/B/C + 站内通知。
 * **不发 PushPlus**（用户约定：日常收工不推，发版时再汇总推）。
 * 待验仍进工作台「待你验收」按项目×板块汇总。
 */
export async function applyAcceptanceAfterFinish(input: {
  session: ChangeSession;
  policy?: AcceptancePolicy | null;
  siteBaseUrl?: string | null;
}): Promise<{
  session: ChangeSession;
  policy: AcceptancePolicy;
  autoPass: boolean;
  reason: string;
  push: Awaited<ReturnType<typeof sendPushPlus>>;
}> {
  const resolved = resolveAcceptancePolicy({
    policy: input.policy,
    goal: input.session.goal,
    result: input.session.result,
    module: input.session.module,
    pendingItems: input.session.pendingItems,
  });

  let session = input.session;
  if (resolved.autoPass && session.humanAcceptance === "unreviewed") {
    session = await updateChangeSession(session.id, {
      humanAcceptance: "passed",
    });
  }

  const module = normalizeModulePath(session.module);
  let projectTitle = "项目";
  try {
    const { getProjectById } = await import("@/lib/studio/data");
    const p = await getProjectById(session.projectId);
    if (p?.title) projectTitle = p.title;
  } catch {
    // ignore
  }

  await addAcceptanceNotification(session, resolved.autoPass, module, projectTitle);

  return {
    session,
    policy: resolved.policy,
    autoPass: resolved.autoPass,
    reason: resolved.reason,
    push: {
      ok: true,
      skipped: true,
      reason: "收工不推送；发版 publish_release 时再汇总 PushPlus",
    },
  };
}

/**
 * 发版成功后汇总推送：本版板块 + 发布说明摘要 + 工作台/Release 链接。
 * draft 发版默认不推（可 force）。
 */
export function formatReleaseSummaryPush(input: {
  projectTitle: string;
  tag: string;
  modules: string[];
  releaseName?: string;
  bodyPreview?: string;
  githubUrl?: string;
  workbenchUrl: string;
  draft?: boolean;
}): { title: string; content: string } {
  const tag = input.tag.trim();
  const title = `Star PM · 已发版：${input.projectTitle} ${tag}`;
  const mods = input.modules.filter(Boolean);
  const preview = (input.bodyPreview ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .slice(0, 24)
    .join("\n");

  const content = [
    `【${input.projectTitle}】${input.releaseName || tag}`,
    input.draft ? "（draft，未正式推送渠道也记一笔）" : "",
    "",
    mods.length ? `本版板块：${mods.join("、")}` : "本版板块：（未挂 module 的演进未计入）",
    "",
    preview ? ["发布说明摘要：", preview].join("\n") : "发布说明：（空）",
    "",
    `工作台：${input.workbenchUrl}`,
    ...(input.githubUrl ? [`Release：${input.githubUrl}`] : []),
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { title, content };
}

export async function pushReleaseSummary(input: {
  projectTitle: string;
  tag: string;
  modules: string[];
  releaseName?: string;
  bodyPreview?: string;
  githubUrl?: string;
  siteBaseUrl?: string | null;
  draft?: boolean;
  /** draft 默认不推；true 时 draft 也推 */
  force?: boolean;
}): Promise<Awaited<ReturnType<typeof sendPushPlus>>> {
  if (input.draft && !input.force) {
    return {
      ok: true,
      skipped: true,
      reason: "draft 发版默认不推送汇总",
    };
  }
  const base = resolveSiteBaseUrl(input.siteBaseUrl);
  const workbenchUrl = absoluteAppUrl(base, "/?focus=pm-today");
  const formatted = formatReleaseSummaryPush({
    projectTitle: input.projectTitle,
    tag: input.tag,
    modules: input.modules,
    releaseName: input.releaseName,
    bodyPreview: input.bodyPreview,
    githubUrl: input.githubUrl,
    workbenchUrl,
    draft: input.draft,
  });
  return sendPushPlus(formatted);
}

/** @deprecated 使用 pushDailyWorkbenchDigest；保留别名给旧 cron */
export async function pushAcceptanceDigest(): Promise<{
  sent: boolean;
  count: number;
  push: Awaited<ReturnType<typeof sendPushPlus>>;
}> {
  const result = await pushDailyWorkbenchDigest({ pushEmpty: false });
  return {
    sent: result.sent,
    count: result.total,
    push: result.push,
  };
}
