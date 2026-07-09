"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirementCollabPanel } from "@/components/requirement-collab";
import { canShareRoleUpdateAcceptance, canShareRoleSubmitTest } from "@/lib/share-permissions";
import type {
  AcceptanceItem,
  Requirement,
  RequirementComment,
  RoleTask,
  ShareLink,
  TestRecord,
} from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { AppShell, StatusBadge } from "@/components/ui";

const SHARE_NAME_KEY = (token: string) => `star-pm-share-name-${token}`;

export function ShareRequirementPage({
  token,
  link,
  requirement,
  role_tasks,
  acceptance_items,
  comments,
  test_records,
}: {
  token: string;
  link: ShareLink;
  requirement: Requirement;
  role_tasks: RoleTask[];
  acceptance_items: AcceptanceItem[];
  comments: RequirementComment[];
  test_records: TestRecord[];
}) {
  const [actorName, setActorName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SHARE_NAME_KEY(token));
    if (saved?.trim()) {
      setActorName(saved);
      setReady(true);
    }
  }, [token]);

  const canEditAcceptance = canShareRoleUpdateAcceptance(link.role);
  const canSubmitTest = canShareRoleSubmitTest(link.role);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card w-full max-w-md space-y-4 p-6">
          <h1 className="text-lg font-bold">{requirement.title}</h1>
          <p className="text-sm text-slate-500">填写显示名后即可评论与核对验收项</p>
          <input
            value={actorName}
            onChange={(e) => setActorName(e.target.value)}
            placeholder="你的姓名"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <button
            type="button"
            disabled={!actorName.trim()}
            onClick={() => {
              sessionStorage.setItem(SHARE_NAME_KEY(token), actorName.trim());
              setReady(true);
            }}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            继续
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title={requirement.title}
      subtitle={`${link.label} · ${actorName}`}
      actions={<StatusBadge status={requirement.status} />}
    >
      <div className="mb-4">
        <Link href={`/share/${token}`} className="text-sm text-blue-600">
          ← 返回看板
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">需求描述</h2>
          {requirement.sub_function ? <p className="text-sm">{requirement.sub_function}</p> : null}
          {requirement.acceptance_criteria ? (
            <div>
              <div className="text-xs font-semibold text-slate-400">验收标准</div>
              <p className="mt-1 text-sm">{requirement.acceptance_criteria}</p>
            </div>
          ) : null}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">角色任务</h2>
          {role_tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span>
                {ROLE_LABELS[t.role]}
                {t.assignee ? ` · ${t.assignee}` : ""}
              </span>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </section>

        {test_records.length > 0 ? (
          <section className="card space-y-3 p-5 lg:col-span-2">
            <h2 className="font-semibold">测试记录</h2>
            {test_records.map((t) => (
              <div key={t.id} className="text-sm">
                <span className={t.passed ? "text-green-600" : "text-red-600"}>
                  {t.passed ? "通过" : "不通过"}
                </span>
                {" · "}
                {t.tester_name}
                {t.issue_description ? ` — ${t.issue_description}` : ""}
              </div>
            ))}
          </section>
        ) : null}
      </div>

      <div className="mt-6">
        <RequirementCollabPanel
          projectId={requirement.project_id}
          requirementId={requirement.id}
          acceptanceItems={acceptance_items}
          comments={comments}
          actorName={actorName}
          actorRole={link.role}
          shareToken={token}
          canSubmitTest={canSubmitTest}
          canEditAcceptance={canEditAcceptance}
        />
      </div>
    </AppShell>
  );
}
