import {
  buildIdeaIssueBody,
  buildIdeaIssueLabels,
  normalizeCapturePayload,
  parseIdeaIssueBody,
  type IdeaCapturePayload,
} from "@/lib/studio/idea-capture";
import { createIdeaGitHubIssue, fetchIdeaGitHubIssues, type GitHubIssue } from "@/lib/github/ideas";
import { upsertStudioIdeaFromGitHub } from "@/lib/studio/mutations";
import type { IdeaStatus, IdeaType } from "@/lib/studio/types";
import { IDEA_TYPE_CAPTURE_LABELS } from "@/lib/studio/types";

export async function captureIdeaViaGitHubIssue(payload: IdeaCapturePayload) {
  const fields = normalizeCapturePayload(payload);
  const issue = await createIdeaGitHubIssue({
    title: fields.title,
    body: buildIdeaIssueBody(fields),
    labels: buildIdeaIssueLabels(fields),
  });

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    title: fields.title,
  };
}

function mapIssueStatus(issue: GitHubIssue, labels: string[]): IdeaStatus {
  const statusLabel = labels.find((l) => l.startsWith("status:"))?.slice("status:".length);
  const map: Record<string, IdeaStatus> = {
    inbox: "inbox",
    reviewing: "reviewing",
    converted: "converted",
    done: "done",
    parked: "parked",
    archived: "archived",
  };
  if (statusLabel && map[statusLabel]) return map[statusLabel];
  if (issue.state === "closed") return "archived";
  return "inbox";
}

function mapIssueToIdeaInput(issue: GitHubIssue) {
  const labels = issue.labels.map((l) => l.name);
  const parsed = parseIdeaIssueBody(issue.body ?? "");
  const typeLabel = parsed.type ?? labels.find((l) => l.startsWith("idea-type:"))?.slice(10) ?? "产品想法";
  const source =
    parsed.source ??
    labels
      .find((l) => l.startsWith("source:"))
      ?.slice("source:".length)
      .replace(/^./, (c) => c.toUpperCase()) ??
    "GitHub";

  return {
    title: parsed.title ?? issue.title.replace(/^\[idea\]\s*/i, "").trim(),
    rawInput: parsed.rawThought ?? "",
    oneLineIdea: parsed.summary ?? "",
    whyItMatters: parsed.whyItMatters ?? "",
    triggerSource: source,
    type:
      IDEA_TYPE_CAPTURE_LABELS[typeLabel] ??
      (["product", "feature", "ui", "content", "tech", "business"].includes(typeLabel)
        ? (typeLabel as IdeaType)
        : "product"),
    status: mapIssueStatus(issue, labels),
    suggestedNextStep: parsed.suggestedNextStep ?? "",
    relatedProjectId: parsed.relatedProjectId ?? null,
    githubIssueNumber: issue.number,
    githubIssueUrl: issue.html_url,
    githubLabels: labels,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

export async function syncIdeasFromGitHub() {
  const issues = await fetchIdeaGitHubIssues("all");
  let created = 0;
  let updated = 0;

  for (const issue of issues) {
    const result = await upsertStudioIdeaFromGitHub(mapIssueToIdeaInput(issue));
    if (result.created) created++;
    else updated++;
  }

  return { total: issues.length, created, updated };
}
