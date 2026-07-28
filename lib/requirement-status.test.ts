import assert from "node:assert/strict";
import {
  applyLifecycleStatus,
  canonicalizeStatusTags,
  requirementLifecycleStatus,
  requirementKanbanColumn,
} from "./requirement-status";

assert.equal(
  requirementLifecycleStatus({ status_tags: ["待开始"] }),
  "想法",
  "待开始 → 想法"
);
assert.equal(
  requirementLifecycleStatus({ status_tags: ["评审"] }),
  "已规划"
);
assert.equal(
  requirementLifecycleStatus({ status_tags: ["开发中"] }),
  "AI开发中"
);
assert.equal(
  requirementLifecycleStatus({ status_tags: ["待测试"] }),
  "AI开发中"
);
assert.equal(
  requirementLifecycleStatus({ status_tags: ["已取消"] }),
  "放弃"
);
assert.equal(
  requirementKanbanColumn({ status_tags: ["进行中", "自定义"] }),
  "AI开发中"
);

assert.deepEqual(canonicalizeStatusTags(["待开始"]), ["想法"]);
assert.deepEqual(canonicalizeStatusTags(["评审", "需设计"]), ["已规划", "需设计"]);
assert.deepEqual(applyLifecycleStatus(["想法", "需设计"], "待验收"), [
  "待验收",
  "需设计",
]);
assert.deepEqual(applyLifecycleStatus(["开发中"], "完成"), ["完成"]);

console.log("requirement-status.test.ts OK");
