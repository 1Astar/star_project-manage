import { titlesSimilar } from "@/lib/mcp/title-match";
import type { Bug, BugType, Requirement, TaskStatus } from "@/lib/types";
import { inferBugType } from "@/lib/bugs/parse-feedback";

export type OrganizeFillType = { bugId: string; title: string; from: BugType; to: BugType };
export type OrganizeLinkReq = {
  bugId: string;
  title: string;
  requirementId: string;
  requirementTitle: string;
};
export type OrganizeDuplicateGroup = {
  keepId: string;
  keepTitle: string;
  closeIds: string[];
  closeTitles: string[];
};

export type OrganizeBugsPreview = {
  fillTypes: OrganizeFillType[];
  linkRequirements: OrganizeLinkReq[];
  duplicateGroups: OrganizeDuplicateGroup[];
};

const OPEN: TaskStatus[] = ["pending", "in_progress", "testing", "blocked"];

function blobText(bug: Bug): string {
  return `${bug.title}\n${bug.description ?? ""}\n${bug.repro_steps ?? ""}`;
}

export function previewOrganizeBugs(input: {
  bugs: Bug[];
  requirements: Array<Pick<Requirement, "id" | "title">>;
}): OrganizeBugsPreview {
  const open = input.bugs.filter((b) => OPEN.includes(b.status));
  const fillTypes: OrganizeFillType[] = [];

  for (const bug of open) {
    const inferred = inferBugType(blobText(bug));
    if (inferred === "other") continue;
    if (bug.bug_type === inferred) continue;
    if (bug.bug_type !== "other" && bug.bug_type !== "code") continue;
    fillTypes.push({
      bugId: bug.id,
      title: bug.title,
      from: bug.bug_type ?? "other",
      to: inferred,
    });
  }

  const linkRequirements: OrganizeLinkReq[] = [];
  for (const bug of open) {
    if (bug.requirement_id) continue;
    const hit = input.requirements.find((r) => titlesSimilar(bug.title, r.title));
    if (!hit) continue;
    linkRequirements.push({
      bugId: bug.id,
      title: bug.title,
      requirementId: hit.id,
      requirementTitle: hit.title,
    });
  }

  const duplicateGroups: OrganizeDuplicateGroup[] = [];
  const used = new Set<string>();
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    if (used.has(a.id)) continue;
    const close = open.filter(
      (b, j) => j > i && !used.has(b.id) && titlesSimilar(a.title, b.title)
    );
    if (!close.length) continue;
    used.add(a.id);
    for (const c of close) used.add(c.id);
    duplicateGroups.push({
      keepId: a.id,
      keepTitle: a.title,
      closeIds: close.map((c) => c.id),
      closeTitles: close.map((c) => c.title),
    });
  }

  return { fillTypes, linkRequirements, duplicateGroups };
}
