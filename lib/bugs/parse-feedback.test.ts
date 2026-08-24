import assert from "node:assert/strict";
import {
  detectFeedbackSectionKind,
  inferBugSeverity,
  inferBugType,
  inferFeedbackKind,
  matchImagesToDrafts,
  parseBugFeedbackHeuristic,
} from "./parse-feedback";
import { previewOrganizeBugs } from "./organize";
import type { Bug } from "@/lib/types";

assert.equal(inferBugSeverity("一点小文案错字"), 4);
assert.equal(inferBugSeverity("登录页白屏崩溃"), 1);
assert.equal(inferBugType("按钮被挡住点不到"), "ui");
assert.equal(inferBugType("列表滑动很卡顿"), "performance");

const preview = parseBugFeedbackHeuristic(`随心而行反馈
1. 塔罗抽卡后按钮被挡住，见图1
重现：打开塔罗 → 抽三张
期望：按钮能点
2. 八字图鉴加载很卡
3. 轻微文案错字：流年写成流年年`);

assert.equal(preview.method, "heuristic");
assert.equal(preview.drafts.length, 3);
assert.match(preview.drafts[0].title, /塔罗|按钮/);
assert.equal(preview.drafts[0].bugType, "ui");
assert.ok(preview.drafts[0].imageHints.length >= 1);
assert.equal(preview.drafts[1].bugType, "performance");
assert.equal(preview.drafts[2].severity, 4);
assert.equal(preview.drafts[0].kind, "bug");

assert.equal(detectFeedbackSectionKind("## 一、Bug清单（12项）"), "bug");
assert.equal(detectFeedbackSectionKind("## 二、需求清单（5项）"), "requirement");
assert.equal(inferFeedbackKind("希望提供 Web 端访问链接"), "requirement");
assert.equal(inferFeedbackKind("知识库内有内容但显示为0"), "bug");

const mixed = parseBugFeedbackHeuristic(`MAS反馈
## 一、Bug清单
1. 知识库显示异常：内容有但显示为0
2. 回复会中断
## 二、需求清单
1. 希望提供 Web 端访问链接
2. 创建员工时智能分类分部门`);
assert.ok(mixed.drafts.length >= 4);
const kinds = mixed.drafts.map((d) => d.kind);
assert.ok(kinds.filter((k) => k === "bug").length >= 2);
assert.ok(kinds.filter((k) => k === "requirement").length >= 2);

// 结构小标题（复现/出现/失效原因）不应拆成多条
const structured = parseBugFeedbackHeuristic(`节点管理反馈
### 复现步骤
datahub-node 不可用
### 出现步骤
打开 MAS 节点管理页
### 失效原因分析
| 工具 | 说明 |
| mas_collab_ask | 未启用 |`);
assert.equal(structured.drafts.length, 1);
assert.match(structured.drafts[0].title, /节点|datahub|反馈/);

const bugs: Bug[] = [
  {
    id: "a",
    project_id: "p",
    requirement_id: null,
    title: "塔罗抽卡按钮被挡住",
    description: "界面上按钮点不到",
    repro_steps: null,
    assignee: null,
    status: "pending",
    severity: 3,
    bug_type: "other",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "b",
    project_id: "p",
    requirement_id: null,
    title: "塔罗抽卡按钮被挡住：手机宽屏",
    description: null,
    repro_steps: null,
    assignee: null,
    status: "pending",
    severity: 3,
    bug_type: "ui",
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  },
];

const org = previewOrganizeBugs({
  bugs,
  requirements: [{ id: "r1", title: "塔罗抽卡按钮被挡住" }],
});
assert.equal(org.fillTypes[0]?.to, "ui");
assert.equal(org.linkRequirements[0]?.requirementId, "r1");
assert.equal(org.duplicateGroups.length, 1);
assert.equal(org.duplicateGroups[0].keepId, "a");
assert.deepEqual(org.duplicateGroups[0].closeIds, ["b"]);

const imgMap = matchImagesToDrafts(preview.drafts, ["图1.png", "b.png", "c.png"]);
assert.deepEqual(imgMap["h-0"], ["图1.png"]);

const byName = matchImagesToDrafts(
  [
    {
      key: "x",
      title: "A",
      description: "",
      reproSteps: "",
      imageHints: ["login-fail.png"],
    },
  ],
  ["login-fail.png", "other.png"]
);
assert.deepEqual(byName.x, ["login-fail.png"]);

console.log("lib/bugs parse+organize ok");
