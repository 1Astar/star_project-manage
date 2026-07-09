import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { PrototypeWorkspace } from "@/components/prototype-workspace";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function PrototypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const pmSlug = ctx.pmSlug;
  if (!pmSlug) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        该项目尚未关联原型工作区。
      </p>
    );
  }

  const bundle = await fetchProjectBoard(pmSlug);
  if (!bundle) notFound();

  return (
    <PrototypeWorkspace
      projectId={bundle.project.id}
      projectSlug={bundle.project.slug}
      requirements={bundle.requirements}
      tasks={bundle.role_tasks}
      prototypes={bundle.prototypes}
    />
  );
}
