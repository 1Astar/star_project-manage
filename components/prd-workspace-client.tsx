"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
  packPrdDocument,
  unpackPrdDocument,
  type PrdDocPage,
} from "@/lib/prds/doc-pages";
import {
  downloadPrdHtmlAndMarkdown,
  downloadPrdMarkdown,
  downloadStandalonePrd,
} from "@/lib/prds/export-standalone";
import {
  previewPrdImport,
  type PrdImportPreview,
} from "@/lib/prds/import-text";
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
  type PrdHtmlChangeMeta,
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
  const [importing, setImporting] = useState(false);
  const [importRaw, setImportRaw] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importModule, setImportModule] = useState(featureModules[0] ?? "");
  const [importPreview, setImportPreview] = useState<PrdImportPreview | null>(
    null
  );
  const [newTitle, setNewTitle] = useState("");
  const [newModule, setNewModule] = useState(featureModules[0] ?? "");
  const [suggest, setSuggest] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [viewVersionId, setViewVersionId] = useState<string | "current">("current");
  const [draftHtml, setDraftHtml] = useState("");
  const [protoList, setProtoList] = useState(prototypes);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachTab, setAttachTab] = useState<"url" | "pick" | "upload">("url");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const attachFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProtoList(prototypes);
  }, [prototypes]);
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

  /** 当前查看目标的原始存储串（可能含多页打包前缀） */
  const storedSourceHtml = useMemo(() => {
    if (!selected) return "";
    if (viewVersionId === "current") return currentHtml;
    const version = (selected.versions ?? []).find((v) => v.id === viewVersionId);
    return version?.html_content ?? selected.html_content;
  }, [selected, viewVersionId, currentHtml]);

  const unpackedSource = useMemo(
    () => unpackPrdDocument(storedSourceHtml),
    [storedSourceHtml]
  );

  const resolvedActivePageId = useMemo(() => {
    if (!selected) return null;
    return (
      activePageId ||
      unpackedSource.activeId ||
      unpackedSource.pages?.find((p) => !p.parentId)?.id ||
      selected.id
    );
  }, [selected, activePageId, unpackedSource.activeId, unpackedSource.pages]);

  const activePageRawHtml = useMemo(() => {
    if (!selected) return "";
    const fromPages = unpackedSource.pages?.find(
      (p) => p.id === resolvedActivePageId
    )?.content;
    return fromPages || unpackedSource.html;
  }, [selected, unpackedSource.pages, unpackedSource.html, resolvedActivePageId]);

  const editorHtml = useMemo(() => {
    if (!selected) return "";
    const versions = selected.versions ?? [];
    const displayCurrent = activePageRawHtml;
    if (viewVersionId === "current") {
      if (!showDiff || !versions.length) return displayCurrent;
      const last = versions[versions.length - 1];
      if (!last) return displayCurrent;
      const prevUnpacked = unpackPrdDocument(last.html_content);
      const prevDisplay =
        prevUnpacked.pages?.find((p) => p.id === resolvedActivePageId)
          ?.content || prevUnpacked.html;
      return annotateHtmlDiff(prevDisplay, displayCurrent);
    }
    if (!showDiff) return displayCurrent;
    const version = versions.find((v) => v.id === viewVersionId);
    if (!version) return displayCurrent;
    const index = versions.findIndex((v) => v.id === version.id);
    const previous = index > 0 ? versions[index - 1] : null;
    if (!previous) return displayCurrent;
    const prevUnpacked = unpackPrdDocument(previous.html_content);
    const prevDisplay =
      prevUnpacked.pages?.find((p) => p.id === resolvedActivePageId)?.content ||
      prevUnpacked.html;
    return annotateHtmlDiff(prevDisplay, displayCurrent);
  }, [
    selected,
    viewVersionId,
    activePageRawHtml,
    showDiff,
    resolvedActivePageId,
  ]);

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
    const docPages = unpackedSource.pages;
    const rootId = docPages?.find((p) => !p.parentId)?.id ?? selected.id;
    const pages: PrdHostPage[] = docPages?.length
      ? docPages.map((p) => {
          const isActive =
            p.id === (activePageId || unpackedSource.activeId || rootId);
          return {
            id: p.id,
            title: p.title,
            parentId: p.parentId,
            order: p.order,
            expanded: true,
            // 标注改动时只给当前活动页套 diff，其它页保持原内容
            content:
              isActive && showDiff ? editorHtml : p.content || editorHtml,
          };
        })
      : [
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
      const proto = protoList.find((p) => p.id === link.prototype_id);
      if (!proto) return;
      const url = proto.external_url || resolvePrototypeUrl(proto.storage_path);
      pages.push({
        id: proto.id,
        title: `Prototype｜${proto.name}`,
        parentId: rootId,
        order: 1000 + index,
        expanded: true,
        content: `<h1>Prototype｜${proto.name}</h1><p>${link.note || "在新窗口打开原型"}</p>`,
        prototypeUrl: url || undefined,
      });
    });
    return pages;
  }, [
    selected,
    protoList,
    editorHtml,
    unpackedSource.pages,
    unpackedSource.activeId,
    activePageId,
    showDiff,
  ]);

  const openPrd = (prd: ProjectPrd, pageId?: string) => {
    const unpacked = unpackPrdDocument(prd.html_content);
    setOpenId(prd.id);
    setActivePageId(
      pageId ??
        unpacked.activeId ??
        unpacked.pages?.find((p) => !p.parentId)?.id ??
        prd.id
    );
    setDraftHtml(prd.html_content);
    setViewVersionId("current");
    setSuggest(false);
    setShareHint("");
    setAttachOpen(false);
    setAttachUrl("");
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

  function createOne(
    titleOverride?: string,
    moduleOverride?: string | null,
    htmlContent?: string
  ) {
    const title = (titleOverride ?? newTitle).trim() || "未命名 PRD";
    const modulePath = (moduleOverride ?? newModule).trim() || null;
    startTransition(async () => {
      try {
        const row = await createPrdAction({
          projectId,
          projectSlug,
          title,
          modulePath,
          htmlContent,
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
        setImporting(false);
        setImportRaw("");
        setImportPreview(null);
        setNewTitle("");
        openPrd(row);
        setMessage(htmlContent ? "已导入并创建 PRD" : "已创建");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function runImportPreview(raw: string) {
    const next = raw;
    setImportRaw(next);
    if (!next.trim()) {
      setImportPreview(null);
      return;
    }
    const preview = previewPrdImport(next, {
      titleHint: importTitle || newTitle,
    });
    setImportPreview(preview);
    if (!importTitle.trim()) setImportTitle(preview.title);
  }

  function confirmImport(asNew: boolean) {
    if (!importPreview) return;
    const title = importTitle.trim() || importPreview.title;
    const html = importPreview.html;
    if (asNew) {
      createOne(title, importModule.trim() || null, html);
      return;
    }
    if (!selected) {
      setMessage("请先打开一份 PRD，或选择「新建导入」");
      return;
    }
    setDraftHtml(html);
    persist(selected.id, {
      prdId: selected.id,
      projectSlug,
      htmlContent: html,
      title,
    });
    setImporting(false);
    setImportRaw("");
    setImportPreview(null);
    setMessage("已写入当前稿（可继续编辑）");
  }

  function focusPrototypeLinker() {
    setAttachOpen(true);
    setAttachTab("pick");
    setShareHint("在下方选择：粘贴外链 / 选已有原型 / 上传文件");
  }

  function defaultNameFromUrl(url: string): string {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return host || "外链原型";
    } catch {
      return "外链原型";
    }
  }

  async function attachPrototypeToPrd(proto: Prototype) {
    if (!selected) return;
    if (selected.linked_prototypes.some((l) => l.prototype_id === proto.id)) {
      setShareHint("该原型已挂在当前 PRD");
      return;
    }
    const linkedPrototypes = [
      ...selected.linked_prototypes,
      { prototype_id: proto.id, note: "", section_hint: "" },
    ];
    setPrds((prev) =>
      prev.map((p) =>
        p.id === selected.id ? { ...p, linked_prototypes: linkedPrototypes } : p
      )
    );
    persist(selected.id, {
      prdId: selected.id,
      projectSlug,
      linkedPrototypes,
    });
    await linkPrototypeToPrdAction({
      prototypeId: proto.id,
      prdId: selected.id,
      projectSlug,
    });
    setShareHint(`已挂上：${proto.name}`);
  }

  async function unlinkPrototypeFromPrd(prototypeId: string) {
    if (!selected) return;
    const linkedPrototypes = selected.linked_prototypes.filter(
      (l) => l.prototype_id !== prototypeId
    );
    setPrds((prev) =>
      prev.map((p) =>
        p.id === selected.id ? { ...p, linked_prototypes: linkedPrototypes } : p
      )
    );
    persist(selected.id, {
      prdId: selected.id,
      projectSlug,
      linkedPrototypes,
    });
    await linkPrototypeToPrdAction({
      prototypeId,
      prdId: null,
      projectSlug,
    });
    setShareHint("已从当前 PRD 去掉（原型库仍保留）");
  }

  async function createAndAttachFromForm(fd: FormData, okText: string) {
    if (!selected) return;
    setAttachBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/prototype`, {
        method: "POST",
        body: fd,
      });
      const text = (await res.text()).trim();
      let data: { prototype?: Prototype; error?: string } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        /* plain */
      }
      if (!res.ok) {
        setShareHint(data.error || text.slice(0, 120) || "创建原型失败");
        return;
      }
      if (!data.prototype) {
        setShareHint("创建成功但未返回原型");
        return;
      }
      setProtoList((prev) => {
        if (prev.some((p) => p.id === data.prototype!.id)) return prev;
        return [data.prototype!, ...prev];
      });
      await attachPrototypeToPrd(data.prototype);
      setAttachUrl("");
      setShareHint(okText);
      router.refresh();
    } catch (e) {
      setShareHint(e instanceof Error ? e.message : "网络异常");
    } finally {
      setAttachBusy(false);
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
    (html: string, title: string, meta?: PrdHtmlChangeMeta) => {
      if (!selected || viewVersionId !== "current" || showDiff) return;
      const incomingPages = (meta?.pages ?? []).filter(
        (p) => !p.prototypeUrl
      ) as PrdDocPage[];
      const nextActiveId =
        meta?.activeId ||
        activePageId ||
        incomingPages.find((p) => !p.parentId)?.id ||
        selected.id;
      if (meta?.activeId) setActivePageId(meta.activeId);

      // 多页：打包进 html_content；单页：直接存正文
      const stored =
        incomingPages.length > 1
          ? packPrdDocument(
              incomingPages.map((p) =>
                p.id === nextActiveId ? { ...p, content: html || p.content } : p
              ),
              nextActiveId,
              html
            )
          : html;

      setDraftHtml(stored);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const prdId = selected.id;
      // 仅根页 H1 才回写 PRD 标题，避免子页面标题覆盖文档名
      const rootId =
        incomingPages.find((p) => !p.parentId)?.id ?? selected.id;
      const nextTitle =
        nextActiveId === rootId ? title || selected.title : selected.title;
      saveTimerRef.current = window.setTimeout(() => {
        persist(prdId, {
          prdId,
          projectSlug,
          htmlContent: stored,
          title: nextTitle,
        });
      }, 800);
    },
    [
      persist,
      projectSlug,
      selected,
      viewVersionId,
      showDiff,
      activePageId,
    ]
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
            onClick={() => {
              setImporting(true);
              setCreating(false);
            }}
          >
            一键导入
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm text-white"
            onClick={() => {
              setCreating(true);
              setImporting(false);
            }}
          >
            新建 PRD
          </button>
        </div>
      </div>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}

      {importing ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                导入 PRD（Markdown / HTML / 纯文本）
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                粘贴或选文件 → 先看大纲预览（大/小标题套成 h1–h3）→ 再确认新建或写入当前稿。
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-slate-500"
              onClick={() => {
                setImporting(false);
                setImportRaw("");
                setImportPreview(null);
              }}
            >
              取消
            </button>
          </div>
          <input
            type="file"
            accept=".md,.markdown,.html,.htm,.txt,text/markdown,text/html,text/plain"
            className="block w-full text-xs text-slate-600"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                if (!importTitle.trim()) {
                  setImportTitle(file.name.replace(/\.(md|markdown|html?|txt)$/i, ""));
                }
                runImportPreview(text);
              });
            }}
          />
          <textarea
            className="min-h-[160px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800"
            placeholder={"# 标题\n\n## 1. 背景\n\n正文…\n\n或纯文本：\n产品名\n1. 背景\n说明\n1.1 细节"}
            value={importRaw}
            onChange={(e) => runImportPreview(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="导入后的标题"
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="板块"
              list="prd-modules-import"
              value={importModule}
              onChange={(e) => setImportModule(e.target.value)}
            />
            <datalist id="prd-modules-import">
              {featureModules.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          {importPreview ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
                  识别为 {importPreview.format}
                </span>
                <span>标题建议：{importPreview.title}</span>
              </div>
              {importPreview.warnings.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-700">
                  {importPreview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs font-medium text-slate-700">大纲预览</p>
              {importPreview.outline.length ? (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                  {importPreview.outline.map((item, i) => (
                    <li
                      key={`${item.level}-${i}-${item.text}`}
                      style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                    >
                      <span className="mr-1 text-slate-400">H{item.level}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">无标题层级</p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-indigo-600">
                  查看生成 HTML
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-white p-2 text-[11px] text-slate-600 ring-1 ring-slate-100">
                  {importPreview.html}
                </pre>
              </details>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                  onClick={() => confirmImport(true)}
                >
                  确认新建导入
                </button>
                <button
                  type="button"
                  disabled={pending || !selected}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40"
                  onClick={() => confirmImport(false)}
                  title={selected ? undefined : "先打开一份 PRD"}
                >
                  写入当前稿
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">粘贴内容后显示大纲预览</p>
          )}
        </div>
      ) : null}

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
                    const proto = protoList.find((p) => p.id === link.prototype_id);
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
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !confirm(
                              `删除 PRD「${prd.title}」？不可恢复。`
                            )
                          ) {
                            return;
                          }
                          startTransition(async () => {
                            try {
                              await deletePrdAction({
                                prdId: prd.id,
                                projectSlug,
                              });
                              setPrds((prev) =>
                                prev.filter((p) => p.id !== prd.id)
                              );
                              if (openId === prd.id) setOpenId(null);
                              setMessage("已删除 PRD");
                              router.refresh();
                            } catch (e) {
                              setMessage(
                                e instanceof Error ? e.message : "删除失败"
                              );
                            }
                          });
                        }}
                      >
                        删除
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
              <button
                type="button"
                id="prd-link-prototype"
                className={`rounded-lg border px-2 py-1 text-sm ${
                  attachOpen
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                    : "border-slate-200"
                }`}
                onClick={() => setAttachOpen((v) => !v)}
              >
                挂原型
                {selected.linked_prototypes.length
                  ? ` · ${selected.linked_prototypes.length}`
                  : ""}
              </button>
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
                className="rounded-lg border border-rose-200 px-2 py-1 text-sm text-rose-600"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`删除 PRD「${selected.title}」？不可恢复。`)) {
                    return;
                  }
                  startTransition(async () => {
                    try {
                      await deletePrdAction({
                        prdId: selected.id,
                        projectSlug,
                      });
                      setPrds((prev) =>
                        prev.filter((p) => p.id !== selected.id)
                      );
                      setOpenId(null);
                      setMessage("已删除 PRD");
                      router.refresh();
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "删除失败"
                      );
                    }
                  });
                }}
              >
                删除 PRD
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
            {attachOpen ? (
              <div className="space-y-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["url", "粘贴外链"],
                      ["pick", "选已有"],
                      ["upload", "上传文件"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-lg px-2.5 py-1 text-xs ${
                        attachTab === id
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                      onClick={() => setAttachTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="ml-auto text-xs text-slate-500"
                    onClick={() => setAttachOpen(false)}
                  >
                    收起
                  </button>
                </div>
                {attachTab === "url" ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={attachUrl}
                      onChange={(e) => setAttachUrl(e.target.value)}
                      placeholder="https://…（Figma / 网页等）"
                      className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={attachBusy || !attachUrl.trim()}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                      onClick={() => {
                        const url = attachUrl.trim();
                        if (!url) return;
                        const fd = new FormData();
                        fd.append("name", defaultNameFromUrl(url));
                        fd.append("external_url", url);
                        void createAndAttachFromForm(fd, "已建成外链原型并挂上");
                      }}
                    >
                      {attachBusy ? "处理中…" : "建成并挂上"}
                    </button>
                  </div>
                ) : null}
                {attachTab === "pick" ? (
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      defaultValue=""
                      disabled={attachBusy}
                      onChange={(e) => {
                        const id = e.target.value;
                        e.target.value = "";
                        if (!id) return;
                        const proto = protoList.find((p) => p.id === id);
                        if (!proto) return;
                        startTransition(async () => {
                          setAttachBusy(true);
                          try {
                            await attachPrototypeToPrd(proto);
                          } finally {
                            setAttachBusy(false);
                          }
                        });
                      }}
                    >
                      <option value="">
                        {protoList.length ? "选择本项目原型…" : "暂无原型，请先上传或贴外链"}
                      </option>
                      {protoList.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={selected.linked_prototypes.some(
                            (l) => l.prototype_id === p.id
                          )}
                        >
                          {p.name}
                          {p.type === "external_url" ? " · 外链" : " · 文件"}
                          {selected.linked_prototypes.some(
                            (l) => l.prototype_id === p.id
                          )
                            ? "（已挂）"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {attachTab === "upload" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={attachFileRef}
                      type="file"
                      accept=".zip,.html,.htm,text/html,application/zip"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (!/\.(zip|html?)$/i.test(file.name)) {
                          setShareHint("仅支持 .html / .htm / .zip");
                          return;
                        }
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append(
                          "name",
                          file.name.replace(/\.(zip|html?)$/i, "") || "原型"
                        );
                        void createAndAttachFromForm(fd, "已上传原型并挂上");
                      }}
                    />
                    <button
                      type="button"
                      disabled={attachBusy}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                      onClick={() => attachFileRef.current?.click()}
                    >
                      {attachBusy ? "上传中…" : "选择 HTML / ZIP"}
                    </button>
                    <span className="text-[11px] text-slate-500">
                      与「原型与验收」页相同格式
                    </span>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-medium text-slate-600">
                    已挂在本 PRD
                  </p>
                  {selected.linked_prototypes.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400">还没有挂原型</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {selected.linked_prototypes.map((link) => {
                        const proto = protoList.find(
                          (p) => p.id === link.prototype_id
                        );
                        const url = proto
                          ? proto.external_url ||
                            resolvePrototypeUrl(proto.storage_path)
                          : "";
                        return (
                          <li
                            key={link.prototype_id}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate text-slate-800">
                              {proto?.name ?? link.prototype_id}
                              <span className="ml-1 text-slate-400">
                                {proto?.type === "external_url"
                                  ? "外链"
                                  : "文件"}
                              </span>
                            </span>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline"
                              >
                                打开
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="text-rose-600 hover:underline"
                              disabled={attachBusy}
                              onClick={() => {
                                startTransition(async () => {
                                  setAttachBusy(true);
                                  try {
                                    await unlinkPrototypeFromPrd(
                                      link.prototype_id
                                    );
                                  } finally {
                                    setAttachBusy(false);
                                  }
                                });
                              }}
                            >
                              去掉
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
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
                activeId={resolvedActivePageId || selected.id}
                editable={editingCurrent}
                review={suggest}
                comments={hostComments}
                versions={(selected.versions ?? []).map((v) => ({
                  id: v.id,
                  label: v.label,
                  created_at: v.created_at,
                }))}
                viewVersionId={viewVersionId}
                revision={`${selected.id}:${activePageId}:${viewVersionId}:${showDiff}:${suggest}:${hostPages
                  .map((p) => p.id)
                  .join(",")}:${selected.linked_prototypes
                  .map((l) => l.prototype_id)
                  .join(",")}`}
                commentsOpenTick={commentsOpenTick}
                onHtmlChange={onHtmlChange}
                onCommentsChange={onCommentsChange}
                onHostCreatePage={() => {
                  setMessage(
                    "请在左侧点「＋ 页面 / 子页面」：会在同一份 PRD 内新增，不会替换正文。"
                  );
                }}
                onHostLinkPrototype={() => focusPrototypeLinker()}
                onVersionChange={(versionId) => {
                  setViewVersionId(versionId);
                  setShowDiff(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
