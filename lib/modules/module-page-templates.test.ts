import assert from "node:assert/strict";
import {
  buildFeatureInvestigationTemplate,
  buildFileUploadInvestigationTemplate,
  buildModuleHomeBioTemplate,
  defaultFeatureAreasForModule,
} from "./module-page-templates";

const bio = buildModuleHomeBioTemplate({
  moduleName: "文件管理",
  goal: "管理文件浏览、上传下载等。",
  capability: "上传、下载、搜索",
  featureAreas: defaultFeatureAreasForModule("文件管理"),
});
assert.match(bio, /# 文件管理/);
assert.match(bio, /模块工作流/);
assert.match(bio, /```star-view/);
assert.match(bio, /"source":"requirement"/);
assert.match(bio, /"source":"bug"/);
assert.match(bio, /"source":"optimization"/);
assert.match(bio, /"value":"文件管理"/);
assert.match(bio, /### 文件上传/);

const inv = buildFeatureInvestigationTemplate({
  featureTitle: "搜索与浏览",
  moduleName: "文件管理",
});
assert.match(inv, /<!--star-page/);
assert.match(inv, /功能目标/);
assert.match(inv, /判断规则/);
assert.match(inv, /"source":"bug"/);
assert.match(inv, /"value":"文件管理"/);

const upload = buildFileUploadInvestigationTemplate("文件管理");
assert.match(upload, /上传单个文件/);
assert.match(upload, /单个小文件正常上传/);

assert.equal(defaultFeatureAreasForModule("设置").length, 0);
assert.ok(defaultFeatureAreasForModule("文件管理").length >= 5);

console.log("module-page-templates.test.ts ok");
