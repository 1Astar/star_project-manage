import assert from "node:assert/strict";
import {
  extractReleaseBodyItems,
  hasStructuredReleaseBody,
} from "../lib/studio/mutations";

assert.deepEqual(extractReleaseBodyItems("- a\n- b"), ["a", "b"]);
assert.deepEqual(extractReleaseBodyItems("需求侧栏；Bug 详情跳转"), [
  "需求侧栏",
  "Bug 详情跳转",
]);
assert.equal(hasStructuredReleaseBody("短说明无列表"), false);
assert.equal(hasStructuredReleaseBody("- 有列表"), true);
console.log("release body parse ok");
