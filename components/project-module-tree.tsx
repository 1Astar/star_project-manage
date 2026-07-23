"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProjectModuleAction,
  deleteProjectModuleAction,
  syncFeatureModulesToTreeAction,
  updateProjectModuleAction,
} from "@/lib/actions";
import type { ModuleNode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  projectSlug: string;
  modules: ModuleNode[];
  /** moduleId → 关联需求数 */
  reqCounts?: Record<string, number>;
  /** Studio 项目 id；有则显示「从功能板块导入」 */
  studioProjectId?: string | null;
};

type TreeNode = ModuleNode & { children: TreeNode[] };

function buildTree(modules: ModuleNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const m of modules) {
    map.set(m.id, { ...m, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortFn = (a: TreeNode, b: TreeNode) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh");
  for (const n of map.values()) n.children.sort(sortFn);
  roots.sort(sortFn);
  return roots;
}

export function ProjectModuleTree({
  projectId,
  projectSlug,
  modules,
  reqCounts = {},
  studioProjectId = null,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingUnder, setAddingUnder] = useState<string | "root" | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(modules), [modules]);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    setSyncMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setEditingId(null);
        setAddingUnder(null);
        setNewName("");
        setDraft("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function importFromFeatureModules() {
    if (!studioProjectId) return;
    setError(null);
    setSyncMsg(null);
    startTransition(async () => {
      try {
        const result = await syncFeatureModulesToTreeAction({
          studioProjectId,
          projectSlug,
        });
        setSyncMsg(
          `已导入：+${result.createdL1} 一级 / +${result.createdL2} 子模块（跳过 ${result.skippedExisting}）`
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "导入失败");
      }
    });
  }

  function startEdit(m: ModuleNode) {
    setEditingId(m.id);
    setDraft(m.name);
    setAddingUnder(null);
  }

  function submitEdit(moduleId: string) {
    if (!draft.trim()) return;
    run(() =>
      updateProjectModuleAction({ projectSlug, moduleId, name: draft.trim() })
    );
  }

  function submitAdd(parentId: string | null) {
    if (!newName.trim()) return;
    run(() =>
      createProjectModuleAction({
        projectId,
        projectSlug,
        name: newName.trim(),
        parentId,
      })
    );
  }

  function remove(moduleId: string, name: string) {
    if (!confirm(`删除模块「${name}」及其子模块？关联需求会解除模块绑定。`)) return;
    run(() => deleteProjectModuleAction({ projectSlug, moduleId }));
  }

  function renderNode(node: TreeNode, depth: number) {
    const isCollapsed = collapsed[node.id];
    const hasChildren = node.children.length > 0;
    const count =
      (reqCounts[node.id] ?? 0) +
      node.children.reduce((s, c) => s + (reqCounts[c.id] ?? 0), 0);

    return (
      <li key={node.id} className="relative">
        {depth > 0 ? (
          <span
            className="absolute left-[-12px] top-0 h-full w-px bg-slate-200"
            aria-hidden
          />
        ) : null}
        <div
          className={cn(
            "group flex items-center gap-1 rounded-md py-0.5 pr-1 hover:bg-slate-50",
            depth > 0 && "pl-1"
          )}
          style={{ paddingLeft: depth > 0 ? undefined : 0 }}
        >
          <button
            type="button"
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center text-[10px] text-slate-400",
              !hasChildren && "invisible"
            )}
            onClick={() =>
              setCollapsed((c) => ({ ...c, [node.id]: !c[node.id] }))
            }
            aria-label={isCollapsed ? "展开" : "收起"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>

          {editingId === node.id ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitEdit(node.id);
              }}
            >
              <input
                autoFocus
                className="min-w-0 flex-1 rounded border border-indigo-200 px-1.5 py-0.5 text-xs"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={pending}
              />
              <button type="submit" className="text-[11px] text-indigo-600" disabled={pending}>
                存
              </button>
              <button
                type="button"
                className="text-[11px] text-slate-400"
                onClick={() => setEditingId(null)}
              >
                取消
              </button>
            </form>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                {node.name}
                {count > 0 ? (
                  <span className="ml-1 font-normal text-slate-400">({count})</span>
                ) : null}
              </span>
              <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                {node.level === 1 ? (
                  <button
                    type="button"
                    title="添加子模块"
                    className="rounded px-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                    onClick={() => {
                      setAddingUnder(node.id);
                      setNewName("");
                      setEditingId(null);
                    }}
                  >
                    ＋
                  </button>
                ) : null}
                <button
                  type="button"
                  title="重命名"
                  className="rounded px-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                  onClick={() => startEdit(node)}
                >
                  改
                </button>
                <button
                  type="button"
                  title="删除"
                  className="rounded px-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-red-600"
                  onClick={() => remove(node.id, node.name)}
                >
                  删
                </button>
              </span>
            </>
          )}
        </div>

        {addingUnder === node.id ? (
          <form
            className="ml-6 mt-1 flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitAdd(node.id);
            }}
          >
            <input
              autoFocus
              placeholder="子模块名称"
              className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={pending}
            />
            <button type="submit" className="text-[11px] text-indigo-600" disabled={pending}>
              添加
            </button>
            <button
              type="button"
              className="text-[11px] text-slate-400"
              onClick={() => setAddingUnder(null)}
            >
              取消
            </button>
          </form>
        ) : null}

        {hasChildren && !isCollapsed ? (
          <ul className="ml-4 border-l border-slate-100 pl-3">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-800">模块</h3>
        <div className="flex items-center gap-2">
          {studioProjectId ? (
            <button
              type="button"
              className="text-[11px] font-medium text-slate-600 hover:underline"
              onClick={importFromFeatureModules}
              disabled={pending}
              title="按功能板块路径补缺导入（体系→一级，其余→子模块）"
            >
              从功能板块导入
            </button>
          ) : null}
          <button
            type="button"
            className="text-[11px] font-medium text-indigo-600 hover:underline"
            onClick={() => {
              setAddingUnder("root");
              setNewName("");
              setEditingId(null);
            }}
            disabled={pending}
          >
            + 一级模块
          </button>
        </div>
      </div>

      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      {syncMsg ? <p className="text-[11px] text-emerald-600">{syncMsg}</p> : null}

      {addingUnder === "root" ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            submitAdd(null);
          }}
        >
          <input
            autoFocus
            placeholder="一级模块名称，如「用户端」"
            className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={pending}
          />
          <button type="submit" className="text-[11px] text-indigo-600" disabled={pending}>
            添加
          </button>
          <button
            type="button"
            className="text-[11px] text-slate-400"
            onClick={() => setAddingUnder(null)}
          >
            取消
          </button>
        </form>
      ) : null}

      {tree.length === 0 && addingUnder !== "root" ? (
        <p className="text-[11px] text-slate-400">
          暂无模块。点「+ 一级模块」开始，再建子模块（最多两级）。
        </p>
      ) : (
        <ul className="max-h-[220px] space-y-0.5 overflow-y-auto text-xs">
          {tree.map((n) => renderNode(n, 0))}
        </ul>
      )}
    </div>
  );
}
