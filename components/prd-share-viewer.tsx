"use client";

import { useMemo, useState } from "react";
import { annotateHtmlDiff } from "@/lib/prds/html-diff";
import { resolvePrototypeUrl } from "@/lib/prototypes/resolve-url";
import type { PrdReviewComment, ProjectPrd, Prototype } from "@/lib/types";
import { PrdEditorFrame } from "@/components/prd-editor-frame";

export function PrdShareViewer({
  prd,
  comments,
  prototypes,
}: {
  prd: ProjectPrd;
  comments: PrdReviewComment[];
  shareToken: string;
  prototypes: Prototype[];
}) {
  const [versionId, setVersionId] = useState<string | "current">("current");
  const [showDiff, setShowDiff] = useState(false);

  const html = useMemo(() => {
    const versions = prd.versions ?? [];
    if (versionId === "current") {
      if (!showDiff || !versions.length) return prd.html_content;
      const last = versions[versions.length - 1];
      return last
        ? annotateHtmlDiff(last.html_content, prd.html_content)
        : prd.html_content;
    }
    const version = versions.find((v) => v.id === versionId);
    if (!version) return prd.html_content;
    if (!showDiff) return version.html_content;
    const index = versions.findIndex((v) => v.id === version.id);
    const previous = index > 0 ? versions[index - 1] : null;
    if (!previous) return version.html_content;
    return annotateHtmlDiff(previous.html_content, version.html_content);
  }, [prd, versionId, showDiff]);

  const pages = useMemo(
    () => [
      {
        id: prd.id,
        title: prd.title,
        parentId: null as string | null,
        order: 0,
        expanded: true,
        content: html,
      },
      ...prd.linked_prototypes.flatMap((link, index) => {
        const proto = prototypes.find((p) => p.id === link.prototype_id);
        if (!proto) return [];
        const url = proto.external_url || resolvePrototypeUrl(proto.storage_path);
        return [
          {
            id: proto.id,
            title: `Prototype｜${proto.name}`,
            parentId: prd.id,
            order: index,
            expanded: true,
            content: `<h1>Prototype｜${proto.name}</h1>`,
            prototypeUrl: url || undefined,
          },
        ];
      }),
    ],
    [prd, prototypes, html]
  );

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">分享的 PRD</p>
          <h1 className="text-base font-semibold">{prd.title}</h1>
        </div>
        <select
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value as string | "current")}
        >
          <option value="current">当前稿</option>
          {(prd.versions ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showDiff}
            onChange={(e) => setShowDiff(e.target.checked)}
          />
          标注相对上一版改动
        </label>
      </header>
      <div className="min-h-0 flex-1">
        <PrdEditorFrame
          brand="Star PM"
          section={prd.module_path || "PRD"}
          html={html}
          pages={pages}
          activeId={prd.id}
          editable={false}
          review={false}
          revision={`${prd.id}:${versionId}:${showDiff}`}
        />
      </div>
      {comments.length ? (
        <aside className="max-h-40 overflow-auto border-t border-slate-200 bg-white px-4 py-2">
          <p className="text-xs font-medium text-slate-500">审阅评论</p>
          {comments.map((c) => (
            <p key={c.id} className="mt-1 text-xs text-slate-700">
              {c.anchor_text ? `「${c.anchor_text}」` : ""} {c.body}
            </p>
          ))}
        </aside>
      ) : null}
    </div>
  );
}
