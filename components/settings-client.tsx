"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createShareLinkAction, toggleShareLinkAction } from "@/lib/actions";
import type { ShareLink, RoleType } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

type ShareLinkWithToken = ShareLink & { plain_token?: string };

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = (await res.text()).trim();
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data?.error?.trim()) return data.error.trim();
  } catch {
    /* plain text */
  }
  return text.slice(0, 200);
}

function defaultNameFromFile(file: File): string {
  return file.name.replace(/\.(zip|html?)$/i, "") || "原型";
}

function defaultNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "外链原型";
  } catch {
    return "外链原型";
  }
}

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
  const [protoMsg, setProtoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function createLink(role: ShareLink["role"]) {
    const label =
      role === "readonly"
        ? "只读链接"
        : role === "test"
          ? "测试链接"
          : role === "admin"
            ? "管理员链接"
            : `${ROLE_LABELS[role as RoleType]}链接`;
    startTransition(async () => {
      await createShareLinkAction(projectId, role, label);
      router.refresh();
    });
  }

  function toggleLink(linkId: string, isActive: boolean) {
    startTransition(async () => {
      await toggleShareLinkAction(linkId, isActive, projectId);
      router.refresh();
    });
  }

  function uploadSelectedFile(file: File) {
    if (!/\.(zip|html?)$/i.test(file.name)) {
      setProtoMsg({ text: "仅支持 .html 或 .zip 文件", ok: false });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", defaultNameFromFile(file));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/prototype`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          setProtoMsg({ text: await readErrorMessage(res, "上传失败"), ok: false });
          return;
        }
        setProtoMsg({ text: "原型已保存", ok: true });
        router.refresh();
      } catch (err) {
        setProtoMsg({
          text: err instanceof Error ? err.message : "网络异常，请重试",
          ok: false,
        });
      }
    });
  }

  function saveExternalUrl() {
    const url = externalUrl.trim();
    if (!url) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("name", defaultNameFromUrl(url));
        fd.append("external_url", url);
        const res = await fetch(`/api/projects/${projectSlug}/prototype`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          setProtoMsg({ text: await readErrorMessage(res, "保存失败"), ok: false });
          return;
        }
        setProtoMsg({ text: "外链已保存", ok: true });
        setExternalUrl("");
        router.refresh();
      } catch (err) {
        setProtoMsg({
          text: err instanceof Error ? err.message : "网络异常，请重试",
          ok: false,
        });
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-semibold">原型来源</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.html,.htm,text/html,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadSelectedFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadSelectedFile(file);
          }}
          className={`mt-4 flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-sm transition-colors disabled:opacity-60 ${
            dragOver
              ? "border-slate-900 bg-slate-100 text-slate-900"
              : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <span className="font-medium text-slate-900">
            {pending ? "上传中…" : "点击选择或拖拽到此处"}
          </span>
          <span className="text-xs text-slate-400">支持 HTML / ZIP</span>
        </button>
        <div className="mt-4 max-w-md space-y-2">
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Figma / 网页链接"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !externalUrl.trim()}
            onClick={saveExternalUrl}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            保存外链
          </button>
        </div>
        {protoMsg ? (
          <p className={`mt-2 text-sm ${protoMsg.ok ? "text-green-600" : "text-red-600"}`}>
            {protoMsg.text}
          </p>
        ) : null}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">角色分享链接（免登录）</h2>
        <p className="mt-1 text-sm text-slate-500">
          成员免登录访问。测试链接可勾选验收项；所有角色可在项目内评论。Token 仅创建时显示一次。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["frontend", "backend", "embedded", "test", "product", "readonly"] as ShareLink["role"][]).map((role) => (
            <button
              key={role}
              type="button"
              disabled={pending}
              onClick={() => createLink(role)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              生成{role === "readonly" ? "只读" : role === "test" ? "测试" : role === "admin" ? "管理员" : ROLE_LABELS[role as RoleType]}链接
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
