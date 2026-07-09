"use client";

import { useMemo, useState } from "react";
import { KanbanBoard } from "@/components/task-board";
import { ProjectCommentFeed } from "@/components/project-comments";
import type { Requirement, RequirementComment, RoleTask, ShareLink } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { AppShell } from "@/components/ui";

const SHARE_NAME_KEY = (token: string) => `star-pm-share-name-${token}`;

interface Bundle {
  project: { id: string; name: string; slug: string };
  requirements: Requirement[];
  role_tasks: RoleTask[];
  comments?: RequirementComment[];
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
  const [displayName, setDisplayName] = useState("");
  const [ready, setReady] = useState(false);

  const roleFilter = link.role === "test" || link.role === "readonly" ? undefined : link.role;

  const visibleTasks = useMemo(() => {
    if (link.role === "readonly") return bundle.role_tasks;
    if (link.role === "test") return bundle.role_tasks;
    return bundle.role_tasks.filter((t) => t.role === link.role);
  }, [bundle.role_tasks, link.role]);

  function enter() {
    const name = displayName.trim();
    if (!name) return;
    sessionStorage.setItem(SHARE_NAME_KEY(token), name);
    setReady(true);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card w-full max-w-md p-6 space-y-4">
          <h1 className="text-lg font-bold">{bundle.project.name}</h1>
          <p className="text-sm text-slate-500">
            你正在通过 {link.label} 访问。请填写显示名以便记录操作人与评论。
          </p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="你的姓名"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <button
            type="button"
            disabled={!displayName.trim()}
            onClick={enter}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            进入
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
      <p className="mb-4 text-sm text-slate-500">
        点击卡片标题进入需求详情：测试可勾选验收项，所有成员可评论。
      </p>
      <KanbanBoard
        requirements={bundle.requirements}
        tasks={visibleTasks}
        projectId={bundle.project.id}
        actorName={displayName}
        actorRole={link.role}
        roleFilter={roleFilter}
        shareToken={token}
      />
      <ProjectCommentFeed
        token={token}
        projectId={bundle.project.id}
        requirements={bundle.requirements}
        comments={bundle.comments ?? []}
        actorName={displayName}
        actorRole={link.role}
      />
    </AppShell>
  );
}
