import { sendPushPlus } from "@/lib/notify/pushplus";
import { updateChangeSession } from "@/lib/studio/mutations";
import type { ChangeSession } from "@/lib/studio/types";
import { readDb, writeDb } from "@/lib/db/local-store";
import { getPmAcceptanceQueue } from "@/lib/workbench/pm-inbox";

/** A=提醒 · B=用户明确免验 · C=小修/bug 可自动过 */
export type AcceptancePolicy = "remind" | "auto_pass_small" | "user_waived";

const SMALL_FIX_RE =
  /bug|修复|修了|小修|hotfix|typo|错别字|文案微调|样式微调|拼写|热修|小优化|polish/i;

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
      reason: "声明为小修/bug 自动验收",
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
      reason: "启发式：小修/bug 且无未完成项 → 自动验收",
    };
  }

  return {
    policy: "remind",
    autoPass: false,
    reason: "默认：进入待验清单并提醒，需人手点通过",
  };
}

async function addAcceptanceNotification(session: ChangeSession, autoPass: boolean) {
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
      db.projects.find((p) => p.id === session.projectId);
    const projectId = pm?.id ?? db.projects[0]?.id;
    if (!projectId) return;

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID().slice(0, 12)}`,
      project_id: projectId,
      recipient_name: null,
      type: autoPass ? "acceptance_auto_passed" : "acceptance_pending",
      title: autoPass
        ? `已自动验收：${session.goal.slice(0, 40)}`
        : `待你验收：${session.goal.slice(0, 40)}`,
      body: `chg:${session.id}`,
      link: `/projects/${session.projectId}/evolution`,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    await writeDb(db);
  } catch {
    // non-fatal
  }
}

/**
 * After finish_change_session: apply A/B/C + PushPlus + in-app notification.
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

  await addAcceptanceNotification(session, resolved.autoPass);

  const rawBase =
    input.siteBaseUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
      : "");
  const base = rawBase.replace(/\/$/, "");
  const link = base
    ? `${base}/projects/${session.projectId}/evolution`
    : `/projects/${session.projectId}/evolution`;

  const title = resolved.autoPass
    ? `Star PM · 已自动验收`
    : `Star PM · 待你验收`;
  const content = [
    session.goal,
    resolved.reason,
    session.result ? `结果：${session.result}` : "",
    `打开：${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const push = await sendPushPlus({ title, content });

  return {
    session,
    policy: resolved.policy,
    autoPass: resolved.autoPass,
    reason: resolved.reason,
    push,
  };
}

/** Daily digest of pending acceptance queue via PushPlus. */
export async function pushAcceptanceDigest(): Promise<{
  sent: boolean;
  count: number;
  push: Awaited<ReturnType<typeof sendPushPlus>>;
}> {
  const { items } = await getPmAcceptanceQueue();
  if (!items.length) {
    return {
      sent: false,
      count: 0,
      push: { ok: true, skipped: true, reason: "待验收为空" },
    };
  }
  const lines = items
    .slice(0, 12)
    .map((i, idx) => `${idx + 1}. [${i.sourceLabel}] ${i.title}`)
    .join("\n");
  const push = await sendPushPlus({
    title: `Star PM · 待验收 ${items.length} 项`,
    content: `${lines}${items.length > 12 ? `\n…共 ${items.length} 项` : ""}\n请打开工作台「待你验收」处理。`,
  });
  return { sent: push.ok && !("skipped" in push && push.skipped), count: items.length, push };
}
