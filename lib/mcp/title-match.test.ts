import assert from "node:assert/strict";
import {
  changelogBulletLead,
  commitSubject,
  normTitle,
  titlesSimilar,
} from "@/lib/mcp/title-match";

assert.equal(normTitle("【P1】板块·待办"), "板块待办");
assert.ok(titlesSimilar("月历待办表", "月历待办表：手填导入"));
assert.ok(titlesSimilar("发版后扫 CHANGELOG", "**发版后扫 CHANGELOG**：说明文字"));
assert.equal(
  changelogBulletLead("**能力名**：一句话结果"),
  "能力名"
);
assert.ok(!titlesSimilar("短", "完全无关的长标题内容"));
assert.equal(commitSubject("feat(pm): 每日 sync-git 建议匹配\n\nbody"), "每日 sync-git 建议匹配");
assert.equal(commitSubject("fix: 修复标题匹配"), "修复标题匹配");
assert.ok(titlesSimilar("每日 sync-git 建议匹配", commitSubject("feat: 每日 sync-git 建议匹配")));

console.log("lib/mcp/title-match.test.ts ok");
