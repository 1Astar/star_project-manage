"use server";

import { revalidatePath } from "next/cache";
import { assertNotViewerWrite } from "@/lib/auth/require-admin";
import {
  createBug,
  createPoolRequirement,
  getProjects,
  listProjectModules,
  updateRequirement,
} from "@/lib/db/local-store";
import type { LinkedViewFilter, LinkedViewSourceId } from "./config";
import { moduleHintFromFilters, titleHintFromFilters } from "./filter-hints";
import {
  joinModulePath,
  peekModuleFields,
  splitModulePath,
  withPartitionTag,
} from "./module-path";
import { applyTitleHintToRow, linkedViewTitleHint } from "./title-hints";
import type { TitleKind } from "./title-hints";
import { optimizeLinkedViewTitle } from "./optimize-title";
import type { LinkedViewPeekKind, LinkedViewRow } from "./query";
import { TASK_STATUS_LABELS } from "@/lib/types";

function revalidateLinked(projectSlug: string, extra?: string[]) {
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/overview`);
  revalidatePath(`/projects/${projectSlug}/modules`);
  for (const p of extra ?? []) revalidatePath(p);
}

function findL1ModuleId(
  modules: Array<{ id: string; name: string; level: number; parent_id: string | null }>,
  hint: string
): string | null {
  const n = hint.trim();
  if (!n) return null;
  const exact = modules.find((m) => m.level === 1 && m.name.trim() === n);
  if (exact) return exact.id;
  const contains = modules.find(
    (m) => m.level === 1 && m.name.trim().includes(n)
  );
  return contains?.id ?? null;
}

function findL2ModuleId(
  modules: Array<{ id: string; name: string; parent_id: string | null }>,
  l1Id: string | null,
  hint: string
): string | null {
  const n = hint.trim();
  if (!n || !l1Id) return null;
  const kids = modules.filter((m) => m.parent_id === l1Id);
  const exact = kids.find((m) => m.name.trim() === n);
  if (exact) return exact.id;
  const contains = kids.find((m) => m.name.trim().includes(n));
  return contains?.id ?? null;
}

function namingFromFields(f: Record<string, string>) {
  const split = splitModulePath(f.module_path || f.module || "");
  const l1 = split.l1;
  const l2 = (f.partition || split.l2).trim();
  return { l1, l2, path: joinModulePath(l1, l2) };
}

async function resolveProjectId(
  slug: string,
  knownId?: string
): Promise<string | null> {
  if (knownId?.trim()) return knownId.trim();
  const projects = await getProjects();
  const hit = projects.find((p) => p.slug === slug || p.id === slug);
  return hit?.id ?? null;
}

export async function saveLinkedViewPeekAction(input: {
  projectSlug: string;
  projectId?: string;
  kind: LinkedViewPeekKind;
  id: string;
  title: string;
  fields: Record<string, string>;
}) {
  assertNotViewerWrite();
  const title = input.title.trim() || "无标题";
  const f = input.fields;
  const slug = input.projectSlug;

  if (input.kind === "learning") {
    const { updateProjectLearningNote } = await import("@/lib/learning-notes/store");
    await updateProjectLearningNote(input.id, {
      title,
      why_text: f.why_text,
      principle: f.principle,
      protocol: f.protocol,
      tech_background: f.tech_background,
      product_thinking: f.product_thinking,
    });
    revalidateLinked(slug, [`/projects/${slug}/learning`]);
    return;
  }
  if (input.kind === "bug") {
    const { updateBug } = await import("@/lib/db/local-store");
    const named = namingFromFields(f);
    await updateBug(input.id, {
      title,
      repro_steps: f.repro_steps,
      expected_result: f.expected_result,
      actual_result: f.actual_result,
      description: f.description || null,
      suggestion: f.suggestion || null,
      module_path: named.path || null,
    });
    revalidateLinked(slug, [
      `/projects/${slug}/bugs`,
      `/projects/${slug}/bugs/${input.id}`,
    ]);
    return;
  }
  if (input.kind === "competitor") {
    const { updateCompetitorEntry } = await import("@/lib/competitors/store");
    const named = namingFromFields(f);
    await updateCompetitorEntry(input.id, {
      title,
      summary: f.summary,
      url: f.url || null,
      module_path: named.path || null,
    });
    revalidateLinked(slug, [`/projects/${slug}/competitors`]);
    return;
  }
  if (input.kind === "prd") {
    const { updateProjectPrd } = await import("@/lib/prds/store");
    const named = namingFromFields(f);
    await updateProjectPrd(input.id, {
      title,
      module_path: named.path || null,
    });
    revalidateLinked(slug, [`/projects/${slug}/prd`]);
    return;
  }
  const projectId = await resolveProjectId(slug, input.projectId);
  const named = namingFromFields(f);
  let module_l1_id: string | null | undefined;
  let module_l2_id: string | null | undefined;
  if (projectId) {
    const modules = await listProjectModules(projectId);
    module_l1_id = findL1ModuleId(modules, named.l1);
    module_l2_id = findL2ModuleId(modules, module_l1_id, named.l2);
  }
  const tags = named.l2
    ? withPartitionTag(f.tags ?? "", named.l2)
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  await updateRequirement(
    input.id,
    {
      title,
      detail_work: f.detail_work || null,
      acceptance_criteria: f.acceptance_criteria || null,
      priority: f.priority || null,
      ...(module_l1_id !== undefined ? { module_l1_id } : {}),
      ...(module_l2_id !== undefined ? { module_l2_id } : {}),
      ...(tags ? { tags } : {}),
    },
    { name: "产品", role: "admin" }
  );
  revalidateLinked(slug, [
    `/projects/${slug}/pool`,
    `/projects/${slug}/requirements/${input.id}`,
  ]);
}

export async function createLinkedViewRowAction(input: {
  projectId: string;
  projectSlug: string;
  source: LinkedViewSourceId;
  filters: LinkedViewFilter[];
}): Promise<LinkedViewRow> {
  assertNotViewerWrite();
  const slug = input.projectSlug;
  const moduleHint = moduleHintFromFilters(input.filters);
  const naming = linkedViewTitleHint(input.source, moduleHint);
  const fromFilter = titleHintFromFilters(input.filters);
  const title = fromFilter || naming.draftTitle || "无标题";
  const route = slug;

  function decorate(row: LinkedViewRow): LinkedViewRow {
    return applyTitleHintToRow(row, input.source);
  }

  if (input.source === "requirement") {
    const modules = await listProjectModules(input.projectId);
    const l1 = findL1ModuleId(modules, moduleHint);
    const req = await createPoolRequirement(input.projectId, {
      title,
      module_l1_id: l1,
    });
    revalidateLinked(slug, [`/projects/${slug}/pool`, `/projects/${slug}/tasks`]);
    return decorate({
      id: req.id,
      title: req.title,
      href: `/projects/${route}/requirements/${req.id}`,
      cells: { module: moduleHint, status: "", priority: req.priority ?? "" },
      peekKind: "requirement",
      fields: [
        ...peekModuleFields(moduleHint),
        { key: "tags", label: "标签", value: "" },
        { key: "detail_work", label: "详情", value: "", multiline: true },
        { key: "acceptance_criteria", label: "验收", value: "", multiline: true },
        { key: "priority", label: "优先级", value: req.priority ?? "" },
      ],
    });
  }

  if (input.source === "bug" || input.source === "optimization") {
    const bug = await createBug({
      project_id: input.projectId,
      title,
      module_path: moduleHint || null,
      suggestion: input.source === "optimization" ? "（新优化）" : undefined,
    });
    revalidateLinked(slug, [
      `/projects/${slug}/bugs`,
      `/projects/${slug}/bugs/${bug.id}`,
    ]);
    return decorate({
      id: bug.id,
      title: bug.title,
      href: `/projects/${route}/bugs/${bug.id}`,
      badge: TASK_STATUS_LABELS[bug.status] ?? bug.status,
      cells: {
        module: bug.module_path ?? "",
        status: TASK_STATUS_LABELS[bug.status] ?? bug.status,
        priority: bug.priority ?? "",
      },
      peekKind: "bug",
      fields: [
        { key: "repro_steps", label: "操作步骤", value: "", multiline: true },
        { key: "expected_result", label: "预期", value: "", multiline: true },
        { key: "actual_result", label: "实际 / 现状", value: "", multiline: true },
        { key: "description", label: "描述 / 证据", value: "", multiline: true },
        {
          key: "suggestion",
          label: "优化建议",
          value: bug.suggestion ?? "",
          multiline: true,
        },
        ...peekModuleFields(bug.module_path ?? ""),
      ],
    });
  }

  if (input.source === "learning") {
    const { listProjectLearningNotes, createProjectLearningNote } = await import(
      "@/lib/learning-notes/store"
    );
    const notes = await listProjectLearningNotes(input.projectId);
    const section = moduleHint
      ? notes.find(
          (n) => n.kind === "section" && n.title.trim() === moduleHint
        )
      : undefined;
    const row = await createProjectLearningNote({
      project_id: input.projectId,
      title,
      kind: "topic",
      parent_id: section?.id ?? null,
    });
    revalidateLinked(slug, [`/projects/${slug}/learning`]);
    return decorate({
      id: row.id,
      title: row.title,
      href: `/projects/${route}/learning`,
      badge: "主题",
      cells: { module: section?.title ?? moduleHint, kind: "主题" },
      peekKind: "learning",
      fields: [
        ...peekModuleFields(section?.title ?? moduleHint),
        { key: "why_text", label: "为什么", value: "", multiline: true },
        { key: "principle", label: "原理 / 要点", value: "", multiline: true },
        { key: "protocol", label: "协议", value: "", multiline: true },
        { key: "tech_background", label: "技术背景", value: "", multiline: true },
        { key: "product_thinking", label: "产品思考", value: "", multiline: true },
      ],
    });
  }

  if (input.source === "prd") {
    const { createProjectPrd } = await import("@/lib/prds/store");
    const prd = await createProjectPrd({
      project_id: input.projectId,
      title,
      module_path: moduleHint || null,
    });
    revalidateLinked(slug, [`/projects/${slug}/prd`]);
    return decorate({
      id: prd.id,
      title: prd.title,
      href: `/projects/${route}/prd`,
      cells: { module: prd.module_path ?? "" },
      peekKind: "prd",
      fields: peekModuleFields(prd.module_path ?? ""),
    });
  }

  const { createCompetitorEntry } = await import("@/lib/competitors/store");
  const c = await createCompetitorEntry({
    project_id: input.projectId,
    title,
    module_path: moduleHint || null,
  });
  revalidateLinked(slug, [`/projects/${slug}/competitors`]);
  return decorate({
    id: c.id,
    title: c.title,
    href: `/projects/${route}/competitors`,
    cells: { module: c.module_path ?? "" },
    peekKind: "competitor",
    fields: [
      { key: "summary", label: "摘要", value: "", multiline: true },
      { key: "url", label: "外链", value: "" },
      ...peekModuleFields(c.module_path ?? ""),
    ],
  });
}

export async function optimizeLinkedViewTitleAction(input: {
  kind: TitleKind;
  title: string;
  l1: string;
  l2: string;
  context?: string;
}) {
  assertNotViewerWrite();
  const { serverOpenAiCredentials } = await import(
    "@/lib/studio/ai/openai-server-settings"
  );
  const credentials = await serverOpenAiCredentials();
  return optimizeLinkedViewTitle(input, credentials);
}
