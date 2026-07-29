"use client";

import { useMemo, useState } from "react";
import type { ImprovementDayBucket } from "@/lib/studio/improvement-calendar";
import { monthDays, toDayKey } from "@/lib/studio/improvement-calendar";
import { cn } from "@/lib/utils";

type Props = {
  byDay: Record<string, ImprovementDayBucket>;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const KIND_LABEL: Record<string, string> = {
  evolution: "演进",
  change: "变更",
  release: "上版",
};

export function ImprovementCalendarView({ byDay }: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(() => toDayKey(today));

  const cells = useMemo(
    () => monthDays(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const selected = byDay[selectedDay] ?? null;
  const monthLabel = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">改进日历</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
          >
            上月
          </button>
          <span className="text-xs font-medium text-slate-700">{monthLabel}</span>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
          >
            下月
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        按日总结：改了几个项目、上了几版、主要方向；再按项目列出当日改动（「完成」= 上版，不是补标旧需求）。
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 font-medium">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const key = toDayKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const bucket = byDay[key];
          const s = bucket?.summary;
          const isSelected = key === selectedDay;
          const isToday = key === toDayKey(today);
          return (
            <button
              key={key + String(inMonth)}
              type="button"
              disabled={!inMonth}
              onClick={() => setSelectedDay(key)}
              className={cn(
                "min-h-[4.5rem] rounded-lg border p-1.5 text-left transition",
                inMonth
                  ? "border-slate-100 bg-slate-50/80 hover:border-indigo-200"
                  : "cursor-default border-transparent bg-transparent text-slate-300",
                isSelected && inMonth ? "border-indigo-400 ring-2 ring-indigo-100" : "",
                isToday && inMonth ? "bg-indigo-50/60" : ""
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-medium",
                  inMonth ? "text-slate-700" : "text-slate-300"
                )}
              >
                {d.getDate()}
              </div>
              {s && inMonth && (s.changeCount > 0 || s.releaseCount > 0) ? (
                <div className="mt-1 space-y-0.5 text-[9px] leading-snug text-slate-500">
                  <div className="font-medium text-indigo-700">
                    {s.projectCount} 项 · {s.changeCount} 改
                    {s.releaseCount > 0 ? ` · ${s.releaseCount} 版` : ""}
                  </div>
                  {s.mainDirections[0] ? (
                    <div className="line-clamp-2 text-slate-400">{s.mainDirections[0]}</div>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
        <h4 className="text-xs font-semibold text-slate-700">{selectedDay} · 每日总结</h4>
        {selected && (selected.summary.changeCount > 0 || selected.summary.releaseCount > 0) ? (
          <div className="mt-3 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
              <p>
                今天修改了{" "}
                <span className="font-semibold text-indigo-700">
                  {selected.summary.projectCount}
                </span>{" "}
                个项目，记录了{" "}
                <span className="font-semibold">{selected.summary.changeCount}</span>{" "}
                条演进/变更
                {selected.summary.releaseCount > 0 ? (
                  <>
                    ，上版{" "}
                    <span className="font-semibold text-emerald-700">
                      {selected.summary.releaseTags.join("、")}
                    </span>
                  </>
                ) : null}
                。
              </p>
              {selected.summary.mainDirections.length > 0 ? (
                <p className="mt-1.5 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">主要改进方向：</span>
                  {selected.summary.mainDirections.join(" · ")}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">当日条目未标板块，方向待补齐。</p>
              )}
            </div>

            <div className="space-y-3">
              {selected.byProject.map((g) => (
                <div
                  key={g.projectId}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {g.projectTitle}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {g.changeCount > 0 ? `${g.changeCount} 改动` : ""}
                      {g.changeCount > 0 && g.releaseCount > 0 ? " · " : ""}
                      {g.releaseCount > 0 ? `${g.releaseCount} 上版条目` : ""}
                    </span>
                  </div>
                  {g.directions.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="text-slate-600">需求方向：</span>
                      {g.directions.join(" · ")}
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                    {g.items.map((item) => (
                      <li
                        key={`${item.kind}:${item.id}`}
                        className="flex flex-wrap items-baseline gap-2 text-sm"
                      >
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {KIND_LABEL[item.kind] ?? item.kind}
                        </span>
                        <span className="min-w-0 flex-1 text-slate-800">{item.title}</span>
                        {item.releaseTag ? (
                          <span className="text-[11px] text-emerald-700">{item.releaseTag}</span>
                        ) : null}
                        {item.module ? (
                          <span className="text-[11px] text-slate-400">{item.module}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">这一天还没有可汇总的改动或上版记录。</p>
        )}
      </div>
    </div>
  );
}
