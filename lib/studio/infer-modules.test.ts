import assert from "node:assert/strict";
import {
  inferModuleFromText,
  resolveModuleForImport,
} from "./infer-modules";
import {
  detectModuleCatalog,
  parseFeatureModulesInput,
  resolveFeatureModules,
} from "./project-modules";
import { isSemverReleaseTag } from "./release-notes";

assert.equal(detectModuleCatalog("x", "1Astar/chris-phone"), "chris-phone");
assert.equal(detectModuleCatalog("proj-star-pm", null), "star-pm");
assert.equal(detectModuleCatalog("other", "foo/bar"), "generic");

const chris = resolveFeatureModules("p1", null, "1Astar/chris-phone");
assert.ok(chris.includes("推送通知"));
assert.ok(chris.includes("对话聊天"));
assert.ok(!chris.includes("产品"));

assert.deepEqual(
  resolveFeatureModules("p1", ["锁屏", "通话"], "1Astar/chris-phone"),
  ["锁屏", "通话"]
);

assert.equal(
  inferModuleFromText("fix: v0.4.11 force resubscribe push after VAPID key change", {
    projectId: "p1",
    githubRepo: "1Astar/chris-phone",
    allowed: chris,
  }),
  "推送通知"
);

assert.equal(
  inferModuleFromText("nest/12-gallery-three-layer image expiry", {
    githubRepo: "1Astar/chris-phone",
    allowed: chris,
  }),
  "相册图库"
);

const resolved = resolveModuleForImport(
  null,
  "opencli diagnose autostart",
  "p1",
  { githubRepo: "1Astar/chris-phone" }
);
assert.equal(resolved.module, "OpenCLI");
assert.equal(resolved.inferred, true);

assert.deepEqual(parseFeatureModulesInput("对话,相册\n推送"), ["对话", "相册", "推送"]);

// 语义化邻接：过程 Tag 不应参与 prev 选择（逻辑在 sync，这里只验判定）
const mixed = ["stage/foo", "v0.4.10", "nest/01", "v0.4.11"];
const semver = mixed.filter(isSemverReleaseTag);
assert.deepEqual(semver, ["v0.4.10", "v0.4.11"]);

console.log("infer-modules / project-modules ok");
