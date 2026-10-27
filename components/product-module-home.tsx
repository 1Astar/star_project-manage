"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageFloatingToc } from "@/components/page-floating-toc";
import { MarkdownWithLinkedViews } from "@/components/markdown-with-linked-views";
import { useLinkedViewPeek } from "@/components/use-linked-view-peek";
import { WikiPagesBlock } from "@/components/wiki-pages-block";
import { hasLinkedViewFence } from "@/lib/linked-views/config";
import {
  collectModuleNames,
  collectModuleTree,
  type LinkedViewLibraryRows,
} from "@/lib/linked-views/build-libraries";
import type {
  ModuleHomeLinkItem,
  ProductModuleHome,
} from "@/lib/modules/product-module-home";
import {
  applyModuleHomeTemplateAction,
  saveProductModuleBioAction,
} from "@/lib/actions";
import {
  extractMarkdownOutline,
  mergeOutline,
} from "@/lib/wiki-pages/outline";

function RelatedBlock({
  title,
  items,
  emptyHint,
  onOpen,
  sectionId,
}: {
  title: string;
  items: ModuleHomeLinkItem[];
  emptyHint: string;
  onOpen: (item: ModuleHomeLinkItem) => void;
  sectionId?: string;
}) {
  return (
    <section
      id={sectionId}
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyHint}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                {item.peekKind ? (
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="min-w-0 flex-1 text-left text-sm font-medium text-indigo-700 hover:underline"
                  >
                    {item.badge ? (
                      <span className="mr-1 text-[10px] font-normal text-slate-400">
                        [{item.badge}]
                      </span>
                    ) : null}
                    {item.title}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className="min-w-0 flex-1 text-sm font-medium text-indigo-700 hover:underline"
                  >
                    {item.badge ? (
                      <span className="mr-1 text-[10px] font-normal text-slate-400">
                        [{item.badge}]
                      </span>
                    ) : null}
                    {item.title}
                  </Link>
                )}
                <Link
                  href={item.href}
                  className="shrink-0 text-[11px] text-slate-400 hover:text-slate-600"
                >
                  打开
                </Link>
              </div>
              {item.summary ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 whitespace-pre-wrap">
                  {item.summary}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProductModuleHomeView({
  projectId,
  projectSlug,
  studioProjectId,
  canEditBio,
  canEditPages = false,
  home: initial,
  libraries,
}: {
  projectId: string;
  projectSlug: string;
  studioProjectId: string | null;
  canEditBio: boolean;
  canEditPages?: boolean;
  home: ProductModuleHome;
  libraries: LinkedViewLibraryRows;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [home, setHome] = useState(initial);
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string | null>(null);
  const [bioSaved, setBioSaved] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);
  const moduleTree = useMemo(
    () => collectModuleTree(libraries, [home.name]),
    [libraries, home.name]
  );
  const moduleOptions = useMemo(
    () => collectModuleNames(libraries, [home.name]),
    [libraries, home.name]
  );
  const {
    openRow,
    openPeek,
    peekNode,
    peekError,
  } = useLinkedViewPeek(projectSlug, canEditBio, {
    projectId,
    moduleOptions,
    moduleTree,
  });

  useEffect(() => {
    setHome(initial);
    setBio(initial.bio);
  }, [initial]);

  const hideFooterRelated = hasLinkedViewFence(bio);
  const outline = useMemo(
    () =>
      mergeOutline(
        extractMarkdownOutline(bio),
        { id: "mod-child-pages", text: "功能拆解与子页面", level: 2 },
        ...(hideFooterRelated
          ? []
          : [
              { id: "mod-learnings", text: "知识点", level: 2 as const },
              { id: "mod-requirements", text: "需求", level: 2 as const },
              { id: "mod-prds", text: "PRD", level: 2 as const },
              { id: "mod-bugs", text: "Bug", level: 2 as const },
              { id: "mod-competitors", text: "竞品", level: 2 as const },
            ])
      ),
    [bio, hideFooterRelated]
  );

  function openItem(item: ModuleHomeLinkItem) {
    if (!item.peekKind) return;
    openPeek({
      kind: item.peekKind,
      id: item.id,
      title: item.title,
      href: item.href,
      badge: item.badge,
      fields: item.fields,
    });
  }

  async function saveBio() {
    if (!studioProjectId || !canEditBio) return;
    setError(null);
    setBioSaved(false);
    try {
      await saveProductModuleBioAction({
        studioProjectId,
        projectSlug,
        moduleName: home.name,
        bio,
      });
      setHome((h) => ({ ...h, bio }));
      setBioSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "简介保存失败");
    }
  }

  async function applyTemplate() {
    if (!studioProjectId || !canEditBio) return;
    const hasBio = bio.trim().length > 0;
    let overwriteBio = !hasBio;
    if (hasBio) {
      overwriteBio = window.confirm(
        "简介已有内容。确定用模块模板覆盖简介？\n选「取消」则只建子页、不改简介。\n（模板含按本模块筛选的需求/Bug/优化/知识/PRD/竞品关联表）"
      );
    }
    const createFeaturePages = window.confirm(
      "是否创建「功能清单与任务拆解」子页？\n（文件管理会带上上传/下载等调查·测试页；其它模块只建清单根页，再在子页勾选测试模板新建）"
    );
    if (!overwriteBio && !createFeaturePages && hasBio) {
      setTemplateMsg("已取消");
      return;
    }
    if (!overwriteBio && !createFeaturePages && !hasBio) {
      // 空简介且两步都否 → 仍写简介
      overwriteBio = true;
    }
    setError(null);
    setTemplateMsg(null);
    setTemplateBusy(true);
    try {
      const result = await applyModuleHomeTemplateAction({
        studioProjectId,
        projectId,
        projectSlug,
        moduleName: home.name,
        overwriteBio: overwriteBio || !hasBio,
        createFeaturePages,
      });
      if (result.bioWritten) {
        setTemplateMsg(
          `已套用简介模板${result.createdPageIds.length ? `，新建 ${result.createdPageIds.length} 个子页` : ""}`
        );
      } else if (result.skippedBio) {
        setTemplateMsg(
          `简介未改${result.createdPageIds.length ? `；新建 ${result.createdPageIds.length} 个子页` : ""}`
        );
      } else {
        setTemplateMsg("模板已处理");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "套用模板失败");
    } finally {
      setTemplateBusy(false);
    }
  }

  return (
    <div className="relative space-y-4 xl:pr-48">
      <PageFloatingToc items={outline} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">
            <Link
              href={`/projects/${projectSlug}/modules`}
              className="text-indigo-600 hover:underline"
            >
              ← 模块列表
            </Link>
            {" · "}
            <Link
              href={`/projects/${projectSlug}/overview`}
              className="text-indigo-600 hover:underline"
            >
              总览表
            </Link>
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{home.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            模块主页：简介 + 子页面 + 需求 / PRD / Bug / 知识点 · 功能子页可 AI 生成测试任务
            {pending ? " · 刷新中…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/projects/star-pm/modules/%E6%A8%A1%E5%9D%97%E6%A8%A1%E6%9D%BF"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            title="打开 Star PM 内置模板库（可改正文）"
          >
            内置模板库
          </Link>
          {canEditBio && studioProjectId ? (
            <button
              type="button"
              onClick={() => void applyTemplate()}
              disabled={templateBusy}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
              title="对齐 Notion 文件管理：简介关联表 + 可选功能调查子页"
            >
              {templateBusy ? "套用中…" : "套用模块模板"}
            </button>
          ) : null}
        </div>
      </div>
      {templateMsg ? (
        <p className="text-xs text-emerald-700">{templateMsg}</p>
      ) : null}

      <section
        id="mod-bio"
        className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-slate-900">简介</h3>
        {canEditBio && studioProjectId ? (
          <div className="mt-2 space-y-2">
            <MarkdownWithLinkedViews
              content={bio}
              projectId={projectId}
              projectSlug={projectSlug}
              libraries={libraries}
              canEdit
              editing
              defaultModuleName={home.name}
              moduleOptions={moduleOptions}
              onChange={(next) => {
                setBio(next);
                setBioSaved(false);
              }}
              onOpenRow={openRow}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void saveBio()}
                disabled={bio === home.bio}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                保存简介
              </button>
              {bioSaved ? (
                <span className="text-xs text-emerald-600">已保存</span>
              ) : null}
            </div>
          </div>
        ) : home.bio.trim() ? (
          <div className="mt-2">
            <MarkdownWithLinkedViews
              content={home.bio}
              projectId={projectId}
              projectSlug={projectSlug}
              libraries={libraries}
              defaultModuleName={home.name}
              moduleOptions={moduleOptions}
              onOpenRow={openRow}
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            暂无简介。登录管理员后可编辑（支持 ## 标题与站内链接，可插入关联视图）。
          </p>
        )}
      </section>

      <div id="mod-child-pages" className="scroll-mt-24">
        <WikiPagesBlock
          projectId={projectId}
          projectSlug={projectSlug}
          hostKind="module"
          hostKey={home.name}
          parentId={null}
          pages={home.childPages}
          canEdit={canEditPages}
          title="功能拆解与子页面"
          emptyHint="像 Notion 一样在模块下建子页，例如「文件上传」「搜索与浏览」。子页里还能再挂下一层；也可在简介里用 Markdown 链接跳转。"
        />
      </div>

      {error || peekError ? (
        <p className="text-xs text-red-600">{error || peekError}</p>
      ) : null}

      {hideFooterRelated ? null : (
      <div className="grid gap-3 lg:grid-cols-2">
        <RelatedBlock
          sectionId="mod-learnings"
          title="知识点"
          items={home.learnings}
          emptyHint="该模块下暂无知识点（按学习池板块名匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          sectionId="mod-requirements"
          title="需求"
          items={home.requirements}
          emptyHint="该模块下暂无需求（按需求模块树一级名匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          sectionId="mod-prds"
          title="PRD"
          items={home.prds}
          emptyHint="该模块下暂无 PRD（按 module_path 首段匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          sectionId="mod-bugs"
          title="Bug"
          items={home.bugs}
          emptyHint="该模块下暂无 Bug（按 module_path 首段匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          sectionId="mod-competitors"
          title="竞品"
          items={home.competitors}
          emptyHint="该模块下暂无竞品条目（按 module_path 首段匹配）。"
          onOpen={openItem}
        />
      </div>
      )}

      {peekNode}
    </div>
  );
}
