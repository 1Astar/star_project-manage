"use client";

import { useState } from "react";
import { IdeaStarMap } from "@/components/studio/idea-star-map";
import { ImprovementCalendarView } from "@/components/improvement-calendar-view";
import type { StarMapLayout } from "@/lib/studio/idea-star-map";
import type { ImprovementDayBucket } from "@/lib/studio/improvement-calendar";
import { cn } from "@/lib/utils";

type Props = {
  layout: StarMapLayout;
  improvementByDay: Record<string, ImprovementDayBucket>;
};

export function WorkbenchStarOrCalendar({ layout, improvementByDay }: Props) {
  const [mode, setMode] = useState<"stars" | "calendar">("stars");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMode("stars")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium ring-1 transition",
            mode === "stars"
              ? "bg-indigo-600 text-white ring-indigo-600"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
          )}
        >
          星图
        </button>
        <button
          type="button"
          onClick={() => setMode("calendar")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium ring-1 transition",
            mode === "calendar"
              ? "bg-indigo-600 text-white ring-indigo-600"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
          )}
        >
          日历
        </button>
        <span className="ml-1 text-[11px] text-slate-400">
          {mode === "stars" ? "灵感星空" : "每天改了哪些项目 / 板块"}
        </span>
      </div>
      {mode === "stars" ? (
        <IdeaStarMap layout={layout} />
      ) : (
        <ImprovementCalendarView byDay={improvementByDay} />
      )}
    </div>
  );
}
