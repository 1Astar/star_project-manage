import Link from "next/link";
import { StudioShell, StudioBadge } from "@/components/studio/shell";
import { IdeaCapturePanel } from "@/components/studio/idea-capture-panel";
import { StructuredCapturePanel } from "@/components/studio/structured-capture-panel";
import { InboxSyncButton } from "@/components/studio/inbox-sync-button";
import { getAllIdeas, getAllProjects, getProjectTitle } from "@/lib/studio/data";
import {
  IDEA_TYPE_LABELS,
  EMOTION_LABELS,
  IDEA_STATUS_LABELS,
} from "@/lib/studio/types";

export default async function InboxPage() {
  const [ideas, projects] = await Promise.all([getAllIdeas(), getAllProjects()]);

  const sortedIdeas = [...ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const ideasWithProject = await Promise.all(
    sortedIdeas.map(async (idea) => ({
      idea,
      projectName: idea.relatedProjectId
        ? await getProjectTitle(idea.relatedProjectId)
        : null,
      parentIdeaTitle: idea.relatedIdeaId
        ? sortedIdeas.find((item) => item.id === idea.relatedIdeaId)?.title ?? "未知灵感"
        : null,
    }))
  );

  const projectOptions = projects.map((p) => ({ id: p.id, label: p.title }));
  const ideaOptions = sortedIdeas.map((i) => ({ id: i.id, label: i.title }));

  function priorityTone(priority: string) {
    if (priority === "P0") return "p0" as const;
    if (priority === "P1") return "p1" as const;
    return "default" as const;
  }

  return (
    <StudioShell
      title="灵感收件箱"
      subtitle="ChatGPT → GitHub Issue → 同步进收件箱"
      actions={<InboxSyncButton />}
    >
      <div className="space-y-4">
        <StructuredCapturePanel projects={projectOptions} />
        <IdeaCapturePanel projects={projectOptions} ideas={ideaOptions} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">标题</th>
              <th className="px-4 py-3 font-medium">一句话想法</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">优先级</th>
              <th className="px-4 py-3 font-medium">情绪</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">来源</th>
              <th className="px-4 py-3 font-medium">Issue</th>
              <th className="px-4 py-3 font-medium">关联</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {ideasWithProject.map(({ idea, projectName, parentIdeaTitle }) => (
              <tr key={idea.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-800">{idea.title}</td>
                <td className="max-w-xs px-4 py-3 text-stone-600">{idea.oneLineIdea}</td>
                <td className="px-4 py-3">
                  <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                </td>
                <td className="px-4 py-3">
                  <StudioBadge tone={priorityTone(idea.priority)}>{idea.priority}</StudioBadge>
                </td>
                <td className="px-4 py-3">
                  <StudioBadge tone={idea.emotionLevel === "excited" ? "warning" : "default"}>
                    {EMOTION_LABELS[idea.emotionLevel]}
                  </StudioBadge>
                </td>
                <td className="px-4 py-3">
                  <StudioBadge tone={idea.status === "converted" ? "success" : "muted"}>
                    {IDEA_STATUS_LABELS[idea.status]}
                  </StudioBadge>
                </td>
                <td className="px-4 py-3 text-stone-500">{idea.triggerSource || "—"}</td>
                <td className="px-4 py-3">
                  {idea.githubIssueUrl ? (
                    <a
                      href={idea.githubIssueUrl}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{idea.githubIssueNumber}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {idea.relatedProjectId ? (
                    <Link
                      href={`/studio/projects/${idea.relatedProjectId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {projectName}
                    </Link>
                  ) : idea.relatedIdeaId ? (
                    <span className="text-stone-600">↳ {parentIdeaTitle}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-stone-400">
                  {new Date(idea.createdAt).toLocaleDateString("zh-CN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-stone-600">
          展开查看完整字段（为什么想到 / 触发来源）
        </summary>
        <div className="mt-4 space-y-4">
          {sortedIdeas.map((idea) => (
            <div key={idea.id} className="border-b border-stone-100 pb-4 last:border-0">
              <div className="font-medium text-stone-800">{idea.title}</div>
              {idea.subtasks.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-stone-600">
                  {idea.subtasks.map((subtask, index) => (
                    <li key={index}>
                      [{subtask.priority}] {subtask.title}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-sm text-stone-600">
                <span className="text-stone-400">为什么：</span>
                {idea.whyItMatters}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                <span className="text-stone-400">触发来源：</span>
                {idea.triggerSource}
              </p>
            </div>
          ))}
        </div>
      </details>
    </StudioShell>
  );
}
