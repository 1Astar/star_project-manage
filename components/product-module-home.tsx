"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EntitySidePeek,
  type EntityPeekPayload,
} from "@/components/entity-side-peek";
import type {
  ModuleHomeLinkItem,
  ProductModuleHome,
} from "@/lib/modules/product-module-home";
import {
  saveProductModuleBioAction,
  saveRequirementDetailAction,
  updateBugAction,
  updateCompetitorEntryAction,
  updateLearningNoteAction,
} from "@/lib/actions";

function RelatedBlock({
  title,
  items,
  emptyHint,
  onOpen,
}: {
  title: string;
  items: ModuleHomeLinkItem[];
  emptyHint: string;
  onOpen: (item: ModuleHomeLinkItem) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
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
  projectSlug,
  studioProjectId,
  canEditBio,
  home: initial,
}: {
  projectSlug: string;
  studioProjectId: string | null;
  canEditBio: boolean;
  home: ProductModuleHome;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [home, setHome] = useState(initial);
  const [bio, setBio] = useState(initial.bio);
  const [peek, setPeek] = useState<EntityPeekPayload | null>(null);
  const [peekPending, setPeekPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioSaved, setBioSaved] = useState(false);

  useEffect(() => {
    setHome(initial);
    setBio(initial.bio);
  }, [initial]);

  function openItem(item: ModuleHomeLinkItem) {
    if (!item.peekKind) return;
    setError(null);
    setPeek({
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

  async function savePeek(patch: {
    title: string;
    fields: Record<string, string>;
  }) {
    if (!peek) return;
    setPeekPending(true);
    setError(null);
    try {
      if (peek.kind === "learning") {
        await updateLearningNoteAction({
          noteId: peek.id,
          projectSlug,
          title: patch.title,
          whyText: patch.fields.why_text,
          principle: patch.fields.principle,
          protocol: patch.fields.protocol,
          techBackground: patch.fields.tech_background,
          productThinking: patch.fields.product_thinking,
        });
      } else if (peek.kind === "bug") {
        await updateBugAction({
          bugId: peek.id,
          projectSlug,
          updates: {
            title: patch.title,
            reproSteps: patch.fields.repro_steps,
            expectedResult: patch.fields.expected_result,
            actualResult: patch.fields.actual_result,
            description: patch.fields.description || null,
            suggestion: patch.fields.suggestion || null,
            modulePath: patch.fields.module_path || null,
          },
        });
      } else if (peek.kind === "competitor") {
        await updateCompetitorEntryAction({
          entryId: peek.id,
          projectSlug,
          title: patch.title,
          summary: patch.fields.summary,
          url: patch.fields.url || null,
          modulePath: patch.fields.module_path || null,
        });
      } else {
        await saveRequirementDetailAction({
          requirementId: peek.id,
          projectSlug,
          updates: {
            title: patch.title,
            detail_work: patch.fields.detail_work || null,
            acceptance_criteria: patch.fields.acceptance_criteria || null,
            priority: patch.fields.priority || null,
          },
        });
      }
      setPeek(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPeekPending(false);
    }
  }

  return (
    <div className="space-y-4">
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
            模块主页：简介 + 相关需求 / PRD / Bug / 知识点
            {pending ? " · 刷新中…" : ""}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">简介</h3>
        {canEditBio && studioProjectId ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setBioSaved(false);
              }}
              rows={4}
              placeholder="这个模块是做什么的、边界是什么、当前关注点…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
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
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
            {home.bio.trim() || "暂无简介。登录管理员后可编辑。"}
          </p>
        )}
      </section>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <RelatedBlock
          title="知识点"
          items={home.learnings}
          emptyHint="该模块下暂无知识点（按学习池板块名匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          title="需求"
          items={home.requirements}
          emptyHint="该模块下暂无需求（按需求模块树一级名匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          title="PRD"
          items={home.prds}
          emptyHint="该模块下暂无 PRD（按 module_path 首段匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          title="Bug"
          items={home.bugs}
          emptyHint="该模块下暂无 Bug（按 module_path 首段匹配）。"
          onOpen={openItem}
        />
        <RelatedBlock
          title="竞品"
          items={home.competitors}
          emptyHint="该模块下暂无竞品条目（按 module_path 首段匹配）。"
          onOpen={openItem}
        />
      </div>

      {peek ? (
        <EntitySidePeek
          item={peek}
          pending={peekPending}
          onClose={() => setPeek(null)}
          onSave={savePeek}
        />
      ) : null}
    </div>
  );
}
