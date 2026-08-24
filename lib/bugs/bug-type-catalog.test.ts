import assert from "node:assert/strict";
import {
  isBugTypeKey,
  labelTaken,
  listBugTypeOptions,
  makeCustomBugTypeKey,
  normalizeBugTypeKey,
  parseBugTypeCatalog,
} from "./bug-type-catalog";
import { addCustomBugType } from "./bug-type-catalog.server";

assert.equal(normalizeBugTypeKey("ui"), "ui");
assert.equal(normalizeBugTypeKey("custom:zhishiku"), "custom:zhishiku");
assert.equal(normalizeBugTypeKey("nope"), "code");
assert.ok(isBugTypeKey("custom:foo"));
assert.ok(!isBugTypeKey("custom:"));

const cat = parseBugTypeCatalog({
  custom: [{ key: "custom:知识库", label: "知识库", createdAt: "2026-01-01" }],
});
assert.equal(cat.custom.length, 1);
assert.equal(listBugTypeOptions(cat).length, 8 + 1);
assert.ok(labelTaken("代码错误", cat));
assert.ok(labelTaken("知识库", cat));
assert.ok(!labelTaken("新类型", cat));

const taken = new Set(["custom:知识库"]);
assert.equal(makeCustomBugTypeKey("知识库", taken), "custom:知识库-2");

void (async () => {
  const { entry } = await addCustomBugType("联调专用");
  assert.ok(entry.key.startsWith("custom:"));
  assert.equal(entry.label, "联调专用");
  console.log("lib/bugs/bug-type-catalog.test.ts ok");
})();
