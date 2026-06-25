"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimShareIdentityAction } from "@/lib/actions";
import { KanbanBoard } from "@/components/task-board";
import type { Requirement, RoleTask, ShareLink } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { AppShell } from "@/components/ui";

interface Bundle {
  project: { id: string; name: string; slug: string };
  requirements: Requirement[];
  role_tasks: RoleTask[];
}

export function ShareWorkspace({
  token,
  link,
  bundle,
}: {
  token: string;
  link: ShareLink;
  bundle: Bundle;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [ready, setReady] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roleFilter = link.role === "test" || link.role === "readonly" ? undefined : link.role;

  const visibleTasks = useMemo(() => {
    if (link.role === "readonly") return bundle.role_tasks;
    if (link.role === "test") return bundle.role_tasks;
    return bundle.role_tasks.filter((t) => t.role === link.role);
  }, [bundle.role_tasks, link.role]);

  function enterWorkspace() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await claimShareIdentityAction({
          shareToken: token,
          displayName: displayName.trim(),
        });
        if (result.updated > 0) {
          setClaimMsg(`已认领 ${result.updated} 个任务的负责人`);
        }
        setReady(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "进入失败");
      }
    });
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card w-full max-w-md space-y-4 p-6">
          <h1 className="text-lg font-bold">{bundle.project.name}</h1>
          <p className="text-sm text-slate-500">
            你正在通过 {link.label} 访问。请填写与项目名册一致的姓名，进入后将自动写入对应任务的负责人。
          </p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="你的姓名"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={!displayName.trim() || pending}
            onClick={enterWorkspace}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "验证中…" : "进入"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title={`${bundle.project.name} · ${link.label}`}
      subtitle={`角色：${ROLE_LABELS[link.role as keyof typeof ROLE_LABELS] ?? link.role} · ${displayName}`}
    >
      {claimMsg ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {claimMsg}
        </div>
      ) : null}
      <KanbanBoard
        requirements={bundle.requirements}
        tasks={visibleTasks}
        projectId={bundle.project.id}
        actorName={displayName}
        actorRole={link.role}
        roleFilter={roleFilter}
        shareToken={token}
      />
    </AppShell>
  );
}
