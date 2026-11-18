import assert from "node:assert/strict";
import {
  buildSideBySideDiff,
  htmlToDiffText,
} from "./side-by-side-diff";

const rows = buildSideBySideDiff(
  "hello\nold line\nkeep",
  "hello\nnew line\nkeep"
);
assert.ok(rows.some((r) => r.left.kind === "change" || r.left.kind === "del"));
assert.ok(rows.some((r) => r.right.kind === "change" || r.right.kind === "add"));
assert.ok(rows.some((r) => r.left.kind === "equal" && r.left.text === "hello"));

const text = htmlToDiffText("<h1>标题</h1><p>一段 <strong>粗</strong></p>");
assert.match(text, /标题/);
assert.match(text, /粗/);

console.log("side-by-side-diff.test.ts ok");
