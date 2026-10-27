import assert from "node:assert/strict";
import {
  BUILTIN_TEMPLATE_TITLES,
  builtinTemplateBodyIsStale,
  listBuiltinTemplateSpecs,
} from "./builtin-templates";

assert.equal(builtinTemplateBodyIsStale(BUILTIN_TEMPLATE_TITLES.index, "# old"), true);
assert.equal(
  builtinTemplateBodyIsStale(BUILTIN_TEMPLATE_TITLES.index, "含 产品测试分析助手"),
  false
);

const oldHome = "## 相关需求\n\nx\n\n## 关联 Bug\n\ny\n\n## 关联 PRD\n\nz\n";
assert.equal(builtinTemplateBodyIsStale(BUILTIN_TEMPLATE_TITLES.moduleHome, oldHome), true);

for (const spec of listBuiltinTemplateSpecs()) {
  assert.equal(
    builtinTemplateBodyIsStale(spec.title, spec.body),
    false,
    `fresh spec should not be stale: ${spec.title}`
  );
}

console.log("builtin-templates.stale.test.ts ok");
