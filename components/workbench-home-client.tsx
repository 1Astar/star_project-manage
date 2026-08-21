"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QuickCaptureModal } from "@/components/studio/quick-capture-modal";
import { StudioBadge } from "@/components/studio/shell";
import { WorkbenchBlockers } from "@/components/workbench-blockers";
import { WorkbenchPmToday } from "@/components/workbench-pm-today";
import { WorkbenchProjectLibrary } from "@/components/workbench-project-library";
import { WorkbenchStarOrCalendar } from "@/components/workbench-star-or-calendar";
import type {
  WorkbenchHeroPayload,
  WorkbenchLibraryPayload,
  WorkbenchStarPayload,
  WorkbenchTodayPayload,
} from "@/lib/workbench/home-sections";

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-6 animate-pulse rounded-xl border border-slate-200 bg-white px-4 py-8">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <p className="mt-3 text-xs text-slate-400">{label}</p>
      <div className="mt-4 h-24 rounded-lg bg-slate-100" />
    </div>
  );
}

function SectionError({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
      <p>{label}加载失败</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-xs font-medium text-rose-700 underline"
      >
        重试
      </button>
    </div>
  );
}

async function fetchPart<T>(part: string): Promise<T> {
  const res = await fetch(`/api/workbench/home?part=${part}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body?.error === "string" ? body.error : `HTTP ${res.status}`
    );
  }
  const json = await res.json();
  return json.data as T;
}

export function WorkbenchHomeClient() {
  const [hero, setHero] = useState<WorkbenchHeroPayload | null>(null);
  const [today, setToday] = useState<WorkbenchTodayPayload | null>(null);
  const [library, setLibrary] = useState<WorkbenchLibraryPayload | null>(null);
  const [star, setStar] = useState<WorkbenchStarPayload | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const markError = (part: string, err: unknown) => {
      if (cancelled) return;
      setErrors((prev) => ({
        ...prev,
        [part]: err instanceof Error ? err.message : "加载失败",
      }));
    };
    const clearError = (part: string) => {
      if (cancelled) return;
      setErrors((prev) => {
        const next = { ...prev };
        delete next[part];
        return next;
      });
    };

    (async () => {
      // 顺序加载：先主线摘要 → 今日清单 → 项目库 → 星图（最重）
      try {
        clearError("hero");
        const h = await fetchPart<WorkbenchHeroPayload>("hero");
        if (!cancelled) setHero(h);
      } catch (e) {
        markError("hero", e);
      }

      try {
        clearError("today");
        const t = await fetchPart<WorkbenchTodayPayload>("today");
        if (!cancelled) setToday(t);
      } catch (e) {
        markError("today", e);
      }

      try {
        clearError("library");
        const lib = await fetchPart<WorkbenchLibraryPayload>("library");
        if (!cancelled) setLibrary(lib);
      } catch (e) {
        markError("library", e);
      }

      try {
        clearError("star");
        const s = await fetchPart<WorkbenchStarPayload>("star");
        if (!cancelled) setStar(s);
      } catch (e) {
        markError("star", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const retryPart = async (part: "hero" | "today" | "library" | "star") => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[part];
      return next;
    });
    try {
      if (part === "hero") {
        setHero(null);
        setHero(await fetchPart<WorkbenchHeroPayload>("hero"));
      } else if (part === "today") {
        setToday(null);
        setToday(await fetchPart<WorkbenchTodayPayload>("today"));
      } else if (part === "library") {
        setLibrary(null);
        setLibrary(await fetchPart<WorkbenchLibraryPayload>("library"));
      } else {
        setStar(null);
        setStar(await fetchPart<WorkbenchStarPayload>("star"));
      }
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [part]: e instanceof Error ? e.message : "加载失败",
      }));
    }
  };

  const drafts = hero?.nextActionDrafts ?? library?.nextActionDrafts ?? {};
  const captureProjects = library?.captureProjects ?? [];

  return (
    <>
      <QuickCaptureModal projects={captureProjects} />

      {errors.hero ? (
        <SectionError label="主线摘要" onRetry={() => void retryPart("hero")} />
      ) : !hero ? (
        <div className="mt-6 grid animate-pulse gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-400">今日只做什么</div>
            {hero.focus ? (
              <Link href={`/projects/${hero.focus.project.id}`} className="mt-1 block">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {hero.focus.project.title}
                </div>
                {(() => {
                  const next =
                    hero.focus.task?.title?.trim() ||
                    hero.focus.project.nextAction?.trim() ||
                    hero.focus.project.body?.nextStep?.trim() ||
                    "";
                  const draft = drafts[hero.focus.project.id];
                  if (next) {
                    return (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{next}</p>
                    );
                  }
                  return (
                    <p className="mt-0.5 truncate text-xs text-amber-700/80">
                      未写下一步
                      {draft ? ` · 可参考：${draft}` : ""}
                    </p>
                  );
                })()}
              </Link>
            ) : (
              <p className="mt-1 text-xs text-slate-400">暂无主线任务</p>
            )}
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
            <div className="text-xs font-medium text-amber-700/80">当前主线 · 算法</div>
            {hero.suggestedMainline ? (
              <Link
                href={`/projects/${hero.suggestedMainline.project.id}`}
                className="mt-1 block"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <StudioBadge tone="mainline">
                    {hero.suggestedMainline.pinned
                      ? "钉主线加权"
                      : hero.statusLabels[hero.suggestedMainline.project.status]}
                  </StudioBadge>
                  <span className="text-[10px] text-amber-800/70">
                    分 {hero.suggestedMainline.score}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {hero.suggestedMainline.project.title}
                </div>
                {hero.suggestedMainline.reasons.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {hero.suggestedMainline.reasons.join(" · ")}
                  </p>
                ) : null}
              </Link>
            ) : (
              <p className="mt-1 text-xs text-slate-400">暂无候选项目</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-400">待处理</div>
            <p className="mt-1 text-sm text-slate-700">
              待验收{" "}
              <a href="#pm-today" className="font-semibold text-orange-700 hover:underline">
                {hero.acceptanceBundleCount} 板块
                {hero.acceptanceItemCount ? `（${hero.acceptanceItemCount}）` : ""}
              </a>
              <span className="mx-1 text-slate-300">·</span>
              Bug{" "}
              <a href="#pm-today" className="font-semibold text-rose-700 hover:underline">
                {hero.openBugCount}
              </a>
              <span className="mx-1 text-slate-300">·</span>
              跟进{" "}
              <a href="#pm-today" className="font-semibold text-amber-700 hover:underline">
                {hero.followUpCount}
              </a>
              <span className="mx-1 text-slate-300">·</span>
              收件箱{" "}
              <Link href="/stream" className="font-semibold text-indigo-600 hover:underline">
                {hero.inboxCount}
              </Link>
              {hero.blockers.length > 0 ? (
                <WorkbenchBlockers items={hero.blockers} />
              ) : null}
            </p>
          </section>
        </div>
      )}

      {/* 视觉顺序：星图 → 项目库 → 今日；网络顺序已是 hero→today→library→star */}
      {errors.star ? (
        <SectionError label="星图 / 日历" onRetry={() => void retryPart("star")} />
      ) : !star ? (
        <SectionSkeleton label="星图与日历加载中…" />
      ) : (
        <div className="mt-6">
          <WorkbenchStarOrCalendar
            layout={star.layout}
            improvementByDay={star.improvementByDay}
          />
        </div>
      )}

      {errors.library ? (
        <SectionError label="项目库" onRetry={() => void retryPart("library")} />
      ) : !library ? (
        <SectionSkeleton label="项目库加载中…" />
      ) : (
        <WorkbenchProjectLibrary
          projects={library.projects}
          nextActionDrafts={library.nextActionDrafts}
        />
      )}

      {errors.today ? (
        <SectionError label="今日清单" onRetry={() => void retryPart("today")} />
      ) : !today ? (
        <SectionSkeleton label="今日 / 明日清单加载中…" />
      ) : (
        <div className="mt-6">
          <WorkbenchPmToday
            acceptance={today.acceptance}
            acceptanceBundles={today.acceptanceBundles}
            followUps={today.followUps}
            openBugs={today.openBugs}
            lookbackDays={today.lookbackDays}
            todayDay={today.todayDay}
            tomorrowDay={today.tomorrowDay}
            tomorrowItems={today.tomorrowItems}
          />
        </div>
      )}
    </>
  );
}
