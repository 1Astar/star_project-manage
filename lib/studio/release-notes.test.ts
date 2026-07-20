import assert from "node:assert/strict";
import {
  compareVersionTags,
  formatCommitsAsChangelog,
  formatReleaseNotesMarkdown,
  groupChangesByModule,
} from "./release-notes";
import type { EvolutionLog } from "./types";
import type { GitHubCommit } from "@/lib/github/client";

assert.ok(compareVersionTags("v0.4.10", "v0.4.11") < 0);
assert.ok(compareVersionTags("v1.9.0", "v1.9.1") < 0);

const commits = [
  {
    sha: "abc",
    html_url: "",
    commit: { message: "feat: foo\n\nbody", author: { name: "a", date: "2026-01-01" } },
  },
] as GitHubCommit[];
assert.match(formatCommitsAsChangelog(commits), /feat: foo/);

const evo: EvolutionLog[] = [
  {
    id: "1",
    title: "加时间线",
    projectId: "p",
    logType: "feature_add",
    before: "",
    after: "tabs",
    reason: "",
    decision: "",
    module: "迭代记录",
    releaseTag: "v1.9.1",
    createdAt: "2026-07-20T00:00:00.000Z",
  },
];
const groups = groupChangesByModule({ evolution: evo, releaseTag: "v1.9.1" });
assert.equal(groups.length, 1);
assert.equal(groups[0].module, "迭代记录");
assert.match(formatReleaseNotesMarkdown({ title: "v1.9.1", groups }), /迭代记录/);

console.log("release-notes ok");
