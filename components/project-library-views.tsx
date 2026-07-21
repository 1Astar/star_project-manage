"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProjectLibraryBoard } from "@/components/project-library-board";
import {
  ProjectLibraryTable,
} from "@/components/project-library-table";
import type { SourceIdeaOption } from "@/components/create-project-button";
import type { Project, StudioProjectColumnDef } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function ProjectLibraryViews({
  projects,
  statusFilter,
  nextActionDrafts,
  sourceIdeas,
  columnDefs,
}: {
  projects: Project[];
  statusFilter?: string | null;
  nextActionDrafts?: Record<string, string>;
  sourceIdeas?: SourceIdeaOption[];
  columnDefs?: StudioProjectColumnDef[];
}) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "board" ? "board" : "table";

  function hrefFor(next: "table" | "board") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "table") params.delete("view");
    else params.set("view", "board");
    const qs = params.toString();
    return qs ? `/projects?${qs}` : "/projects";
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        <Link
          href={hrefFor("table")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            view === "table"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          表格
        </Link>
        <Link
          href={hrefFor("board")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            view === "board"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          看板
        </Link>
      </div>

      {view === "board" ? (
        <ProjectLibraryBoard projects={projects} />
      ) : (
        <ProjectLibraryTable
          projects={projects}
          statusFilter={statusFilter}
          nextActionDrafts={nextActionDrafts}
          sourceIdeas={sourceIdeas}
          columnDefs={columnDefs}
        />
      )}
    </div>
  );
}
