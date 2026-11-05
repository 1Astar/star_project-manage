import assert from "node:assert/strict";
import { isOptimizationBug } from "./matrix-rows";
import type { Bug } from "@/lib/types";

function bug(partial: Partial<Bug>): Bug {
  return {
    id: "b1",
    project_id: "p",
    requirement_id: null,
    test_plan_id: null,
    iteration_id: null,
    title: "x",
    description: null,
    precondition: null,
    repro_steps: null,
    expected_result: null,
    actual_result: null,
    suggestion: null,
    module_path: null,
    found_version: null,
    resolved_version: null,
    environments: [],
    priority: null,
    assignee: null,
    reporter_name: null,
    updated_by: null,
    watchers: [],
    status: "pending",
    severity: 3,
    bug_type: "ui",
    created_at: "",
    updated_at: "",
    ...partial,
  } as Bug;
}

assert.equal(
  isOptimizationBug(bug({ title: "[优化] 上传相同文件只能覆盖不能另存", suggestion: null })),
  true,
  "title [优化] must count as optimization even without suggestion"
);

assert.equal(
  isOptimizationBug(
    bug({
      title: "上传失败",
      description: "模块：文件管理\n出处：Excel 优化表",
      suggestion: null,
    })
  ),
  true,
  "Excel 优化表 marker in description"
);

assert.equal(
  isOptimizationBug(
    bug({
      title: "改进搜索",
      suggestion: "加高亮",
      description: "来自优化表导入",
      repro_steps: "随便写了步骤",
    })
  ),
  true,
  "来自优化表 wins even with repro steps"
);

assert.equal(
  isOptimizationBug(bug({ title: "复制无进度", suggestion: "加进度条", repro_steps: null })),
  true,
  "has suggestion, no repro → optimization"
);

assert.equal(
  isOptimizationBug(
    bug({
      title: "复制无进度",
      suggestion: "加进度条",
      repro_steps: "1. 复制大文件",
    })
  ),
  false,
  "suggestion + repro without opt markers → keep as Bug"
);

assert.equal(
  isOptimizationBug(bug({ title: "列表未刷新", suggestion: null, repro_steps: "移动后刷新" })),
  false,
  "plain bug"
);

console.log("matrix-rows.test.ts ok");
