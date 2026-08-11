/**
 * 每日工作台 PushPlus 综合摘要：
 * Git 同步建议 · 待验收 · 今日待办 · 昨日未完成（带可点页面链接）
 */
import { getTodayFocus } from "@/lib/studio/data";
import { listPendingGitSyncSuggestions } from "@/lib/mcp/suggest-from-commits";
import {
  filterTomorrowDueOnly,
  getOpenBugsAcrossProjects,
  getPmAcceptanceQueue,
  getPmFollowUps,
} from "@/lib/workbench/pm-inbox";
import { getTomorrowAgenda } from "@/lib/workbench/tomorrow-agenda";
import { sendPushPlus } from "@/lib/notify/pushplus";
import { absoluteAppUrl, resolveSiteBaseUrl } from "@/lib/notify/site-url";

const MAX_PER_SECTION = 8;

export type DigestLine = {
  title: string;
  meta?: string;
  href?: string | null;
  externalHref?: string | null;
};

export type DailyDigestSections = {
  todayDay: string;
  acceptance: DigestLine[];
  gitSync: DigestLine[];
  todayTodos: DigestLine[];
  yesterdayOpen: DigestLine[];
  hubHref: string;
};

export function resolveSiteBaseUrlForDigest(siteBaseUrl?: string | null): string {
  return resolveSiteBaseUrl(siteBaseUrl);
}

function abs(base: string, href?: string | null): string | undefined {
  if (!href) return undefined;
  return absoluteAppUrl(base, href) || undefined;
}

function mdLink(label: string, url?: string | null): string {
  const t = label.replace(/[\[\]]/g, "").trim() || "打开";
  if (!url) return t;
  return `[${t}](${url})`;
}

function formatSection(
  heading: string,
  lines: DigestLine[],
  emptyHint: string,
): string {
  if (!lines.length) return `## ${heading}\n（${emptyHint}）`;
  const body = lines
    .map((line, i) => {
      const head = `${i + 1}. ${mdLink(line.title, line.href)}`;
      const bits = [
        line.meta ? `　${line.meta}` : "",
        line.externalHref ? `　${mdLink("提交", line.externalHref)}` : "",
      ]
        .filter(Boolean)
        .join("");
      return `${head}${bits}`;
    })
    .join("\n");
  return `## ${heading}\n${body}`;
}

/** 纯函数：把各块数据排成 Markdown（便于单测） */
export function formatDailyDigestMarkdown(sections: DailyDigestSections): {
  title: string;
  content: string;
  total: number;
} {
  const total =
    sections.acceptance.length +
    sections.gitSync.length +
    sections.todayTodos.length +
    sections.yesterdayOpen.length;

  const title =
    total === 0
      ? `Star PM · ${sections.todayDay} 暂无待办`
      : `Star PM · ${sections.todayDay} 日报（${total}）`;

  const content = [
    formatSection("待你验收", sections.acceptance, "无"),
    formatSection("Git 同步建议", sections.gitSync, "无待确认"),
    formatSection("今日待办", sections.todayTodos, "无"),
    formatSection("昨天未完成", sections.yesterdayOpen, "无"),
    "",
    `工作台：${mdLink("打开今日要做", sections.hubHref)}`,
  ].join("\n\n");

  return { title, content, total };
}

export async function collectDailyDigestSections(opts?: {
  siteBaseUrl?: string | null;
  todayDay?: string;
}): Promise<DailyDigestSections> {
  const base = resolveSiteBaseUrlForDigest(opts?.siteBaseUrl);
  const todayDay = opts?.todayDay;
  const [
    acceptanceQ,
    followUps,
    git,
    focus,
    agenda,
    openBugs,
  ] = await Promise.all([
    getPmAcceptanceQueue({ todayDay }),
    getPmFollowUps({ todayDay }),
    listPendingGitSyncSuggestions({ limit: MAX_PER_SECTION }),
    getTodayFocus(),
    getTomorrowAgenda({ todayDay }),
    getOpenBugsAcrossProjects(),
  ]);

  const day = acceptanceQ.todayDay;
  const hubHref = abs(base, "/?focus=pm-today") || "/?focus=pm-today";

  const acceptance: DigestLine[] = acceptanceQ.items
    .slice(0, MAX_PER_SECTION)
    .map((i) => ({
      title: i.title,
      meta: `${i.projectTitle} · ${i.sourceLabel}${i.note ? ` · ${i.note}` : ""}`,
      href: abs(base, i.href),
    }));

  const gitSync: DigestLine[] = git.suggestions.slice(0, MAX_PER_SECTION).map((s) => {
    const reqHref =
      s.studio_project_id && s.requirement_id
        ? abs(
            base,
            `/projects/${s.studio_project_id}/requirements/${s.requirement_id}`,
          )
        : abs(base, "/?focus=pm-today");
    return {
      title: s.requirement_title || s.commit_message.slice(0, 40) || s.short_sha,
      meta: `${s.short_sha} · score ${s.score}`,
      href: reqHref,
      externalHref: s.commit_url || null,
    };
  });

  const todayTodos: DigestLine[] = [];
  if (focus?.project) {
    const next =
      focus.task?.title?.trim() ||
      focus.project.nextAction?.trim() ||
      focus.project.body?.nextStep?.trim() ||
      "";
    todayTodos.push({
      title: `主线 · ${focus.project.title}`,
      meta: next || "未写下一步",
      href: abs(base, `/projects/${focus.project.id}`),
    });
  }

  for (const b of followUps.items.filter((i) => i.kind === "blocker").slice(0, 4)) {
    todayTodos.push({
      title: b.title,
      meta: `${b.projectTitle} · 阻塞${b.note ? ` · ${b.note}` : ""}`,
      href: abs(base, b.href),
    });
  }

  for (const d of filterTomorrowDueOnly(agenda.items).slice(0, 4)) {
    todayTodos.push({
      title: d.title,
      meta: `${d.projectTitle} · ${d.reasonLabel}`,
      href: abs(base, d.href),
    });
  }

  for (const bug of openBugs.slice(0, 3)) {
    todayTodos.push({
      title: bug.title,
      meta: `${bug.projectTitle} · Bug · ${bug.statusLabel}`,
      href: abs(base, bug.href),
    });
  }

  const yesterdayOpen: DigestLine[] = followUps.items
    .filter((i) => i.kind === "yesterday_open")
    .slice(0, MAX_PER_SECTION)
    .map((i) => ({
      title: i.title,
      meta: `${i.projectTitle} · ${i.kindLabel}${i.note ? ` · ${i.note}` : ""}`,
      href: abs(base, i.href),
    }));

  return {
    todayDay: day,
    acceptance,
    gitSync,
    todayTodos: todayTodos.slice(0, MAX_PER_SECTION),
    yesterdayOpen,
    hubHref,
  };
}

/**
 * 每日综合推送。无任何条目时仍可发「暂无待办」短讯（便于确认 cron 活着）；
 * 若 pushEmpty=false 则跳过空日报。
 */
export async function pushDailyWorkbenchDigest(opts?: {
  siteBaseUrl?: string | null;
  todayDay?: string;
  pushEmpty?: boolean;
}): Promise<{
  sent: boolean;
  total: number;
  sections: DailyDigestSections;
  push: Awaited<ReturnType<typeof sendPushPlus>>;
}> {
  const sections = await collectDailyDigestSections(opts);
  const formatted = formatDailyDigestMarkdown(sections);
  if (formatted.total === 0 && opts?.pushEmpty === false) {
    return {
      sent: false,
      total: 0,
      sections,
      push: { ok: true, skipped: true, reason: "日报为空" },
    };
  }
  const push = await sendPushPlus({
    title: formatted.title,
    content: formatted.content,
    template: "markdown",
  });
  return {
    sent: push.ok && !("skipped" in push && push.skipped),
    total: formatted.total,
    sections,
    push,
  };
}
