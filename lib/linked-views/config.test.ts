import assert from "node:assert/strict";
import {
  hasLinkedViewFence,
  parseLinkedViewConfig,
  serializeLinkedViewFence,
} from "./config";
import {
  applyLinkedViewFilters,
  applyLinkedViewSort,
  groupLinkedViewRows,
  prepareLinkedViewRows,
} from "./query";
import { moduleHintFromFilters, titleHintFromFilters } from "./filter-hints";
import {
  defaultLinkedViewConfig,
  explodeMdBlocks,
  joinBodySegments,
  splitBodySegments,
} from "./segments";
import { joinPageProps, splitPageProps } from "../wiki-pages/page-props";
import { withPartitionTag } from "./module-path";
import { polishLinkedViewTitle } from "./optimize-title";
import {
  applyModuleToTitle,
  applyPartitionToTitle,
  linkedViewTitleHint,
  parseTitleModulePrefix,
} from "./title-hints";

const fence = serializeLinkedViewFence({
  v: 1,
  source: "requirement",
  title: "关联需求",
  filters: [{ id: "f1", field: "module", op: "contains", value: "任务中心" }],
});

assert.equal(hasLinkedViewFence(fence), true);
assert.equal(hasLinkedViewFence("## 简介"), false);

const parsed = parseLinkedViewConfig(
  JSON.stringify({
    source: "bug",
    title: "Bug",
    filters: [{ field: "status", op: "equals", value: "待开始" }],
  })
);
assert.ok(parsed);
assert.equal(parsed.source, "bug");
assert.equal(parsed.filters.length, 1);
assert.equal(parsed.filters[0]?.op, "equals");

const md = `## 定位\n说明\n\n${fence}\n\n## 后记\n完`;
const segs = splitBodySegments(md);
assert.equal(segs.length, 3);
assert.equal(segs[0]?.type, "md");
assert.equal(segs[1]?.type, "view");
assert.equal(segs[2]?.type, "md");
if (segs[1]?.type === "view") {
  assert.equal(segs[1].config.source, "requirement");
  assert.equal(segs[1].config.filters[0]?.value, "任务中心");
}
const joined = joinBodySegments(segs);
assert.equal(hasLinkedViewFence(joined), true);
assert.match(joined, /## 定位/);
assert.match(joined, /## 后记/);
const exploded = explodeMdBlocks(segs);
assert.ok(exploded.length >= 3);
assert.equal(exploded.filter((s) => s.type === "view").length, 1);
const packed = joinPageProps(
  { status: "调研中", capability: "核心能力" },
  "## 正文"
);
assert.match(packed, /star-page/);
const unpacked = splitPageProps(packed);
assert.equal(unpacked.props.status, "调研中");
assert.equal(unpacked.props.capability, "核心能力");
assert.equal(unpacked.markdown, "## 正文");

const seeded = defaultLinkedViewConfig({
  source: "requirement",
  title: "需求",
  moduleName: "任务中心",
});
assert.equal(seeded.title, "任务中心 | 关联需求");
assert.equal(seeded.filters[0]?.field, "module");
assert.equal(seeded.filters[0]?.value, "任务中心");

const rows = [
  {
    id: "1",
    title: "A",
    href: "/",
    cells: { module: "任务中心·上传", status: "已提交" },
  },
  {
    id: "2",
    title: "B",
    href: "/",
    cells: { module: "文件管理", status: "已提交" },
  },
];
const filtered = applyLinkedViewFilters(rows, [
  { id: "a", field: "module", op: "contains", value: "任务中心" },
  { id: "b", field: "status", op: "equals", value: "已提交" },
]);
assert.equal(filtered.length, 1);
assert.equal(filtered[0]?.id, "1");

const sorted = applyLinkedViewSort(rows, { field: "module", direction: "asc" });
assert.equal(sorted[0]?.id, "1");
const grouped = groupLinkedViewRows(rows, "status");
assert.equal(grouped.length, 1);
assert.equal(grouped[0]?.rows.length, 2);
const prepared = prepareLinkedViewRows(rows, {
  filters: [],
  sort: { field: "title", direction: "desc" },
  groupBy: "module",
});
assert.ok(prepared.length >= 2);
const withSort = parseLinkedViewConfig(
  JSON.stringify({
    source: "bug",
    title: "Bug",
    filters: [],
    sort: { field: "status", direction: "desc" },
    groupBy: "module",
  })
);
assert.ok(withSort);
assert.equal(withSort.sort?.field, "status");
assert.equal(withSort.sort?.direction, "desc");
assert.equal(withSort.groupBy, "module");

assert.equal(
  moduleHintFromFilters([
    { id: "a", field: "module", op: "contains", value: "任务中心" },
  ]),
  "任务中心"
);
assert.equal(
  titleHintFromFilters([
    { id: "t", field: "title", op: "equals", value: "上传" },
  ]),
  "上传"
);

const bugHint = linkedViewTitleHint("bug", "任务中心");
assert.equal(bugHint.placeholder, "[任务中心] 问题现象 + 关键条件");
assert.equal(bugHint.draftTitle, "[任务中心] ");
assert.match(bugHint.example, /设置-网络/);
const learnHint = linkedViewTitleHint("learning", "任务中心");
assert.equal(learnHint.placeholder, "技术概念 / 原理 / 机制");
assert.equal(learnHint.draftTitle, "");
const reqHint = linkedViewTitleHint("requirement", "任务中心");
assert.match(reqHint.placeholder, /用户目标 \/ 需要实现的能力/);
const optHint = linkedViewTitleHint("optimization", "");
assert.match(optHint.placeholder, /优化对象 \+ 改进方向/);
const prdHint = linkedViewTitleHint("prd", "文件管理");
assert.equal(prdHint.draftTitle, "PRD-文件管理-");
const compHint = linkedViewTitleHint("competitor", "任务中心");
assert.equal(compHint.draftTitle, "");
assert.match(compHint.example, /群晖/);

assert.equal(
  applyModuleToTitle("requirement", "支持批量上传", "文件管理"),
  "[文件管理] 支持批量上传"
);
assert.equal(
  applyModuleToTitle("bug", "[设置] 壁纸排序不对", "文件管理"),
  "[文件管理] 壁纸排序不对"
);
assert.equal(
  applyModuleToTitle("prd", "PRD-设置-复制", "文件管理"),
  "PRD-文件管理-复制"
);
assert.equal(applyModuleToTitle("prd", "", "文件管理"), "PRD-文件管理-");
assert.equal(
  applyModuleToTitle("learning", "SMB 协议", "文件管理"),
  "SMB 协议"
);
assert.equal(
  applyModuleToTitle("competitor", "群晖 Photos｜人物", "文件管理"),
  "群晖 Photos｜人物"
);
assert.equal(
  applyModuleToTitle("requirement", "[文件管理] 批量上传", ""),
  "批量上传"
);
assert.equal(
  applyModuleToTitle("bug", "[设置-网络] 链路聚合配置缺少防错校验", "设置"),
  "[设置-网络] 链路聚合配置缺少防错校验"
);
assert.equal(
  applyPartitionToTitle(
    "bug",
    "[设置] 链路聚合配置缺少防错校验",
    "设置",
    "网络"
  ),
  "[设置-网络] 链路聚合配置缺少防错校验"
);
assert.equal(
  applyPartitionToTitle("bug", "[设置-网络] 缺校验", "设置", ""),
  "[设置] 缺校验"
);
const parsedBug = parseTitleModulePrefix(
  "bug",
  "[设置-网络] 链路聚合配置缺少防错校验"
);
assert.equal(parsedBug.l1, "设置");
assert.equal(parsedBug.l2, "网络");
assert.equal(parsedBug.rest, "链路聚合配置缺少防错校验");
assert.equal(withPartitionTag("紧急", "网络"), "紧急、网络");
assert.equal(withPartitionTag("网络", "网络"), "网络");
assert.equal(
  polishLinkedViewTitle({
    kind: "bug",
    title: "链路聚合配置缺少防错校验",
    l1: "设置",
    l2: "网络",
  }),
  "[设置-网络] 链路聚合配置缺少防错校验"
);
assert.equal(
  polishLinkedViewTitle({
    kind: "bug",
    title: "测一下上传",
    l1: "设置",
    l2: "",
  }),
  "[设置] 测一下上传"
);
assert.equal(
  polishLinkedViewTitle({
    kind: "learning",
    title: "[设置] SMB 协议",
    l1: "设置",
    l2: "网络",
  }),
  "SMB 协议"
);

console.log("linked-views config ok");
