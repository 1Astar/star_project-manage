import type { LinkedViewSourceId } from "./config";

export type LinkedViewFieldMeta = {
  key: string;
  label: string;
};

export type LinkedViewSourceMeta = {
  id: LinkedViewSourceId;
  label: string;
  newHref: string;
  fields: LinkedViewFieldMeta[];
  columns: LinkedViewFieldMeta[];
};

const TITLE_FIELD: LinkedViewFieldMeta = { key: "title", label: "名称" };
const MODULE_FIELD: LinkedViewFieldMeta = { key: "module", label: "功能模块" };
const STATUS_FIELD: LinkedViewFieldMeta = { key: "status", label: "状态" };
const PRIORITY_FIELD: LinkedViewFieldMeta = { key: "priority", label: "优先级" };

export function linkedViewSources(projectSlug: string): LinkedViewSourceMeta[] {
  const p = `/projects/${projectSlug}`;
  return [
    {
      id: "requirement",
      label: "需求",
      newHref: `${p}/pool`,
      fields: [TITLE_FIELD, MODULE_FIELD, STATUS_FIELD, PRIORITY_FIELD, { key: "type", label: "类型" }],
      columns: [STATUS_FIELD, PRIORITY_FIELD],
    },
    {
      id: "bug",
      label: "Bug",
      newHref: `${p}/bugs?new=1`,
      fields: [TITLE_FIELD, MODULE_FIELD, STATUS_FIELD, PRIORITY_FIELD],
      columns: [STATUS_FIELD, PRIORITY_FIELD],
    },
    {
      id: "optimization",
      label: "优化建议",
      newHref: `${p}/bugs?new=1`,
      fields: [TITLE_FIELD, MODULE_FIELD, STATUS_FIELD, PRIORITY_FIELD],
      columns: [STATUS_FIELD, PRIORITY_FIELD],
    },
    {
      id: "learning",
      label: "知识点",
      newHref: `${p}/learning`,
      fields: [TITLE_FIELD, MODULE_FIELD, { key: "kind", label: "层级" }],
      columns: [{ key: "kind", label: "层级" }],
    },
    {
      id: "prd",
      label: "PRD",
      newHref: `${p}/prd`,
      fields: [TITLE_FIELD, MODULE_FIELD],
      columns: [MODULE_FIELD],
    },
    {
      id: "competitor",
      label: "竞品",
      newHref: `${p}/competitors`,
      fields: [TITLE_FIELD, MODULE_FIELD],
      columns: [MODULE_FIELD],
    },
  ];
}

export function linkedViewSourceMeta(
  projectSlug: string,
  id: LinkedViewSourceId
): LinkedViewSourceMeta | undefined {
  return linkedViewSources(projectSlug).find((s) => s.id === id);
}
