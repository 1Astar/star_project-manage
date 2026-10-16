import { resolvePmProject } from "@/lib/bugs/resolve-pm";
import { listBugsByProject, getAllRequirementsBoard, getPoolBundle, getProjectBundle } from "@/lib/db/local-store";
import { listProjectInterviews } from "@/lib/interviews/store";
import { requirementLifecycleStatus } from "@/lib/requirement-status";
import { buildHoursTables } from "@/lib/export/hours-stats";
import type { ExportSheet } from "@/lib/export/table-format";
import {
  catalogToLabelMap,
} from "@/lib/bugs/bug-type-catalog";
import { loadBugTypeCatalog } from "@/lib/bugs/bug-type-catalog.server";
import {
  BUG_SEVERITY_LABELS,
  INTERVIEW_HYPOTHESIS_STATUS_LABELS,
  REQUIREMENT_TYPE_LABELS,
  TASK_STATUS_LABELS,
  type BugSeverity,
} from "@/lib/types";
import {
  getAllAssets,
  getAllEvolutionLogs,
  getAllIdeas,
  getAllProjects,
  getProjectAssets,
  getProjectChangeSessions,
  getProjectEvolution,
  getProjectIdeas,
  getProjectTasks,
  getProjectTitle,
} from "@/lib/studio/data";
import {
  EVOLUTION_TYPE_LABELS,
  IDEA_STATUS_LABELS,
  IDEA_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS as STUDIO_TASK_STATUS_LABELS,
} from "@/lib/studio/types";

export type TableExportKind =
  | "projects"
  | "ideas"
  | "requirements"
  | "requirements-all"
  | "bugs"
  | "interviews"
  | "evolution"
  | "hours"
  | "assets"
  | "studio-tasks"
  | "change-sessions";

export const TABLE_EXPORT_KINDS: TableExportKind[] = [
  "projects",
  "ideas",
  "requirements",
  "requirements-all",
  "bugs",
  "interviews",
  "evolution",
  "hours",
  "assets",
  "studio-tasks",
  "change-sessions",
];

const NEEDS_PROJECT = new Set<TableExportKind>([
  "requirements",
  "bugs",
  "interviews",
  "hours",
  "studio-tasks",
  "change-sessions",
]);

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "是" : "否";
  if (Array.isArray(v)) return v.filter(Boolean).join("；");
  return String(v);
}

function dt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN");
}

export async function loadExportSheets(opts: {
  kind: TableExportKind;
  project?: string | null;
}): Promise<{ filenameBase: string; sheets: ExportSheet[] }> {
  const kind = opts.kind;
  const projectKey = opts.project?.trim() || null;

  if (NEEDS_PROJECT.has(kind) && !projectKey) {
    throw new Error("该表需要指定项目");
  }

  if (kind === "projects") {
    const projects = await getAllProjects();
    return {
      filenameBase: "项目库",
      sheets: [
        {
          name: "项目库",
          headers: ["标题", "状态", "优先级", "定位", "当前阶段", "下一步", "GitHub", "创建时间"],
          rows: projects.map((p) => [
            p.title,
            PROJECT_STATUS_LABELS[p.status] ?? p.status,
            p.priority,
            p.positioning,
            p.currentStage,
            p.nextAction,
            p.githubRepo,
            dt(p.createdAt),
          ]),
        },
      ],
    };
  }

  if (kind === "ideas") {
    const ideas = await getAllIdeas();
    const filtered = projectKey
      ? ideas.filter((i) => i.relatedProjectId === projectKey)
      : ideas;
    const rows = [];
    for (const idea of filtered) {
      const projectName = idea.relatedProjectId
        ? await getProjectTitle(idea.relatedProjectId)
        : "";
      rows.push([
        idea.title,
        idea.oneLineIdea,
        IDEA_TYPE_LABELS[idea.type] ?? idea.type,
        idea.priority,
        IDEA_STATUS_LABELS[idea.status] ?? idea.status,
        projectName,
        idea.relatedModule,
        idea.suggestedNextStep,
        idea.whyItMatters,
        dt(idea.occurredAt),
        dt(idea.completedAt),
      ]);
    }
    return {
      filenameBase: "灵感",
      sheets: [
        {
          name: "灵感",
          headers: [
            "标题",
            "一句话",
            "类型",
            "优先级",
            "状态",
            "项目",
            "板块",
            "下一步",
            "为什么值得做",
            "产生时间",
            "完成时间",
          ],
          rows,
        },
      ],
    };
  }

  if (kind === "requirements-all") {
    const { items } = await getAllRequirementsBoard();
    return {
      filenameBase: "需求总览",
      sheets: [
        {
          name: "需求总览",
          headers: ["项目", "需求", "类型", "状态", "优先级", "下一步"],
          rows: items.map((item) => [
            item.project_name,
            item.requirement.title,
            REQUIREMENT_TYPE_LABELS[item.requirement.type] ?? item.requirement.type,
            requirementLifecycleStatus(item.requirement),
            item.requirement.priority ?? "",
            item.requirement.next_step ?? "",
          ]),
        },
      ],
    };
  }

  if (kind === "evolution") {
    const logs = projectKey
      ? await getProjectEvolution(projectKey)
      : await getAllEvolutionLogs();
    const rows = [];
    for (const log of logs) {
      const projectName = await getProjectTitle(log.projectId);
      rows.push([
        projectName,
        log.title,
        EVOLUTION_TYPE_LABELS[log.logType] ?? log.logType,
        log.module,
        log.releaseTag,
        log.before,
        log.after,
        log.reason,
        log.decision,
        dt(log.workStartedAt),
        dt(log.workFinishedAt),
        dt(log.createdAt),
      ]);
    }
    return {
      filenameBase: "演进记录",
      sheets: [
        {
          name: "演进",
          headers: [
            "项目",
            "标题",
            "类型",
            "板块",
            "版本",
            "变化前",
            "变化后",
            "原因",
            "结论",
            "开始",
            "结束",
            "记录时间",
          ],
          rows,
        },
      ],
    };
  }

  if (kind === "assets") {
    const assets = projectKey ? await getProjectAssets(projectKey) : await getAllAssets();
    const rows = [];
    for (const a of assets) {
      rows.push([
        await getProjectTitle(a.projectId),
        a.title,
        a.assetType,
        a.url,
        a.note,
        a.takeaway,
        a.risk,
      ]);
    }
    return {
      filenameBase: "资料",
      sheets: [
        {
          name: "资料",
          headers: ["项目", "标题", "类型", "链接", "备注", "收获", "风险"],
          rows,
        },
      ],
    };
  }

  const { pm } = await resolvePmProject(projectKey!);
  const studioId = projectKey;

  if (kind === "requirements") {
    if (!pm) throw new Error("项目未接入需求库");
    const pool = await getPoolBundle(pm.id);
    const reqs = pool?.poolRequirements ?? [];
    return {
      filenameBase: `${pm.name}-需求`,
      sheets: [
        {
          name: "需求",
          headers: [
            "需求名称",
            "类型",
            "状态",
            "优先级",
            "下一步",
            "需求内容",
            "验收标准",
            "指派",
            "工时",
            "提出时间",
            "完成时间",
          ],
          rows: reqs.map((r) => [
            r.title,
            REQUIREMENT_TYPE_LABELS[r.type] ?? r.type,
            requirementLifecycleStatus(r),
            r.priority ?? "",
            r.next_step ?? "",
            r.detail_work ?? "",
            r.acceptance_criteria ?? "",
            cell(r.assignees),
            r.product_estimate_hours ?? r.direct_hours ?? "",
            dt(r.submitted_at),
            dt(r.completed_at),
          ]),
        },
      ],
    };
  }

  if (kind === "bugs") {
    if (!pm) throw new Error("项目未接入需求库");
    const [bugs, bugTypeCatalog] = await Promise.all([
      listBugsByProject(pm.id),
      loadBugTypeCatalog(),
    ]);
    const bugTypeLabels = catalogToLabelMap(bugTypeCatalog);
    return {
      filenameBase: `${pm.name}-Bug`,
      sheets: [
        {
          name: "Bug",
          headers: ["标题", "严重", "类型", "状态", "指派", "描述", "重现步骤", "优化建议", "创建时间"],
          rows: bugs.map((b) => [
            b.title,
            BUG_SEVERITY_LABELS[(b.severity ?? 3) as BugSeverity],
            bugTypeLabels[b.bug_type] ?? b.bug_type,
            TASK_STATUS_LABELS[b.status],
            b.assignee,
            b.description,
            b.repro_steps,
            b.suggestion,
            dt(b.created_at),
          ]),
        },
      ],
    };
  }

  if (kind === "interviews") {
    if (!pm) throw new Error("项目未接入需求库");
    const interviews = await listProjectInterviews(pm.id);
    return {
      filenameBase: `${pm.name}-访谈`,
      sheets: [
        {
          name: "访谈",
          headers: ["标题", "对象", "时间", "记录", "产品判断", "假设"],
          rows: interviews.map((i) => [
            i.title,
            i.interviewee,
            dt(i.interviewed_at),
            i.record_notes,
            i.product_judgment,
            i.hypotheses
              .map(
                (h) =>
                  `${h.statement}（${INTERVIEW_HYPOTHESIS_STATUS_LABELS[h.status] ?? h.status}）`
              )
              .join("；"),
          ]),
        },
      ],
    };
  }

  if (kind === "hours") {
    if (!pm) throw new Error("项目未接入需求库");
    const bundle = await getProjectBundle(pm.id);
    if (!bundle) throw new Error("项目不存在");
    const stats = buildHoursTables(bundle.requirements, bundle.role_tasks, bundle.modules);
    return {
      filenameBase: `${pm.name}-工时`,
      sheets: [
        {
          name: "按岗位",
          headers: ["岗位", "任务数", "预估工时", "实际工时", "偏差"],
          rows: stats.byRole.map((r) => [r.label, r.count, r.estimate, r.actual, r.delta]),
        },
        {
          name: "按需求",
          headers: ["需求", "任务数", "预估工时", "备注"],
          rows: stats.byRequirement.map((r) => [r.title, r.taskCount, r.estimate, r.note]),
        },
      ],
    };
  }

  if (kind === "studio-tasks") {
    const tasks = await getProjectTasks(studioId!);
    const name = (await getProjectTitle(studioId!)) || "项目";
    return {
      filenameBase: `${name}-任务`,
      sheets: [
        {
          name: "Studio任务",
          headers: ["标题", "状态", "优先级", "预估", "实际", "阻塞", "备注", "完成时间"],
          rows: tasks.map((t) => [
            t.title,
            STUDIO_TASK_STATUS_LABELS[t.status] ?? t.status,
            t.priority,
            t.estimateHours,
            t.actualHours,
            t.blocker,
            t.progressNote,
            dt(t.completedAt),
          ]),
        },
      ],
    };
  }

  if (kind === "change-sessions") {
    const sessions = await getProjectChangeSessions(studioId!);
    const ideas = await getProjectIdeas(studioId!);
    const name = (await getProjectTitle(studioId!)) || "项目";
    return {
      filenameBase: `${name}-变更会话`,
      sheets: [
        {
          name: "变更会话",
          headers: ["日期", "板块", "目标", "原因", "结果", "验收", "状态"],
          rows: sessions.map((s) => [
            s.day,
            s.module,
            s.goal,
            s.reason,
            s.result,
            s.humanAcceptance,
            s.status,
          ]),
        },
        {
          name: "灵感",
          headers: ["标题", "状态", "优先级", "下一步"],
          rows: ideas.map((i) => [
            i.title,
            IDEA_STATUS_LABELS[i.status] ?? i.status,
            i.priority,
            i.suggestedNextStep,
          ]),
        },
      ],
    };
  }

  throw new Error(`未知导出类型：${kind}`);
}

export function isTableExportKind(raw: string): raw is TableExportKind {
  return (TABLE_EXPORT_KINDS as string[]).includes(raw);
}
