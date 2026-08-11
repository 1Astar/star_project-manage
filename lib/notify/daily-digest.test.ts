import assert from "node:assert/strict";
import {
  formatDailyDigestMarkdown,
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

{
  const sections: DailyDigestSections = {
    todayDay: "2026-08-11",
    hubHref: "https://pm.starry-studio.cn/?focus=pm-today",
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

  const { title, content, total } = formatDailyDigestMarkdown(sections);
  assert.equal(total, 4);
  assert.match(title, /日报（4）/);
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
  assert.match(
    content,
    /\[打开今日要做\]\(https:\/\/pm\.starry-studio\.cn\/\?focus=pm-today\)/,
  );
}

{
  const empty = formatDailyDigestMarkdown({
    todayDay: "2026-08-11",
    hubHref: "https://pm.starry-studio.cn/?focus=pm-today",
    acceptance: [],
    gitSync: [],
    todayTodos: [],
    yesterdayOpen: [],
  });
  assert.equal(empty.total, 0);
  assert.match(empty.title, /暂无待办/);
}

console.log("lib/notify/daily-digest.test.ts ok");
