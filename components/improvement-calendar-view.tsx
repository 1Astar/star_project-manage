"use client";

import { useMemo, useState } from "react";
import type { ImprovementDayBucket } from "@/lib/studio/improvement-calendar";
import { monthDays, toDayKey } from "@/lib/studio/improvement-calendar";
import { cn } from "@/lib/utils";

type Props = {
  byDay: Record<string, ImprovementDayBucket>;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
        按日看演进与 AI 变更会话：改了哪些项目、哪些板块。
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
          const count = bucket?.items.length ?? 0;
          const isSelected = key === selectedDay;
          const isToday = key === toDayKey(today);
          return (
            <button
              key={key + String(inMonth)}
              type="button"
              disabled={!inMonth}
              onClick={() => setSelectedDay(key)}
              className={cn(
                "min-h-[4.25rem] rounded-lg border p-1.5 text-left transition",
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
              {count > 0 && inMonth ? (
                <div className="mt-1 space-y-0.5">
                  <div className="truncate text-[10px] font-medium text-indigo-700">
                    {count} 条
                  </div>
                  <div className="line-clamp-2 text-[9px] leading-snug text-slate-500">
                    {bucket!.projectTitles.slice(0, 2).join("、")}
                    {bucket!.modules.length
                      ? ` · ${bucket!.modules.slice(0, 2).join("、")}`
                      : ""}
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
        <h4 className="text-xs font-semibold text-slate-700">
          {selectedDay}
          {selected ? ` · ${selected.items.length} 条改进` : " · 无记录"}
        </h4>
        {selected && selected.items.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {selected.items.map((item) => (
              <li
                key={`${item.kind}:${item.id}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {item.kind === "evolution" ? "演进" : "变更"}
                  </span>
                  <span className="text-xs font-medium text-indigo-700">
                    {item.projectTitle}
                  </span>
                  {item.module ? (
                    <span className="text-[11px] text-slate-500">{item.module}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-sm text-slate-800">{item.title}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">这一天还没有演进或变更会话。</p>
        )}
      </div>
    </div>
  );
}
