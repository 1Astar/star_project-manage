/**
 * 每日工作台 PushPlus：
 * - 晚报两条：① 今日更新汇总 ② 待验收
 * - 收工/发版即时不推（进日总结）
 * - 旧版综合日报 / 早报格式（兼容）
 */
import { getScopedStudioSnapshot } from "@/lib/demo/ensure-showcase";
import {
  getAllChangeSessions,
  getAllEvolutionLogs,
  getAllProjects,
  getTodayFocus,
} from "@/lib/studio/data";
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

/** Asia/Shanghai 日历日 YYYY-MM-DD（避免依赖 mutations 大模块） */
function shanghaiDay(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type DigestLine = {
  title: string;
  meta?: string;
  href?: string | null;
  externalHref?: string | null;
};

export type DailyDigestSections = {
  todayDay: string;
  /** 今日已更新（收工会话 / 演进 / 发版） */
  updates: DigestLine[];
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 微信 PushPlus 用 HTML 锚点；并附裸 URL（客户端常只认明文 https） */
function htmlLink(label: string, url?: string | null): string {
  const t = esc(label.replace(/[\[\]]/g, "").trim() || "打开");
  if (!url) return t;
  const u = esc(url);
  return `<a href="${u}">${t}</a>`;
}

function formatSection(
  heading: string,
  lines: DigestLine[],
  emptyHint: string,
): string {
  if (!lines.length) {
    return `<h3>${esc(heading)}</h3><p>（${esc(emptyHint)}）</p>`;
  }
  const body = lines
    .map((line, i) => {
      const title = htmlLink(line.title, line.href);
      const meta = line.meta ? `<br/><span>${esc(line.meta)}</span>` : "";
      const ext = line.externalHref
        ? `<br/>${htmlLink("打开提交", line.externalHref)}`
        : "";
      const bare =
        line.href && /^https?:\/\//i.test(line.href)
          ? `<br/><span style="color:#666;font-size:12px;word-break:break-all;">${esc(line.href)}</span>`
          : "";
      return `<p>${i + 1}. ${title}${meta}${ext}${bare}</p>`;
    })
    .join("");
  return `<h3>${esc(heading)}</h3>${body}`;
}

function footerLink(label: string, href: string): string {
  if (!href) return `<p>${esc(label)}</p>`;
  return `<p>${htmlLink(label, href)}<br/><span style="color:#666;font-size:12px;word-break:break-all;">${esc(href)}</span></p>`;
}

function emptySectionsStub(): DailyDigestSections {
  return {
    todayDay: "",
    updates: [],
    acceptance: [],
    gitSync: [],
    todayTodos: [],
    yesterdayOpen: [],
    hubHref: "",
  };
}

/** 纯函数：把各块数据排成 Markdown（便于单测） */
export function formatDailyDigestMarkdown(sections: DailyDigestSections): {
  title: string;
  content: string;
  total: number;
} {
  const total =
    sections.updates.length +
    sections.acceptance.length +
    sections.gitSync.length +
    sections.todayTodos.length +
    sections.yesterdayOpen.length;

  const title =
    total === 0
      ? `Star PM · ${sections.todayDay} 暂无待办`
      : `Star PM · ${sections.todayDay} 日报（${total}）`;

  const content = [
    formatSection("今日更新", sections.updates, "无"),
    formatSection("待你验收", sections.acceptance, "无"),
    formatSection("Git 同步建议", sections.gitSync, "无待确认"),
    formatSection("今日待办", sections.todayTodos, "无"),
    formatSection("昨天未完成", sections.yesterdayOpen, "无"),
    footerLink("打开今日要做", sections.hubHref),
  ].join("");

  return { title, content, total };
}

/** 早报：今日要做 / 推荐（HTML 超链接；空则可不推） */
export function formatMorningDigestMarkdown(sections: DailyDigestSections): {
  title: string;
  content: string;
  total: number;
} {
  const total =
    sections.todayTodos.length +
    sections.yesterdayOpen.length +
    sections.gitSync.length;
  const title =
    total === 0
      ? `Star PM · ${sections.todayDay} 早报 · 暂无推荐`
      : `Star PM · ${sections.todayDay} 早报 · 今日要做（${total}）`;
  const content = [
    formatSection("今日要做 / 推荐", sections.todayTodos, "暂无，可打开工作台扫一眼"),
    formatSection("昨天未完成", sections.yesterdayOpen, "无"),
    formatSection("Git 同步建议", sections.gitSync, "无待确认"),
    footerLink("打开今日要做", sections.hubHref),
  ].join("");
  return { title, content, total };
}

/** 日报①：今日更新过的内容 */
export function formatUpdatesDigestMarkdown(sections: DailyDigestSections): {
  title: string;
  content: string;
  total: number;
} {
  const total = sections.updates.length;
  const title =
    total === 0
      ? `Star PM · ${sections.todayDay} · 今日暂无更新`
      : `Star PM · ${sections.todayDay} · 今日更新（${total}）`;
  const content = [
    formatSection("今日更新", sections.updates, "今天没有收工/演进/发版记录"),
    footerLink("打开工作台", sections.hubHref),
  ].join("");
  return { title, content, total };
}

/** 日报②：待验收汇总 */
export function formatEveningAcceptanceMarkdown(sections: DailyDigestSections): {
  title: string;
  content: string;
  total: number;
} {
  const total = sections.acceptance.length;
  const title =
    total === 0
      ? `Star PM · ${sections.todayDay} · 暂无待验收`
      : `Star PM · ${sections.todayDay} · 待你验收（${total}板块）`;
  const content = [
    formatSection("待你验收", sections.acceptance, "今天没有待验板块"),
    footerLink("打开待验收", sections.hubHref),
  ].join("");
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
    projects,
    sessions,
    evolutions,
    snapshot,
  ] = await Promise.all([
    getPmAcceptanceQueue({ todayDay }),
    getPmFollowUps({ todayDay }),
    listPendingGitSyncSuggestions({ limit: MAX_PER_SECTION }),
    getTodayFocus(),
    getTomorrowAgenda({ todayDay }),
    getOpenBugsAcrossProjects(),
    getAllProjects(),
    getAllChangeSessions(),
    getAllEvolutionLogs(),
    getScopedStudioSnapshot(),
  ]);

  const day = todayDay?.trim().slice(0, 10) || acceptanceQ.todayDay;
  const hubHref = abs(base, "/?focus=pm-today") || "/?focus=pm-today";
  const projectTitle = (id: string) =>
    projects.find((p) => p.id === id)?.title?.trim() || id;

  const updates: DigestLine[] = [];

  const finishedToday = sessions
    .filter((s) => {
      if (s.status !== "finished" && !s.finishedAt) return false;
      const d =
        s.day ||
        shanghaiDay(s.finishedAt) ||
        shanghaiDay(s.updatedAt) ||
        shanghaiDay(s.createdAt);
      return d === day;
    })
    .sort((a, b) =>
      (b.finishedAt || b.updatedAt).localeCompare(a.finishedAt || a.updatedAt),
    );

  for (const s of finishedToday.slice(0, MAX_PER_SECTION)) {
    const mod = s.module?.trim() || "未分板块";
    const result = (s.result || s.goal || "").trim();
    updates.push({
      title: `${projectTitle(s.projectId)} / ${mod}`,
      meta: result
        ? result.slice(0, 48) + (result.length > 48 ? "…" : "")
        : "变更会话已收工",
      href: abs(base, `/projects/${s.projectId}/evolution`),
    });
  }

  const evoToday = evolutions
    .filter((e) => shanghaiDay(e.createdAt) === day)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  for (const e of evoToday.slice(0, MAX_PER_SECTION)) {
    // 避免与同日会话完全重复：同项目同标题且已有会话行则跳过标题撞车；仍列出演进决策
    const title = `${projectTitle(e.projectId)} · ${e.title}`;
    if (updates.some((u) => u.title.startsWith(`${projectTitle(e.projectId)} /`) && u.meta?.includes(e.title))) {
      continue;
    }
    updates.push({
      title,
      meta: [e.module?.trim(), e.after?.trim() || e.decision?.trim()]
        .filter(Boolean)
        .map((t) => (t!.length > 40 ? `${t!.slice(0, 40)}…` : t))
        .join(" · ") || "演进",
      href: abs(base, `/projects/${e.projectId}/evolution`),
    });
  }

  const releases = snapshot.releases ?? [];
  const releaseToday = releases
    .filter((r) => r.publishedAt && shanghaiDay(r.publishedAt) === day)
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));

  for (const r of releaseToday.slice(0, 4)) {
    updates.push({
      title: `${projectTitle(r.projectId)} · 发版 ${r.tag}`,
      meta: r.name?.trim() || "Release",
      href: abs(base, `/projects/${r.projectId}`),
      externalHref: r.htmlUrl || null,
    });
  }

  const acceptance: DigestLine[] = acceptanceQ.bundles
    .slice(0, MAX_PER_SECTION)
    .map((b) => {
      const how = b.howToVerify.slice(0, 2).join("；");
      const metaParts = [
        `${b.itemCount} 项`,
        b.why.slice(0, 36) + (b.why.length > 36 ? "…" : ""),
        how ? `验：${how}` : null,
      ].filter(Boolean);
      return {
        title: `${b.projectTitle} / ${b.module}`,
        meta: metaParts.join(" · "),
        href: abs(base, "/?focus=pm-today"),
      };
    });

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
    updates: updates.slice(0, MAX_PER_SECTION + 4),
    acceptance,
    gitSync,
    todayTodos: todayTodos.slice(0, MAX_PER_SECTION),
    yesterdayOpen,
    hubHref,
  };
}

async function pushFormattedDigest(opts: {
  siteBaseUrl?: string | null;
  todayDay?: string;
  pushEmpty?: boolean;
  format: (sections: DailyDigestSections) => {
    title: string;
    content: string;
    total: number;
  };
  /** 复用已收集的 sections，避免双推时查库两次 */
  sections?: DailyDigestSections;
}): Promise<{
  sent: boolean;
  total: number;
  sections: DailyDigestSections;
  push: Awaited<ReturnType<typeof sendPushPlus>>;
}> {
  const sections = opts.sections ?? (await collectDailyDigestSections(opts));
  const formatted = opts.format(sections);
  if (formatted.total === 0 && opts.pushEmpty === false) {
    return {
      sent: false,
      total: 0,
      sections,
      push: { ok: true, skipped: true, reason: "摘要为空" },
    };
  }
  const push = await sendPushPlus({
    title: formatted.title,
    content: formatted.content,
    /** html + <a> 在微信里比 markdown 链接更稳 */
    template: "html",
  });
  return {
    sent: push.ok && !("skipped" in push && push.skipped),
    total: formatted.total,
    sections,
    push,
  };
}

/**
 * 每日综合推送（兼容旧 cron）。无任何条目时仍可发「暂无待办」短讯；
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
  return pushFormattedDigest({
    ...opts,
    format: formatDailyDigestMarkdown,
  });
}

/** 早报：今日要做 / 推荐（默认空则不推） */
export async function pushMorningWorkbenchDigest(opts?: {
  siteBaseUrl?: string | null;
  todayDay?: string;
  pushEmpty?: boolean;
}) {
  return pushFormattedDigest({
    siteBaseUrl: opts?.siteBaseUrl,
    todayDay: opts?.todayDay,
    pushEmpty: opts?.pushEmpty ?? false,
    format: formatMorningDigestMarkdown,
  });
}

/** 日报①：今日更新（默认空则不推） */
export async function pushDailyUpdatesDigest(opts?: {
  siteBaseUrl?: string | null;
  todayDay?: string;
  pushEmpty?: boolean;
  sections?: DailyDigestSections;
}) {
  return pushFormattedDigest({
    siteBaseUrl: opts?.siteBaseUrl,
    todayDay: opts?.todayDay,
    pushEmpty: opts?.pushEmpty ?? false,
    sections: opts?.sections,
    format: formatUpdatesDigestMarkdown,
  });
}

/** 日报②：待验收汇总（默认空则不推） */
export async function pushEveningAcceptanceDigest(opts?: {
  siteBaseUrl?: string | null;
  todayDay?: string;
  pushEmpty?: boolean;
  sections?: DailyDigestSections;
}) {
  return pushFormattedDigest({
    siteBaseUrl: opts?.siteBaseUrl,
    todayDay: opts?.todayDay,
    pushEmpty: opts?.pushEmpty ?? false,
    sections: opts?.sections,
    format: formatEveningAcceptanceMarkdown,
  });
}

/**
 * 晚报一次跑完：先推「今日更新」，再推「待验收」（两条独立 PushPlus）。
 * 空的那条默认跳过。
 */
export async function pushEveningDailySummaries(opts?: {
  siteBaseUrl?: string | null;
  todayDay?: string;
  pushEmpty?: boolean;
}): Promise<{
  sections: DailyDigestSections;
  updates: Awaited<ReturnType<typeof pushDailyUpdatesDigest>>;
  acceptance: Awaited<ReturnType<typeof pushEveningAcceptanceDigest>>;
}> {
  const sections = await collectDailyDigestSections(opts);
  const pushEmpty = opts?.pushEmpty ?? false;
  const updates = await pushDailyUpdatesDigest({
    ...opts,
    pushEmpty,
    sections,
  });
  const acceptance = await pushEveningAcceptanceDigest({
    ...opts,
    pushEmpty,
    sections,
  });
  return { sections, updates, acceptance };
}

export { emptySectionsStub };
