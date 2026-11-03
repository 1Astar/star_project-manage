import assert from "node:assert/strict";
import {
  detectPrdImportFormat,
  previewPrdImport,
  markdownToPrdHtml,
  plainTextToPrdHtml,
} from "./import-text";

assert.equal(detectPrdImportFormat("# 标题\n\n正文"), "markdown");
assert.equal(detectPrdImportFormat("<h1>A</h1><p>b</p>"), "html");
assert.equal(detectPrdImportFormat("产品需求\n\n1. 背景\n说明\n1.1 细节"), "plain");

const md = previewPrdImport("# 登录改版\n\n## 1. 背景\n\n说明\n\n### 1.1 范围\n\n- a\n- b");
assert.equal(md.format, "markdown");
assert.equal(md.title, "登录改版");
assert.ok(md.outline.some((o) => o.level === 2 && o.text.includes("背景")));
assert.match(md.html, /<h1>/);
assert.match(markdownToPrdHtml("**粗**"), /<strong>粗<\/strong>/);

const plain = plainTextToPrdHtml("文件管理器 PRD\n\n1. 背景\n用户要找文件\n1.1 场景\n详情");
assert.ok(plain.outline.some((o) => o.level === 1));
assert.ok(plain.outline.some((o) => o.level === 2 && o.text.includes("背景")));
assert.ok(plain.outline.some((o) => o.level === 2 || o.level === 3));

const html = previewPrdImport("<h1>X</h1><h2>Y</h2><p>z</p>");
assert.equal(html.title, "X");
assert.equal(html.outline.length, 2);

console.log("import-text.test.ts ok");
