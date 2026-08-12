import assert from "node:assert/strict";
import {
  formatReleaseSummaryPush,
  looksLikeSmallFix,
  resolveAcceptancePolicy,
} from "@/lib/notify/acceptance-flow";

assert.ok(looksLikeSmallFix("修复登录按钮文案"));
assert.ok(looksLikeSmallFix("hotfix: typo"));
assert.ok(looksLikeSmallFix("更新 star-pm-write-release skill"));
assert.ok(looksLikeSmallFix("补 CHANGELOG 条目"));
assert.ok(!looksLikeSmallFix("工作台月历待办表大功能"));

{
  const r = resolveAcceptancePolicy({
    policy: "user_waived",
    goal: "大功能也直接过",
  });
  assert.equal(r.autoPass, true);
  assert.equal(r.policy, "user_waived");
}

{
  const r = resolveAcceptancePolicy({
    goal: "修复验收列表空状态",
    pendingItems: [],
  });
  assert.equal(r.autoPass, true);
  assert.equal(r.policy, "auto_pass_small");
}

{
  const r = resolveAcceptancePolicy({
    goal: "智能化验收 A+B+C + PushPlus",
    pendingItems: [],
  });
  assert.equal(r.autoPass, false);
  assert.equal(r.policy, "remind");
}

{
  const r = resolveAcceptancePolicy({
    policy: "remind",
    goal: "修复 typo",
    pendingItems: [],
  });
  assert.equal(r.autoPass, false);
}

{
  const push = formatReleaseSummaryPush({
    projectTitle: "Star PM",
    tag: "v1.13.1",
    modules: ["工作台·验收·推送节奏"],
    releaseName: "v1.13.1 收工不推、发版汇总推",
    bodyPreview: "- 收工不 Push\n- 发版汇总推",
    githubUrl: "https://github.com/1Astar/star_project-manage/releases/tag/v1.13.1",
    workbenchUrl: "https://pm.starry-studio.cn/?focus=pm-today",
  });
  assert.match(push.title, /已发版/);
  assert.match(push.content, /本版板块/);
  assert.match(push.content, /Release：/);
}

console.log("lib/notify/acceptance-flow.test.ts ok");
