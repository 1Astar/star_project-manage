"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/task-board";
import { resolvePrototypeUrl } from "@/lib/prototypes/resolve-url";
import type { Prototype, Requirement, RoleTask } from "@/lib/types";

export function PrototypeWorkspace({
  projectId,
  projectSlug,
  requirements,
  tasks,
  prototypes,
}: {
  projectId: string;
  projectSlug: string;
  requirements: Requirement[];
  tasks: RoleTask[];
  prototypes: Prototype[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedReqId, setSelectedReqId] = useState(requirements[0]?.id ?? "");
  const [protoName, setProtoName] = useState("原型");
  const [externalUrl, setExternalUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const selectedReq = requirements.find((r) => r.id === selectedReqId);
  const prototype = prototypes.find((p) => p.requirement_id === selectedReqId) ?? prototypes[0];
  const prototypeSrc = resolvePrototypeUrl(prototype?.storage_path);
  const hasPreview = Boolean(prototype?.external_url || prototypeSrc);

  const sidebarTasks = useMemo(
    () => tasks.filter((t) => t.requirement_id === selectedReqId),
    [tasks, selectedReqId]
  );

  function postPrototype(fd: FormData, okText: string) {
    if (selectedReqId) fd.append("requirement_id", selectedReqId);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectSlug}/prototype`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setMsg(okText.includes("外链") ? "保存失败" : "上传失败");
        return;
      }
      setMsg(okText);
      setShowUpload(false);
      setExternalUrl("");
      router.refresh();
    });
  }

  function uploadFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("name")) fd.set("name", protoName || "原型");
    postPrototype(fd, "原型已上传");
  }

  function saveExternalUrl() {
    if (!externalUrl.trim()) return;
    const fd = new FormData();
    fd.append("name", protoName || "原型");
    fd.append("external_url", externalUrl.trim());
    postPrototype(fd, "外链已保存");
  }

  const uploadPanel = (
    <div className="w-full max-w-md space-y-4 text-left">
      <form onSubmit={uploadFile} className="space-y-3">
        <input
          name="name"
          value={protoName}
          onChange={(e) => setProtoName(e.target.value)}
          placeholder="原型名称"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          name="file"
          type="file"
          accept=".zip,.html"
          required
          className="w-full text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "上传中…" : "上传 HTML / ZIP"}
        </button>
      </form>
      <div className="relative text-center text-xs text-slate-400">
        <span className="bg-slate-100 px-2">或</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-slate-200" />
      </div>
      <div className="space-y-2">
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
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          保存外链
        </button>
      </div>
      {msg ? <p className="text-center text-sm text-green-600">{msg}</p> : null}
    </div>
  );

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-sm font-medium">
          <div>
            原型预览
            {prototype?.external_url ? (
              <a
                href={prototype.external_url}
                target="_blank"
                rel="noreferrer"
                className="ml-3 font-normal text-blue-600"
              >
                在新窗口打开
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowUpload((v) => !v);
              setMsg(null);
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-normal text-slate-600 hover:bg-slate-50"
          >
            {showUpload ? "收起" : hasPreview ? "更换原型" : "上传原型"}
          </button>
        </div>
        <div className="flex h-[calc(70vh-48px)] items-center justify-center bg-slate-100 p-6">
          {showUpload || !hasPreview ? (
            <div className="flex max-w-md flex-col items-center text-center text-sm text-slate-500">
              {!hasPreview ? (
                <p className="mb-4">尚未上传 HTML 原型或关联外链。可在本页直接上传或填写链接。</p>
              ) : (
                <p className="mb-4 text-slate-600">上传新文件或填写外链，将绑定到当前所选需求。</p>
              )}
              {uploadPanel}
            </div>
          ) : prototype?.external_url ? (
            <iframe
              title="prototype"
              src={prototype.external_url}
              sandbox="allow-scripts allow-same-origin"
              className="h-full w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <iframe
              title="prototype"
              src={prototypeSrc}
              sandbox="allow-scripts allow-same-origin"
              className="h-full w-full rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="card p-4">
          <label className="text-sm font-medium text-slate-700">绑定需求</label>
          <select
            value={selectedReqId}
            onChange={(e) => setSelectedReqId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {requirements.length === 0 ? (
              <option value="">暂无需求</option>
            ) : (
              requirements.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.title}
                </option>
              ))
            )}
          </select>
          {selectedReq?.acceptance_criteria ? (
            <p className="mt-3 text-sm text-slate-600">{selectedReq.acceptance_criteria}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          {sidebarTasks.length > 0 ? (
            <KanbanBoard
              requirements={requirements.filter((r) => r.id === selectedReqId)}
              tasks={sidebarTasks}
              projectId={projectId}
              actorName="开发"
            />
          ) : (
            <div className="card p-4 text-sm text-slate-500">该需求暂无角色任务</div>
          )}
        </div>
      </section>
    </div>
  );
}
