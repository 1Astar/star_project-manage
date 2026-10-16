import assert from "node:assert/strict";
import { annotateHtmlDiff } from "./html-diff";
import { nextPrdVersionLabel } from "./versions";

assert.equal(nextPrdVersionLabel([]), "1.0");
assert.equal(nextPrdVersionLabel([{ id: "a", label: "1.0", html_content: "", created_at: "" }]), "1.0.1");
assert.equal(
  nextPrdVersionLabel([{ id: "a", label: "1.0.1", html_content: "", created_at: "" }]),
  "1.0.2"
);

const annotated = annotateHtmlDiff(
  "<h1>标题</h1><p>旧段落</p>",
  "<h1>标题</h1><p>新段落</p>"
);
assert.match(annotated, /prd-rev-del/);
assert.match(annotated, /prd-rev-add/);
assert.match(annotated, /新段落/);

console.log("lib/prds/html-diff.test.ts ok");
