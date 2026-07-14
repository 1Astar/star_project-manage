import type {
  Asset,
  EvolutionLog,
  Idea,
  IdeaSubtask,
  Project,
  ProjectBody,
  StudioTask,
  TaskPriority,
} from "@/lib/studio/types";

const EMPTY_BODY: ProjectBody = {
  initialThought: "",
  whyThought: "",
  positioning: "",
  iterations: "",
  done: "",
  notDone: "",
  nextStep: "",
  links: "",
  retrospectives: "",
};

export interface StudioProjectRow {
  id: string;
  title: string;
  positioning: string;
  target_user: string;
  status: string;
  priority: string;
  current_stage: string;
  next_action: string;
  demo_url: string | null;
  local_run_guide: string | null;
  code_path: string | null;
  github_repo: string | null;
  github_branch?: string;
  vercel_url: string | null;
  last_commit_sha?: string | null;
  last_commit_message: string | null;
  last_commit_at: string | null;
  last_git_synced_at?: string | null;
  related_page_url: string | null;
  portfolio_value: string;
  body: ProjectBody | Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface StudioIdeaRow {
  id: string;
  title: string;
  one_line_idea: string;
  why_it_matters: string;
  trigger_source: string;
  emotion_level: string;
  type: string;
  priority: string;
  raw_input: string;
  related_project_id: string | null;
  related_idea_id: string | null;
  subtasks: IdeaSubtask[] | unknown;
  status: string;
  suggested_next_step: string;
  github_issue_number: number | null;
  github_issue_url: string | null;
  github_labels: string[] | unknown;
  created_at: string;
  updated_at: string;
}

export interface StudioEvolutionRow {
  id: string;
  title: string;
  project_id: string;
  log_type: string;
  before_text: string;
  after_text: string;
  reason: string;
  decision: string;
  created_at: string;
}

export interface StudioTaskRow {
  id: string;
  title: string;
  project_id: string;
  status: string;
  priority: string;
  workload: string;
  blocker: string | null;
  start_date?: string | null;
  end_date?: string | null;
  due_date: string | null;
  estimate_hours?: number | string | null;
  actual_hours?: number | string | null;
  completed_at?: string | null;
  progress_note?: string;
  completion_source?: string | null;
  git_commit_sha?: string | null;
  git_commit_message?: string | null;
  source_idea_id?: string | null;
  created_at: string;
}

function parseHours(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface StudioAssetRow {
  id: string;
  title: string;
  project_id: string;
  asset_type: string;
  url: string;
  storage_path?: string | null;
  mime_type?: string | null;
  note: string;
  takeaway: string;
  risk: string | null;
  created_at: string;
}

function normalizeBody(body: ProjectBody | Record<string, string> | null | undefined): ProjectBody {
  if (!body || typeof body !== "object") return { ...EMPTY_BODY };
  return {
    initialThought: body.initialThought ?? "",
    whyThought: body.whyThought ?? "",
    positioning: body.positioning ?? "",
    iterations: body.iterations ?? "",
    done: body.done ?? "",
    notDone: body.notDone ?? "",
    nextStep: body.nextStep ?? "",
    links: body.links ?? "",
    retrospectives: body.retrospectives ?? "",
  };
}

function normalizeSubtasks(value: IdeaSubtask[] | unknown): IdeaSubtask[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      priority: (["P0", "P1", "P2", "P3"].includes(String(item.priority))
        ? String(item.priority)
        : "P2") as TaskPriority,
      rationale: String(item.rationale ?? "").trim(),
    }))
    .filter((item) => item.title.length > 0);
}

export function projectToRow(project: Project): StudioProjectRow {
  return {
    id: project.id,
    title: project.title,
    positioning: project.positioning,
    target_user: project.targetUser,
    status: project.status,
    priority: project.priority,
    current_stage: project.currentStage,
    next_action: project.nextAction,
    demo_url: project.demoUrl,
    local_run_guide: project.localRunGuide,
    code_path: project.codePath,
    github_repo: project.githubRepo,
    github_branch: project.githubBranch,
    vercel_url: project.vercelUrl,
    last_commit_sha: project.lastCommitSha,
    last_commit_message: project.lastCommitMessage,
    last_commit_at: project.lastCommitAt,
    last_git_synced_at: project.lastGitSyncedAt,
    related_page_url: project.relatedPageUrl,
    portfolio_value: project.portfolioValue,
    body: project.body,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

export function rowToProject(row: StudioProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    positioning: row.positioning,
    targetUser: row.target_user,
    status: row.status as Project["status"],
    priority: row.priority as Project["priority"],
    currentStage: row.current_stage,
    nextAction: row.next_action,
    demoUrl: row.demo_url,
    localRunGuide: row.local_run_guide,
    codePath: row.code_path,
    githubRepo: row.github_repo ?? null,
    githubBranch: row.github_branch ?? "main",
    vercelUrl: row.vercel_url ?? null,
    lastCommitSha: row.last_commit_sha ?? null,
    lastCommitMessage: row.last_commit_message ?? null,
    lastCommitAt: row.last_commit_at ?? null,
    lastGitSyncedAt: row.last_git_synced_at ?? null,
    relatedPageUrl: row.related_page_url,
    portfolioValue: row.portfolio_value,
    body: normalizeBody(row.body),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ideaToRow(idea: Idea): StudioIdeaRow {
  return {
    id: idea.id,
    title: idea.title,
    one_line_idea: idea.oneLineIdea,
    why_it_matters: idea.whyItMatters,
    trigger_source: idea.triggerSource,
    emotion_level: idea.emotionLevel,
    type: idea.type,
    priority: idea.priority,
    raw_input: idea.rawInput,
    related_project_id: idea.relatedProjectId,
    related_idea_id: idea.relatedIdeaId,
    subtasks: idea.subtasks,
    status: idea.status,
    suggested_next_step: idea.suggestedNextStep,
    github_issue_number: idea.githubIssueNumber,
    github_issue_url: idea.githubIssueUrl,
    github_labels: idea.githubLabels,
    created_at: idea.createdAt,
    updated_at: idea.updatedAt,
  };
}

export function rowToIdea(row: StudioIdeaRow): Idea {
  return {
    id: row.id,
    title: row.title,
    oneLineIdea: row.one_line_idea,
    whyItMatters: row.why_it_matters,
    triggerSource: row.trigger_source,
    emotionLevel: row.emotion_level as Idea["emotionLevel"],
    type: row.type as Idea["type"],
    priority: (row.priority as Idea["priority"]) ?? "P2",
    rawInput: row.raw_input ?? "",
    relatedProjectId: row.related_project_id,
    relatedIdeaId: row.related_idea_id ?? null,
    subtasks: normalizeSubtasks(row.subtasks),
    status: row.status as Idea["status"],
    suggestedNextStep: row.suggested_next_step ?? "",
    githubIssueNumber: row.github_issue_number ?? null,
    githubIssueUrl: row.github_issue_url ?? null,
    githubLabels: Array.isArray(row.github_labels) ? row.github_labels.map(String) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function evolutionToRow(log: EvolutionLog): StudioEvolutionRow {
  return {
    id: log.id,
    title: log.title,
    project_id: log.projectId,
    log_type: log.logType,
    before_text: log.before,
    after_text: log.after,
    reason: log.reason,
    decision: log.decision,
    created_at: log.createdAt,
  };
}

export function rowToEvolution(row: StudioEvolutionRow): EvolutionLog {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    logType: row.log_type as EvolutionLog["logType"],
    before: row.before_text,
    after: row.after_text,
    reason: row.reason,
    decision: row.decision,
    createdAt: row.created_at,
  };
}

export function taskToRow(task: StudioTask): StudioTaskRow {
  return {
    id: task.id,
    title: task.title,
    project_id: task.projectId,
    status: task.status,
    priority: task.priority,
    workload: task.workload,
    blocker: task.blocker,
    start_date: task.startDate,
    end_date: task.endDate,
    due_date: task.dueDate,
    estimate_hours: task.estimateHours,
    actual_hours: task.actualHours,
    completed_at: task.completedAt,
    progress_note: task.progressNote,
    completion_source: task.completionSource,
    git_commit_sha: task.gitCommitSha,
    git_commit_message: task.gitCommitMessage,
    source_idea_id: task.sourceIdeaId,
    created_at: new Date().toISOString(),
  };
}

export function rowToTask(row: StudioTaskRow): StudioTask {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    status: row.status as StudioTask["status"],
    priority: row.priority as StudioTask["priority"],
    workload: row.workload,
    blocker: row.blocker,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    dueDate: row.due_date,
    estimateHours: parseHours(row.estimate_hours),
    actualHours: parseHours(row.actual_hours),
    completedAt: row.completed_at ?? null,
    progressNote: row.progress_note ?? "",
    completionSource: (row.completion_source as StudioTask["completionSource"]) ?? null,
    gitCommitSha: row.git_commit_sha ?? null,
    gitCommitMessage: row.git_commit_message ?? null,
    sourceIdeaId: row.source_idea_id ?? null,
  };
}

export function assetToRow(asset: Asset): StudioAssetRow {
  return {
    id: asset.id,
    title: asset.title,
    project_id: asset.projectId,
    asset_type: asset.assetType,
    url: asset.url,
    storage_path: asset.storagePath,
    mime_type: asset.mimeType,
    note: asset.note,
    takeaway: asset.takeaway,
    risk: asset.risk,
    created_at: new Date().toISOString(),
  };
}

export function rowToAsset(row: StudioAssetRow): Asset {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    assetType: row.asset_type as Asset["assetType"],
    url: row.url,
    storagePath: row.storage_path ?? null,
    mimeType: row.mime_type ?? null,
    note: row.note,
    takeaway: row.takeaway,
    risk: row.risk,
  };
}
