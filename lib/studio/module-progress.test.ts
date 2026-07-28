import assert from "node:assert/strict";
import { buildModuleProgressRows } from "./module-progress";
import { formatWorkDuration, workDurationMs } from "./work-hours";
import { buildImprovementCalendar } from "./improvement-calendar";
import type { EvolutionLog, Idea } from "./types";

assert.equal(workDurationMs("2026-07-28T06:00:00.000Z", "2026-07-28T07:30:00.000Z"), 90 * 60000);
assert.equal(formatWorkDuration(90 * 60000), "1h 30m");

const evolution: EvolutionLog[] = [
  {
    id: "e1",
    title: "五步课骨架",
    projectId: "p",
    logType: "feature_add",
    before: "",
    after: "",
    reason: "",
    decision: "",
    module: "六爻·学习·五步课",
    releaseTag: null,
    workStartedAt: "2026-07-28T02:00:00.000Z",
    workFinishedAt: "2026-07-28T03:00:00.000Z",
    createdAt: "2026-07-10T00:00:00.000Z",
  },
];
const ideas: Idea[] = [
  {
    id: "i1",
    title: "六爻学习线",
    oneLineIdea: "五步课",
    whyItMatters: "",
    aiSupplement: "",
    chatTopic: "",
    triggerSource: "",
    sourceChat: "",
    sourceMethod: "",
    emotionLevel: "normal",
    type: "feature",
    priority: "P1",
    rawInput: "",
    relatedProjectId: "p",
    relatedIdeaId: null,
    relatedModule: "六爻·学习·五步课",
    subtasks: [],
    status: "inbox",
    suggestedNextStep: "",
    decisionNotes: "",
    evolutionNotes: "",
    relatedAssetsNote: "",
    githubIssueNumber: null,
    githubIssueUrl: null,
    githubLabels: [],
    occurredAt: "2026-07-06T00:00:00.000Z",
    completedAt: null,
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
  },
];

const rows = buildModuleProgressRows({
  modules: ["六爻·学习·五步课"],
  evolution,
  ideas,
});
assert.ok(rows.some((r) => r.path === "六爻"));
assert.ok(rows.some((r) => r.path === "六爻·学习·五步课"));
const child = rows.find((r) => r.path === "六爻·学习·五步课")!;
assert.equal(child.proposedAt?.slice(0, 10), "2026-07-06");
assert.equal(child.totalDurationMs, 60 * 60000);

const cal = buildImprovementCalendar({
  evolution,
  changeSessions: [],
  projectTitleById: new Map([["p", "随心而行"]]),
});
assert.equal(cal.get("2026-07-10")?.items.length, 1);

console.log("module-progress + work-hours + calendar ok");
