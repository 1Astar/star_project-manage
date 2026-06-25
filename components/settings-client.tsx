"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createShareLinkAction, toggleShareLinkAction } from "@/lib/actions";
import type { ShareLink, RoleType } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

type ShareLinkWithToken = ShareLink & { plain_token?: string };

export function SettingsClient({
  projectId,
  projectSlug,
  shareLinks,
}: {
  projectId: string;
  projectSlug: string;
  shareLinks: ShareLinkWithToken[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [protoMsg, setProtoMsg] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [protoName, setProtoName] = useState("原型");

  function createLink(role: RoleType) {
    startTransition(async () => {
      await createShareLinkAction(projectId, role, `${ROLE_LABELS[role]}链接`);
      router.refresh();
    });
  }

  function toggleLink(linkId: string, isActive: boolean) {
    startTransition(async () => {
      await toggleShareLinkAction(linkId, isActive, projectId);
      router.refresh();
    });
  }

  function uploadPrototype(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectSlug}/prototype`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setProtoMsg("上传失败");
        return;
      }
      setProtoMsg("原型已保存");
      router.refresh();
    });
  }

  function saveExternalUrl() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("name", protoName);
      fd.append("external_url", externalUrl);
      const res = await fetch(`/api/projects/${projectSlug}/prototype`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setProtoMsg("保存失败");
        return;
      }
      setProtoMsg("外链已保存");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-semibold">原型来源</h2>
        <form onSubmit={uploadPrototype} className="mt-4 space-y-3">
          <input
            name="name"
            placeholder="原型名称"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            name="file"
            type="file"
            accept=".zip,.html"
            className="w-full text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            上传 HTML/ZIP
          </button>
        </form>
        <div className="mt-4 space-y-2">
          <input
            value={protoName}
            onChange={(e) => setProtoName(e.target.value)}
            placeholder="外链名称"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Figma / 网页链接"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !externalUrl}
            onClick={saveExternalUrl}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            保存外链
          </button>
        </div>
        {protoMsg ? <p className="mt-2 text-sm text-green-600">{protoMsg}</p> : null}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">角色分享链接（免登录）</h2>
        <p className="mt-1 text-sm text-slate-500">
          成员首次访问填写显示名，只能更新对应角色任务。Token 仅创建时显示一次。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["frontend", "backend", "embedded", "test"] as const).map((role) => (
            <button
              key={role}
              type="button"
              disabled={pending}
              onClick={() => createLink(role)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              生成{ROLE_LABELS[role]}链接
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {shareLinks.map((link) => (
            <div key={link.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{link.label}</div>
                  <div className="text-sm text-slate-500">角色：{link.role}</div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleLink(link.id, !link.is_active)}
                  className="text-sm text-blue-600"
                >
                  {link.is_active ? "停用" : "启用"}
                </button>
              </div>
              {link.plain_token ? (
                <code className="mt-3 block overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/share/${link.plain_token}`
                    : `/share/${link.plain_token}`}
                </code>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Token 已哈希存储</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Excel 导入 / 导出</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`/projects/${projectSlug}/import`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            前往导入
          </a>
          <a
            href={`/api/projects/${projectSlug}/export`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            导出 Excel
          </a>
        </div>
      </section>
    </div>
  );
}
