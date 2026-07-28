import assert from "node:assert/strict";
import { splitBrainstormHeuristic } from "./split-brainstorm";

const sample = `Mystic Lab 五大体系
① 塔罗 Tarot
关键词：看见自己
② 小六壬
关键词：看当下
③ 六爻
关键词：看变化
④ 八字
关键词：看长期结构
⑤ 紫微斗数
关键词：人生星盘`;

const preview = splitBrainstormHeuristic(sample);
assert.equal(preview.method, "heuristic");
assert.ok(preview.parentTitle.includes("五大体系") || preview.parentTitle.includes("Mystic"));
assert.equal(preview.tasks.length, 5);
assert.match(preview.tasks[0].title, /塔罗/);
assert.match(preview.tasks[4].title, /紫微/);

console.log("split-brainstorm heuristic ok", preview.tasks.map((t) => t.title).join(" | "));
