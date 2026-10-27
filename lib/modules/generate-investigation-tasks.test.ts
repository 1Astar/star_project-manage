import assert from "node:assert/strict";
import {
  checklistMarkdown,
  extractChecklistItems,
  extractH2Section,
  isInvestigationPage,
  mergeInvestigationSections,
  normalizeAnalysis,
  replaceH2Section,
  ruleBasedInvestigation,
  seedDescriptionFromBody,
} from "./generate-investigation-tasks";
import { buildFeatureInvestigationTemplate } from "./module-page-templates";
import { PRODUCT_TEST_ANALYST_SYSTEM } from "./test-task-prompt";

assert.match(PRODUCT_TEST_ANALYST_SYSTEM, /产品测试分析助手/);
assert.match(PRODUCT_TEST_ANALYST_SYSTEM, /不要把猜测直接写成 Bug/);

const sample = buildFeatureInvestigationTemplate({
  featureTitle: "文件上传",
  moduleName: "文件管理",
  goal: "确认文件上传的入口与异常处理。",
  investigate: ["找到上传入口"],
  tests: ["单个小文件正常上传"],
});

assert.equal(isInvestigationPage("文件上传｜功能调查与测试任务", ""), true);
assert.equal(isInvestigationPage("随便", sample), true);
assert.equal(isInvestigationPage("首页", "# 你好"), false);

assert.match(seedDescriptionFromBody(sample, "文件上传"), /入口/);
assert.match(sample, /已观察到的异常/);
assert.match(sample, /待研发确认规则/);

assert.deepEqual(extractChecklistItems("- [ ] a\n- [x] b\n不是"), ["a", "b"]);
assert.match(checklistMarkdown(["甲", "乙"]), /- \[ \] 甲/);

let md = "## 调查任务\n\n- [ ] 旧\n\n## 测试记录\n\n- 环境：\n";
md = replaceH2Section(md, "调查任务", "- [ ] 新");
assert.match(md, /- \[ \] 新/);
assert.match(md, /## 测试记录/);
assert.doesNotMatch(md, /- \[ \] 旧/);

const merged = mergeInvestigationSections(sample, normalizeAnalysis({
  goal: "新目标：上传与任务中心。",
  observed: ["上传单个文件"],
  observedAnomalies: ["进度卡住但文件已到"],
  featureBreakdown: ["入口", "进度"],
  testDirections: [
    {
      title: "主链路",
      derivedFrom: "用户核心目标",
      why: "确认上传可完成",
      relatedModule: "文件管理",
      mayExpose: "失败无提示",
    },
  ],
  investigate: ["验证拖拽上传"],
  testTasks: [
    {
      title: "上传中断网后恢复",
      purpose: "验证恢复",
      preconditions: "可断网",
      steps: ["开始上传", "断网", "恢复"],
      expected: "可续传或明确失败",
      mayExpose: "僵尸任务",
      issueType: "测试任务",
    },
  ],
  bugDirections: [
    { title: "进度与落地不一致", note: "仅观察", category: "已确认 Bug" },
  ],
  rulesToConfirm: ["断点续传是否必须"],
  coverageGaps: ["多端"],
}));

assert.match(merged, /新目标：上传与任务中心/);
assert.match(merged, /验证拖拽上传/);
assert.match(merged, /上传中断网后恢复/);
assert.match(merged, /推导来源/);
assert.match(merged, /待验证风险/); // 已确认 Bug 被降级
assert.doesNotMatch(extractH2Section(merged.replace(/^<!--star-page[\s\S]*?-->\s*/, ""), "可能的 Bug 方向"), /已确认 Bug/);
assert.match(merged, /## 测试记录/);
assert.match(merged, /```star-view/);
assert.match(merged, /"value":"文件管理"/);

const ruled = ruleBasedInvestigation({
  pageTitle: "文件上传｜功能调查与测试任务",
  moduleName: "文件管理",
  pageDescription: "确认上传入口、进度与异常。",
  featureGoal: "确认上传入口、进度与异常。",
  observedFeatures: "上传单个文件\n上传文件夹",
  observedAnomalies: "断网后进度不更新",
  currentBody: sample,
  revisionNote: "补上同名冲突",
  mode: "generate",
});
assert.ok(ruled.investigate.some((t) => /同名冲突/.test(t) || /修改说明/.test(t)));
assert.ok(ruled.testTasks.length >= 3);
assert.ok(ruled.testDirections.some((d) => /推导|用户核心|异常/.test(d.derivedFrom + d.title)));
assert.equal(ruled.observed.includes("上传单个文件"), true);

console.log("generate-investigation-tasks.test.ts ok");
