import assert from "node:assert/strict";
import {
  extractReleaseBodyItems,
  hasStructuredReleaseBody,
} from "../lib/studio/release-notes";
import { inferChangeDirection } from "../lib/studio/infer-modules";

assert.deepEqual(extractReleaseBodyItems("- a\n- b"), ["a", "b"]);
assert.deepEqual(extractReleaseBodyItems("需求侧栏；Bug 详情跳转"), [
  "需求侧栏",
  "Bug 详情跳转",
]);
assert.equal(hasStructuredReleaseBody("短说明无列表"), false);
assert.equal(hasStructuredReleaseBody("- 有列表"), true);
assert.equal(inferChangeDirection("需求详情左右布局 + 提 Bug"), "产品");
assert.equal(inferChangeDirection("AES 加密与 schema migration"), "技术");
assert.equal(inferChangeDirection("按钮可读性与左右布局"), "体验");
assert.equal(inferChangeDirection("同步版本 Tag / Release 发版"), "交付");
console.log("release body + direction ok");
