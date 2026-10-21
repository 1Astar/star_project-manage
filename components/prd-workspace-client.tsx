"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFeatureModuleFromPrdAction,
  addPrdCommentAction,
  createPrdAction,
  deletePrdAction,
  linkPrototypeToPrdAction,
  updatePrdAction,
} from "@/lib/actions";
import { annotateHtmlDiff } from "@/lib/prds/html-diff";
import {
  downloadPrdHtmlAndMarkdown,
  downloadPrdMarkdown,
  downloadStandalonePrd,
} from "@/lib/prds/export-standalone";
import { resolvePrototypeUrl } from "@/lib/prototypes/resolve-url";
import type {
  PrdReviewComment,
  ProjectPrd,
  Prototype,
} from "@/lib/types";
import {
  PrdEditorFrame,
  type PrdHostComment,
  type PrdHostPage,
} from "@/components/prd-editor-frame";

export function PrdWorkspaceClient({
  projectId,
  projectSlug,
  projectTitle,
  studioProjectId,
  featureModules,
  initialPrds,
  prototypes,
  initialCommentsByPrd,
}: {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  studioProjectId: string | null;
  featureModules: string[];
  initialPrds: ProjectPrd[];
  prototypes: Prototype[];
  initialCommentsByPrd: Record<string, PrdReviewComment[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prds, setPrds] = useState(initialPrds);
  const [commentsByPrd, setCommentsByPrd] = useState(initialCommentsByPrd);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newModule, setNewModule] = useState(featureModules[0] ?? "");
  const [suggest, setSuggest] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [viewVersionId, setViewVersionId] = useState<string | "current">("current");
  const [draftHtml, setDraftHtml] = useState("");
  const [commentsOpenTick, setCommentsOpenTick] = useState(0);
  const [shareHint, setShareHint] = useState("");
  const saveTimerRef = useRef<number | null>(null);
  const syncedCommentIdsRef = useRef<Set<string>>(new Set());

  const selected = useMemo(
    () => prds.find((p) => p.id === openId) ?? null,
    [prds, openId]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectPrd[]>();
    for (const prd of prds) {
      const key = prd.module_path?.trim() || "未分板块";
      const list = map.get(key) ?? [];
      list.push(prd);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [prds]);

  const currentHtml = selected
    ? draftHtml || selected.html_content
    : "";

  const editorHtml = useMemo(() => {
    if (!selected) return "";
    const versions = selected.versions ?? [];
    if (viewVersionId === "current") {
      if (!showDiff || !versions.length) return currentHtml;
      const last = versions[versions.length - 1];
      if (!last) return currentHtml;
      return annotateHtmlDiff(last.html_content, currentHtml);
    }
    const version = versions.find((v) => v.id === viewVersionId);
    if (!version) return selected.html_content;
    if (!showDiff) return version.html_content;
    const index = versions.findIndex((v) => v.id === version.id);
    const previous = index > 0 ? versions[index - 1] : null;
    if (!previous) return version.html_content;
    return annotateHtmlDiff(previous.html_content, version.html_content);
  }, [selected, viewVersionId, currentHtml, showDiff]);

  const editingCurrent = viewVersionId === "current" && !showDiff;

  const diffAgainstLabel = useMemo(() => {
    const vers = selected?.versions ?? [];
    if (!showDiff || !vers.length) return null;
    if (viewVersionId === "current") {
      return vers[vers.length - 1]?.label ?? null;
    }
    const index = vers.findIndex((v) => v.id === viewVersionId);
    if (index <= 0) return null;
    return vers[index - 1]?.label ?? null;
  }, [showDiff, selected?.versions, viewVersionId]);

  const hostPages: PrdHostPage[] = useMemo(() => {
    if (!selected) return [];
    const pages: PrdHostPage[] = [
      {
        id: selected.id,
        title: selected.title,
        parentId: null,
        order: 0,
        expanded: true,
        content: editorHtml,
      },
    ];
    selected.linked_prototypes.forEach((link, index) => {
      const proto = prototypes.find((p) => p.id === link.prototype_id);
      if (!proto) return;
      const url = proto.external_url || resolvePrototypeUrl(proto.storage_path);
      pages.push({
        id: proto.id,
        title: `Prototype｜${proto.name}`,
        parentId: selected.id,
        order: index,
        expanded: true,
        content: `<h1>Prototype｜${proto.name}</h1><p>${link.note || "在新窗口打开原型"}</p>`,
        prototypeUrl: url || undefined,
      });
    });
    return pages;
  }, [selected, prototypes, editorHtml]);

  const openPrd = (prd: ProjectPrd, pageId?: string) => {
    setOpenId(prd.id);
    setActivePageId(pageId ?? prd.id);
    setDraftHtml(prd.html_content);
    setViewVersionId("current");
    setSuggest(false);
    setShareHint("");
    syncedCommentIdsRef.current = new Set(
      (commentsByPrd[prd.id] ?? []).map((c) => c.id)
    );
  };

  const hostComments: PrdHostComment[] = useMemo(() => {
    if (!selected) return [];
    return (commentsByPrd[selected.id] ?? []).map((c) => ({
      id: c.id,
      quote: c.anchor_text,
      text: c.body,
      createdAt: c.created_at,
    }));
  }, [selected, commentsByPrd]);

  const onCommentsChange = useCallback(
    (comments: PrdHostComment[]) => {
      if (!selected) return;
      const prdId = selected.id;
      startTransition(async () => {
        const existing = commentsByPrd[prdId] ?? [];
        const byId = new Map(existing.map((c) => [c.id, c]));
        for (const comment of comments) {
          if (byId.has(comment.id) || syncedCommentIdsRef.current.has(comment.id)) {
            continue;
          }
          try {
            const row = await addPrdCommentAction({
              prdId,
              projectId,
              projectSlug,
              body: comment.text,
              anchorText: comment.quote,
            });
            syncedCommentIdsRef.current.add(row.id);
            syncedCommentIdsRef.current.add(comment.id);
            setCommentsByPrd((prev) => ({
              ...prev,
              [prdId]: [...(prev[prdId] ?? []), row],
            }));
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "评论保存失败");
          }
        }
      });
    },
    [selected, commentsByPrd, projectId, projectSlug]
  );

  function shareUrl(prd: ProjectPrd) {
    if (!prd.share_token || typeof window === "undefined") return "";
    return `${window.location.origin}/share/prd/${prd.share_token}`;
  }

  const persist = useCallback(
    (prdId: string, patch: Parameters<typeof updatePrdAction>[0]) => {
      startTransition(async () => {
        try {
          const row = await updatePrdAction({ ...patch, prdId, projectSlug });
          setPrds((prev) => prev.map((p) => (p.id === row.id ? row : p)));
          setMessage("已保存");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "保存失败");
        }
      });
    },
    [projectSlug, router]
  );

  function createOne(titleOverride?: string, moduleOverride?: string | null) {
    const title = (titleOverride ?? newTitle).trim() || "未命名 PRD";
    const modulePath = (moduleOverride ?? newModule).trim() || null;
    startTransition(async () => {
      try {
        const row = await createPrdAction({
          projectId,
          projectSlug,
          title,
          modulePath,
        });
        if (studioProjectId && modulePath) {
          await addFeatureModuleFromPrdAction({
            studioProjectId,
            projectSlug,
            modulePath,
          });
        }
        setPrds((prev) => [row, ...prev]);
        setCreating(false);
        setNewTitle("");
        openPrd(row);
        setMessage("已创建");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function focusPrototypeLinker() {
    const el = document.getElementById("prd-link-prototype");
    if (el instanceof HTMLSelectElement) {
      el.focus();
      setShareHint("在「挂原型链接」下拉中选择要挂到当前 PRD 的原型");
    }
  }

  function copyShare(prd = selected) {
    if (!prd?.share_token) return;
    const url = shareUrl(prd);
    void navigator.clipboard.writeText(url).then(
      () => setShareHint("分享链接已复制"),
      () => setShareHint(url)
    );
  }

  async function copyPageBody() {
    const iframe = document.querySelector(
      'iframe[title="PRD 编辑器"]'
    ) as (HTMLIFrameElement & {
      __copyPage?: () => Promise<{ html: string; text: string }>;
    }) | null;
    try {
      const payload = iframe?.__copyPage
        ? await iframe.__copyPage()
        : { html: draftHtml || editorHtml, text: "" };
      const html = payload.html || draftHtml || editorHtml;
      const text =
        payload.text ||
        html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShareHint("当前页正文已复制（含结构；外贴会保留标题/列表等语义格式）");
    } catch (e) {
      setShareHint(e instanceof Error ? e.message : "复制失败");
    }
  }

  const onHtmlChange = useCallback(
    (html: string, title: string) => {
      if (!selected || viewVersionId !== "current" || showDiff) return;
      setDraftHtml(html);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const prdId = selected.id;
      const nextTitle = title || selected.title;
      saveTimerRef.current = window.setTimeout(() => {
        persist(prdId, {
          prdId,
          projectSlug,
          htmlContent: html,
          title: nextTitle,
        });
      }, 800);
    },
    [persist, projectSlug, selected, viewVersionId, showDiff]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">PRD</h2>
          <p className="mt-1 text-sm text-slate-500">
            左侧列表 = 多份 PRD。顶栏「当前稿 / 小版本」= 整份文档快照（可命名、对比、还原）；勾选标注后绿=相对上一版新增、红删除线=已删。正文里「版本记录」表是产品文案，不是顶栏快照。
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm text-white"
          onClick={() => setCreating(true)}
        >
          新建 PRD
        </button>
      </div>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}

      {creating ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="PRD 标题"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="板块，如 通知消息"
            list="prd-modules"
            value={newModule}
            onChange={(e) => setNewModule(e.target.value)}
          />
          <datalist id="prd-modules">
            {featureModules.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white"
              onClick={() => createOne()}
            >
              创建
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm"
              onClick={() => setCreating(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {prds.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          还没有 PRD。点「新建 PRD」后会在弹窗里打开参考稿同款编辑器。
        </div>
      ) : null}

      <div className="space-y-5">
        {grouped.map(([moduleName, rows]) => (
          <section key={moduleName}>
            <h3 className="mb-2 text-sm font-medium text-slate-500">{moduleName}</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1">
              {rows.map((prd) => {
                const protoLinks = prd.linked_prototypes
                  .map((link) => {
                    const proto = prototypes.find((p) => p.id === link.prototype_id);
                    if (!proto) return null;
                    const url =
                      proto.external_url || resolvePrototypeUrl(proto.storage_path);
                    return { link, proto, url };
                  })
                  .filter(
                    (
                      row
                    ): row is {
                      link: (typeof prd.linked_prototypes)[number];
                      proto: Prototype;
                      url: string;
                    } => Boolean(row)
                  );
                return (
                  <div key={prd.id}>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                        onClick={() => openPrd(prd)}
                      >
                        <span className="truncate font-medium text-slate-800">
                          {prd.title}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {(prd.versions ?? []).at(-1)?.label ?? "1.0"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                        onClick={() => copyShare(prd)}
                      >
                        复制链接
                      </button>
                    </div>
                    {protoLinks.map(({ proto, url }) => (
                      <div
                        key={proto.id}
                        className="ml-6 flex items-center gap-2 px-2 py-0.5"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                          onClick={() => openPrd(prd, proto.id)}
                        >
                          Prototype｜{proto.name}
                        </button>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 px-1 text-slate-400"
                            title="在新窗口打开原型"
                          >
                            ↗
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/50 p-3 sm:p-6">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
              <input
                className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                defaultValue={selected.title}
                key={selected.id}
                onBlur={(e) =>
                  persist(selected.id, {
                    prdId: selected.id,
                    projectSlug,
                    title: e.target.value,
                  })
                }
              />
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
                <span className="text-[11px] font-medium text-slate-500">
                  小版本
                </span>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                  value={viewVersionId}
                  onChange={(e) =>
                    setViewVersionId(e.target.value as string | "current")
                  }
                  title="同一文档的快照历史（1.0 / 1.0.1…），不是左侧换文档"
                >
                  <option value="current">当前稿（可编辑）</option>
                  {(selected.versions ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                      {v.created_at
                        ? ` · ${v.created_at.slice(0, 10)}`
                        : ""}
                    </option>
                  ))}
                </select>
                <label
                  className="flex items-center gap-1 text-xs text-slate-600"
                  title={
                    (selected.versions ?? []).length
                      ? "相对相邻上一小版本做块级增删标注"
                      : "请先「保存为小版本」后再标注"
                  }
                >
                  <input
                    type="checkbox"
                    checked={showDiff}
                    disabled={!(selected.versions ?? []).length}
                    onChange={(e) => setShowDiff(e.target.checked)}
                  />
                  标注改动
                  {diffAgainstLabel ? (
                    <span className="text-slate-400">相对 {diffAgainstLabel}</span>
                  ) : null}
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                  disabled={pending || !editingCurrent}
                  onClick={() => {
                    const vers = selected.versions ?? [];
                    const last = vers[vers.length - 1]?.label ?? "1.0";
                    const m = last.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
                    const suggested = !m
                      ? `快照 ${vers.length + 1}`
                      : `${m[1]}.${m[2]}.${m[3] != null ? Number(m[3]) + 1 : 1}`;
                    const label = window.prompt(
                      "保存当前稿为小版本（可改名；取消则不保存）",
                      suggested
                    );
                    if (label === null) return;
                    persist(selected.id, {
                      prdId: selected.id,
                      projectSlug,
                      htmlContent: draftHtml,
                      snapshotVersion: true,
                      snapshotVersionLabel: label.trim() || suggested,
                    });
                    setMessage(`已保存小版本「${label.trim() || suggested}」`);
                  }}
                >
                  保存为小版本
                </button>
                {viewVersionId !== "current" ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                      disabled={pending}
                      onClick={() => {
                        const version = (selected.versions ?? []).find(
                          (v) => v.id === viewVersionId
                        );
                        if (!version) return;
                        const next = window.prompt("重命名此小版本", version.label);
                        if (next === null) return;
                        const label = next.trim();
                        if (!label) return;
                        persist(selected.id, {
                          prdId: selected.id,
                          projectSlug,
                          versions: (selected.versions ?? []).map((v) =>
                            v.id === version.id ? { ...v, label } : v
                          ),
                        });
                      }}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                      disabled={pending}
                      onClick={() => {
                        const version = (selected.versions ?? []).find(
                          (v) => v.id === viewVersionId
                        );
                        if (!version) return;
                        setDraftHtml(version.html_content);
                        setViewVersionId("current");
                        setShowDiff(false);
                        persist(selected.id, {
                          prdId: selected.id,
                          projectSlug,
                          htmlContent: version.html_content,
                        });
                      }}
                    >
                      还原为此版本
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm text-rose-600"
                      disabled={pending}
                      onClick={() => {
                        const version = (selected.versions ?? []).find(
                          (v) => v.id === viewVersionId
                        );
                        if (!version) return;
                        if (!confirm(`删除小版本「${version.label}」？不可恢复。`)) {
                          return;
                        }
                        const nextVersions = (selected.versions ?? []).filter(
                          (v) => v.id !== version.id
                        );
                        setViewVersionId("current");
                        setShowDiff(false);
                        persist(selected.id, {
                          prdId: selected.id,
                          projectSlug,
                          versions: nextVersions,
                        });
                      }}
                    >
                      删除此版
                    </button>
                  </>
                ) : null}
              </div>
              {showDiff && diffAgainstLabel ? (
                <span className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/30 ring-1 ring-emerald-600" />
                    新增
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/25 ring-1 ring-rose-600" />
                    删除
                  </span>
                </span>
              ) : null}
              <button
                type="button"
                className={`rounded-lg px-2 py-1 text-sm ${
                  suggest ? "bg-indigo-100 text-indigo-800" : "border"
                }`}
                disabled={!editingCurrent}
                onClick={() => setSuggest((v) => !v)}
              >
                {suggest ? "结束建议" : "开始建议"}
              </button>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm"
                onClick={() => setCommentsOpenTick((n) => n + 1)}
              >
                评论
              </button>
              <select
                id="prd-link-prototype"
                className="max-w-[160px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const prototypeId = e.target.value;
                  e.target.value = "";
                  if (!prototypeId) return;
                  if (selected.linked_prototypes.some((l) => l.prototype_id === prototypeId)) {
                    return;
                  }
                  persist(selected.id, {
                    prdId: selected.id,
                    projectSlug,
                    linkedPrototypes: [
                      ...selected.linked_prototypes,
                      { prototype_id: prototypeId, note: "", section_hint: "" },
                    ],
                  });
                  startTransition(async () => {
                    await linkPrototypeToPrdAction({
                      prototypeId,
                      prdId: selected.id,
                      projectSlug,
                    });
                  });
                }}
              >
                <option value="">挂原型链接</option>
                {prototypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm"
                onClick={() => void copyPageBody()}
              >
                复制正文
              </button>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm"
                onClick={() => copyShare()}
              >
                复制分享链接
              </button>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm"
                disabled={pending}
                title={
                  viewVersionId === "current"
                    ? "导出当前稿（可编辑 HTML）"
                    : "导出当前所选小版本（可编辑 HTML）"
                }
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await downloadStandalonePrd({
                        title: selected.title || "PRD",
                        bodyHtml: editorHtml,
                      });
                      setMessage("已导出可编辑 HTML");
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "导出失败"
                      );
                    }
                  });
                }}
              >
                导出 HTML
              </button>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm"
                disabled={pending}
                title="导出兼容 Markdown 的 .md（表格 / 列表 / 标题）"
                onClick={() => {
                  try {
                    downloadPrdMarkdown({
                      title: selected.title || "PRD",
                      bodyHtml: editorHtml,
                    });
                    setMessage("已导出 Markdown");
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "导出失败");
                  }
                }}
              >
                导出 MD
              </button>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm"
                disabled={pending}
                title="同时导出 HTML + Markdown"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await downloadPrdHtmlAndMarkdown({
                        title: selected.title || "PRD",
                        bodyHtml: editorHtml,
                      });
                      setMessage("已导出 HTML + Markdown");
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "导出失败"
                      );
                    }
                  });
                }}
              >
                导出 HTML+MD
              </button>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-sm text-rose-600"
                onClick={() => {
                  if (!confirm(`删除「${selected.title}」？`)) return;
                  startTransition(async () => {
                    await deletePrdAction({
                      prdId: selected.id,
                      projectSlug,
                    });
                    setPrds((prev) => prev.filter((p) => p.id !== selected.id));
                    setOpenId(null);
                    router.refresh();
                  });
                }}
              >
                删除
              </button>
              <button
                type="button"
                className="ml-auto rounded-lg bg-slate-900 px-3 py-1 text-sm text-white"
                onClick={() => setOpenId(null)}
              >
                关闭
              </button>
            </header>
            {shareHint ? (
              <p className="border-b border-slate-100 px-4 py-1 text-xs text-indigo-600">
                {shareHint}
              </p>
            ) : null}
            {!editingCurrent ? (
              <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-950">
                当前为<strong>只读</strong>
                {showDiff ? "（已勾选「标注相对上一版改动」）" : ""}
                {viewVersionId !== "current" ? "（正在看历史小版本）" : ""}
                ：无法粘贴或改正文。取消标注并选回「当前稿」后即可编辑；仍可用上方「复制正文」拷出内容与结构。
              </p>
            ) : (
              <p className="border-b border-slate-100 px-4 py-1 text-[11px] text-slate-500">
                粘贴保留标题/列表/表格/加粗与文字色、背景色；字号与复杂版式仍会丢弃，避免整页被外站样式污染。
              </p>
            )}
            <div className="min-h-0 flex-1">
              <PrdEditorFrame
                brand={projectTitle}
                section={selected.module_path || "PRD"}
                html={editorHtml}
                pages={hostPages}
                activeId={activePageId ?? selected.id}
                editable={editingCurrent}
                review={suggest}
                comments={hostComments}
                revision={`${selected.id}:${activePageId}:${viewVersionId}:${showDiff}:${suggest}:${selected.linked_prototypes
                  .map((l) => l.prototype_id)
                  .join(",")}`}
                commentsOpenTick={commentsOpenTick}
                onHtmlChange={onHtmlChange}
                onCommentsChange={onCommentsChange}
                onHostCreatePage={(title) => createOne(title, selected.module_path)}
                onHostLinkPrototype={() => focusPrototypeLinker()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
