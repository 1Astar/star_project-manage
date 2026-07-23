import assert from "node:assert/strict";
import { parseFeaturePathToLevels } from "./feature-module-tree";

assert.deepEqual(parseFeaturePathToLevels("六爻·笔记·卦象解析"), {
  l1: "六爻",
  l2: "笔记·卦象解析",
});
assert.deepEqual(parseFeaturePathToLevels("旅程·备份"), {
  l1: "旅程",
  l2: "备份",
});
assert.deepEqual(parseFeaturePathToLevels("六爻"), {
  l1: "六爻",
  l2: null,
});
assert.equal(parseFeaturePathToLevels("  ·  · "), null);
assert.equal(parseFeaturePathToLevels(""), null);
assert.deepEqual(parseFeaturePathToLevels(" 八字 · 排盘 · 合盘 "), {
  l1: "八字",
  l2: "排盘·合盘",
});

console.log("feature-module-tree.parse ok");
