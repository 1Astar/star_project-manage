import assert from "node:assert/strict";
import {
  formatDailyDigestMarkdown,
  formatEveningAcceptanceMarkdown,
  formatMorningDigestMarkdown,
  formatUpdatesDigestMarkdown,
  type DailyDigestSections,
} from "@/lib/notify/daily-digest";
import { absoluteAppUrl, resolveSiteBaseUrl } from "@/lib/notify/site-url";

{
  const base = resolveSiteBaseUrl("https://pm.starry-studio.cn/");
  assert.equal(base, "https://pm.starry-studio.cn");
  assert.equal(
    absoluteAppUrl(base, "/?focus=pm-today"),
    "https://pm.starry-studio.cn/?focus=pm-today",
  );
  assert.equal(
    absoluteAppUrl(base, "https://github.com/x/y/commit/abc"),
    "https://github.com/x/y/commit/abc",
  );
}

const sample: DailyDigestSections = {
  todayDay: "2026-08-11",
  hubHref: "https://pm.starry-studio.cn/?focus=pm-today",
  updates: [
    {
      title: "Star PM / 工作台·通知",
      meta: "早晚报改日总结",
      href: "https://pm.starry-studio.cn/projects/proj-star-pm/evolution",
    },
  ],
  acceptance: [
    {
      title: "验收 PushPlus 日报",
      meta: "Star PM · 变更会话",
      href: "https://pm.starry-studio.cn/projects/proj-star-pm/evolution",
    },
  ],
  gitSync: [
    {
      title: "需求：备份扩容",
      meta: "abc1234 · score 8",
      href: "https://pm.starry-studio.cn/projects/proj-star-pm/requirements/req-1",
      externalHref: "https://github.com/org/repo/commit/abc1234",
    },
  ],
  todayTodos: [
    {
      title: "主线 · Star PM",
      meta: "做日报推送",
      href: "https://pm.starry-studio.cn/projects/proj-star-pm",
    },
  ],
  yesterdayOpen: [
    {
      title: "昨日未勾完项",
      meta: "Star PM · 昨日变更 · 未完",
      href: "https://pm.starry-studio.cn/projects/proj-star-pm/tasks?view=studio",
    },
  ],
};

{
  const { title, content, total } = formatDailyDigestMarkdown(sample);
  assert.equal(total, 5);
  assert.match(title, /日报（5）/);
  assert.match(content, /## 今日更新/);
  assert.match(content, /## 待你验收/);
  assert.match(content, /## Git 同步建议/);
  assert.match(content, /## 今日待办/);
  assert.match(content, /## 昨天未完成/);
  assert.match(
    content,
    /\[验收 PushPlus 日报\]\(https:\/\/pm\.starry-studio\.cn\/projects\/proj-star-pm\/evolution\)/,
  );
  assert.match(
    content,
    /\[提交\]\(https:\/\/github\.com\/org\/repo\/commit\/abc1234\)/,
  );
}

{
  const empty = formatDailyDigestMarkdown({
    todayDay: "2026-08-11",
    hubHref: "https://pm.starry-studio.cn/?focus=pm-today",
    updates: [],
    acceptance: [],
    gitSync: [],
    todayTodos: [],
    yesterdayOpen: [],
  });
  assert.equal(empty.total, 0);
  assert.match(empty.title, /暂无待办/);
}

{
  const updates = formatUpdatesDigestMarkdown(sample);
  assert.equal(updates.total, 1);
  assert.match(updates.title, /今日更新（1）/);
  assert.match(updates.content, /## 今日更新/);
  assert.doesNotMatch(updates.content, /待你验收/);
}

{
  const morning = formatMorningDigestMarkdown({
    ...sample,
    todayDay: "2026-08-12",
    acceptance: [{ title: "不应出现在早报", href: null }],
    updates: [],
    gitSync: [],
    yesterdayOpen: [],
  });
  assert.equal(morning.total, 1);
  assert.match(morning.title, /早报 · 今日要做/);
  assert.match(morning.content, /今日要做 \/ 推荐/);
  assert.doesNotMatch(morning.content, /不应出现在早报/);
}

{
  const evening = formatEveningAcceptanceMarkdown({
    ...sample,
    todayDay: "2026-08-12",
    gitSync: [{ title: "不应出现在晚报", href: null }],
    todayTodos: [],
    yesterdayOpen: [],
    updates: [{ title: "不应出现在验收条", href: null }],
  });
  assert.equal(evening.total, 1);
  assert.match(evening.title, /待你验收/);
  assert.match(evening.content, /待你验收/);
  assert.doesNotMatch(evening.content, /不应出现在晚报/);
  assert.doesNotMatch(evening.content, /不应出现在验收条/);
}

console.log("lib/notify/daily-digest.test.ts ok");
