"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Requirement } from "@/lib/types";
import { cn } from "@/lib/utils";

type CalKind = "submitted" | "due" | "completed";

type CalEvent = {
  reqId: string;
  title: string;
  kind: CalKind;
  date: Date;
};

const KIND_LABEL: Record<CalKind, string> = {
  submitted: "提出",
  due: "截止",
  completed: "完成",
};

const KIND_CLASS: Record<CalKind, string> = {
  submitted: "bg-indigo-50 text-indigo-800 ring-indigo-100",
  due: "bg-amber-50 text-amber-900 ring-amber-100",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-100",
};

function parseDay(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const day = raw.slice(0, 10);
  const d = new Date(`${day}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildEvents(requirements: Requirement[]): CalEvent[] {
  const events: CalEvent[] = [];
  for (const req of requirements) {
    const submitted = parseDay(req.submitted_at) ?? parseDay(req.created_at);
    if (submitted) {
      events.push({
        reqId: req.id,
        title: req.title,
        kind: "submitted",
        date: submitted,
      });
    }
    const due = parseDay(req.due_date);
    if (due) {
      events.push({ reqId: req.id, title: req.title, kind: "due", date: due });
    }
    const completed = parseDay(req.completed_at);
    if (completed) {
      events.push({
        reqId: req.id,
        title: req.title,
        kind: "completed",
        date: completed,
      });
    }
  }
  return events;
}

type Props = {
  requirements: Requirement[];
  onOpen?: (reqId: string) => void;
};

export function RequirementCalendar({ requirements, onOpen }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [filter, setFilter] = useState<"all" | CalKind>("all");

  const events = useMemo(() => buildEvents(requirements), [requirements]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      if (filter !== "all" && ev.kind !== filter) continue;
      const key = format(ev.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events, filter]);

  const monthLabel = format(cursor, "yyyy年M月", { locale: zhCN });
  const today = new Date();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((d) => subMonths(d, 1))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            上月
          </button>
          <h3 className="min-w-[7rem] text-center text-sm font-semibold text-slate-800">
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => setCursor((d) => addMonths(d, 1))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            下月
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-lg px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
          >
            今天
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "all" as const, label: "全部" },
              { id: "submitted" as const, label: "提出" },
              { id: "due" as const, label: "截止" },
              { id: "completed" as const, label: "完成" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium",
                filter === item.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        提出用 submitted_at（缺省用创建日）· 截止 due_date · 完成 completed_at · 点条目打开详情
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
            <div key={w} className="px-1 py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[96px] border-b border-r border-slate-100 p-1.5",
                  !inMonth && "bg-slate-50/60"
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday
                      ? "bg-indigo-600 font-semibold text-white"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-300"
                  )}
                >
                  {format(day, "d")}
                </div>
                <ul className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev, idx) => (
                    <li key={`${ev.reqId}-${ev.kind}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => onOpen?.(ev.reqId)}
                        className={cn(
                          "w-full truncate rounded px-1 py-0.5 text-left text-[10px] ring-1",
                          KIND_CLASS[ev.kind]
                        )}
                        title={`${KIND_LABEL[ev.kind]} · ${ev.title}`}
                      >
                        <span className="opacity-70">{KIND_LABEL[ev.kind]}</span> {ev.title}
                      </button>
                    </li>
                  ))}
                  {dayEvents.length > 3 ? (
                    <li className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3}</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
