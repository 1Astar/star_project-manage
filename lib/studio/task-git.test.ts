import assert from "node:assert/strict";
import { taskMatchPhrases, textMatchesTask } from "./task-git";

const phrases = taskMatchPhrases("【六爻P1✅】起卦翻牌解谜");
assert.ok(phrases.strong.includes("起卦翻牌解谜"));
assert.ok(phrases.strong.some((p) => p.includes("六爻")) || phrases.weak.includes("六爻"));

assert.equal(
  textMatchesTask("feat: 起卦翻牌解谜 polish", { id: "task-1", title: "【六爻P1✅】起卦翻牌解谜" }),
  true,
  "长中文短语命中 1 个即可"
);

assert.equal(
  textMatchesTask("release: v0.2.41 ReadingFacts + 学习因果链", {
    id: "task-2",
    title: "P0 六爻 ReadingFacts + 学习因果链/核心映射",
  }),
  true,
  "英文标识或长中文命中即可"
);

assert.equal(
  textMatchesTask("chore: bump version", { id: "task-3", title: "【六爻P1✅】起卦翻牌解谜" }),
  false
);

assert.equal(
  textMatchesTask("closes task-abc123", { id: "task-abc123", title: "随便" }),
  true,
  "任务 id 直接命中"
);

const releaseBody = `
## v0.2.41
- 速断表盘三 Tab
- ReadingFacts + 学习因果链
`;
assert.equal(
  textMatchesTask(releaseBody, {
    id: "t",
    title: "[done] P0 ReadingFacts + 学习因果链",
  }),
  true,
  "Release body 可匹配"
);

console.log("task-git.test.ts ok");
