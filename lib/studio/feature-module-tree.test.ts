import assert from "node:assert/strict";
import {
  normalizeFeaturePath,
  parseFeatureModulesInput,
  parseFeaturePathToChain,
} from "./project-modules";
import { parseFeaturePathToLevels } from "./feature-module-tree";

assert.deepEqual(parseFeaturePathToChain("六爻·笔记·卦象解析"), [
  "六爻",
  "笔记",
  "卦象解析",
]);
assert.deepEqual(parseFeaturePathToChain("六爻/笔记"), ["六爻", "笔记"]);
assert.deepEqual(parseFeaturePathToChain("六爻、笔记、卦象解析"), [
  "六爻",
  "笔记",
  "卦象解析",
]);
assert.deepEqual(parseFeaturePathToChain(" 八字 / 排盘 / 合盘 "), [
  "八字",
  "排盘",
  "合盘",
]);
assert.equal(normalizeFeaturePath("六爻/笔记、卦象解析"), "六爻·笔记·卦象解析");

assert.deepEqual(
  parseFeatureModulesInput("六爻/笔记\n旅程、备份\n对话聊天,相册图库"),
  ["六爻·笔记", "旅程·备份", "对话聊天", "相册图库"]
);
// 顿号在路径内分层，不再整行按顿号拆成多条扁平名
assert.deepEqual(parseFeatureModulesInput("六爻、笔记、卦象解析"), [
  "六爻·笔记·卦象解析",
]);

assert.deepEqual(parseFeaturePathToLevels("六爻·笔记·卦象解析"), {
  l1: "六爻",
  l2: "笔记·卦象解析",
});

console.log("feature-module-tree + project-modules parse ok");
