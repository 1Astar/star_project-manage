"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMemberAction,
  deleteMemberAction,
  toggleMemberAction,
} from "@/lib/actions";
import type { ProjectMember, RoleType } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

const ROLE_OPTIONS: RoleType[] = [
  "frontend",
  "backend",
  "embedded",
  "test",
  "ui",
  "hardware",
  "algorithm",
  "product",
];

export function MembersRoster({
  projectId,
  projectSlug,
  members,
}: {
  projectId: string;
  projectSlug: string;
  members: ProjectMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [clearOnDelete, setClearOnDelete] = useState(false);

  function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createMemberAction({
          projectId,
          projectSlug,
          name,
          role: role || null,
        });
        setName("");
        setRole("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "添加失败");
      }
    });
  }

  function toggleActive(memberId: string, isActive: boolean) {
    startTransition(async () => {
      await toggleMemberAction({ memberId, isActive, projectSlug });
      router.refresh();
    });
  }

  function removeMember(memberId: string, memberName: string) {
    if (!confirm(`确定删除成员「${memberName}」？`)) return;
    startTransition(async () => {
      await deleteMemberAction({
        memberId,
        projectSlug,
        clearAssignees: clearOnDelete,
      });
      router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">项目成员名册</h2>
      <p className="mt-1 text-sm text-slate-500">
        分享链接首次进入时会校验姓名；匹配后自动写入对应角色任务的负责人（仅填空项）。
      </p>

      <form onSubmit={addMember} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">姓名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：张三"
            className="rounded-lg border border-slate-200 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">岗位（可选）</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleType | "")}
            className="rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">未指定</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          添加成员
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={clearOnDelete}
          onChange={(e) => setClearOnDelete(e.target.checked)}
        />
        删除成员时同时清空其任务负责人字段
      </label>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">姓名</th>
              <th className="px-4 py-2 font-medium">岗位</th>
              <th className="px-4 py-2 font-medium">状态</th>
              <th className="px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  暂无成员。名册为空时分享链接不校验姓名，仍可自由填写。
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {member.role ? ROLE_LABELS[member.role] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        member.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {member.is_active ? "启用" : "已停用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => toggleActive(member.id, !member.is_active)}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {member.is_active ? "停用" : "启用"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => removeMember(member.id, member.name)}
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
