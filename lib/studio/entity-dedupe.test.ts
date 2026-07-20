import assert from "node:assert/strict";
import {
  findDuplicateAssets,
  findDuplicateProjects,
  normalizeAssetUrl,
} from "./entity-dedupe";
import type { Asset, Project } from "./types";

function project(partial: Pick<Project, "id" | "title" | "status">): Project {
  return {
    positioning: "",
    targetUser: "",
    priority: "P2",
    currentStage: "",
    nextAction: "",
    demoUrl: null,
    localRunGuide: null,
    codePath: null,
    githubRepo: null,
    githubBranch: "main",
    lastCommitSha: null,
    lastGitSyncedAt: null,
    vercelUrl: null,
    lastCommitMessage: null,
    lastCommitAt: null,
    relatedPageUrl: null,
    portfolioValue: "",
    customFields: {},
    body: {
      initialThought: "",
      whyThought: "",
      positioning: "",
      iterations: "",
      done: "",
      notDone: "",
      nextStep: "",
      links: "",
      retrospectives: "",
    },
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
    parentId: null,
    featureModules: [],
    ...partial,
  };
}

function asset(
  partial: Pick<Asset, "id" | "title" | "projectId"> & Partial<Asset>
): Asset {
  return {
    assetType: "doc",
    url: "",
    storagePath: null,
    mimeType: null,
    note: "",
    takeaway: "",
    risk: null,
    ...partial,
  };
}

assert.equal(
  normalizeAssetUrl("https://Example.com/path/"),
  "https://example.com/path"
);
assert.equal(
  normalizeAssetUrl("https://example.com:443/a"),
  "https://example.com/a"
);

const projects = [
  project({ id: "p1", title: "随心而行", status: "mainline" }),
  project({ id: "p2", title: "随心而行 Mystic Lab", status: "active" }),
  project({ id: "p3", title: "随心而行旧版", status: "archived" }),
];

const projectHits = findDuplicateProjects(projects, "随心而行");
assert.ok(projectHits.some((h) => h.id === "p1"));
assert.ok(projectHits.some((h) => h.id === "p2"));
assert.ok(!projectHits.some((h) => h.id === "p3"), "archived 应排除");

const assets = [
  asset({
    id: "a1",
    title: "GitHub · Mystic-Lab",
    projectId: "proj-moonpie",
    url: "https://github.com/1Astar/Mystic-Lab/",
  }),
  asset({
    id: "a2",
    title: "别的文档",
    projectId: "proj-moonpie",
    url: "https://example.com/doc",
  }),
  asset({
    id: "a3",
    title: "GitHub · Mystic-Lab",
    projectId: "proj-other",
    url: "https://github.com/1Astar/Mystic-Lab/",
  }),
];

const byUrl = findDuplicateAssets(assets, {
  title: "仓库",
  projectId: "proj-moonpie",
  url: "https://github.com/1Astar/Mystic-Lab",
});
assert.equal(byUrl[0]?.id, "a1");
assert.equal(byUrl[0]?.reason, "URL 相同");

const byTitle = findDuplicateAssets(assets, {
  title: "GitHub · Mystic-Lab",
  projectId: "proj-moonpie",
});
assert.ok(byTitle.some((h) => h.id === "a1"));
assert.ok(!byTitle.some((h) => h.id === "a3"), "跨项目不应命中");

console.log("entity-dedupe.test.ts ok");
