import Link from "next/link";
import { notFound } from "next/navigation";
import {
  StudioShell,
  StudioBadge,
  PropertyRow,
  BodySection,
  RecoveryCard,
} from "@/components/studio/shell";
import {
  getProjectById,
  getProjectTasks,
  getProjectAssets,
  getProjectEvolution,
  getProjectIdeas,
} from "@/lib/studio/data";
import { getStudioProjectGitPreview } from "@/lib/studio/project-git";
import {
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  IDEA_TYPE_LABELS,
} from "@/lib/studio/types";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [tasks, assets, evolution, ideas, gitPreview] = await Promise.all([
    getProjectTasks(id),
    getProjectAssets(id),
    getProjectEvolution(id),
    getProjectIdeas(id),
    getStudioProjectGitPreview(project),
  ]);

  return (
    <StudioShell
      title={project.title}
      subtitle={project.positioning}
      actions={
        <Link href="/studio/projects" className="text-sm text-stone-500 hover:text-stone-700">
          ← 项目库
        </Link>
      }
    >
      <RecoveryCard project={project} gitPreview={gitPreview} />

      {/* Notion-like 属性区 */}
      <div className="mt-8 rounded-lg border border-stone-200 bg-white px-5 py-2">
        <PropertyRow label="状态" value={<StudioBadge tone={project.status === "mainline" ? "mainline" : "default"}>{PROJECT_STATUS_LABELS[project.status]}</StudioBadge>} />
        <PropertyRow label="优先级" value={<StudioBadge tone={project.priority === "P0" ? "p0" : "p1"}>{project.priority}</StudioBadge>} />
        <PropertyRow label="当前阶段" value={project.currentStage} />
        <PropertyRow label="下一步" value={project.nextAction} />
        <PropertyRow label="项目定位" value={project.positioning} />
        <PropertyRow label="目标用户" value={project.targetUser} />
        <PropertyRow label="作品集价值" value={project.portfolioValue} />
        <PropertyRow
          label="展示链接"
          value={
            project.demoUrl ? (
              <a href={project.demoUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                {project.demoUrl}
              </a>
            ) : null
          }
        />
        <PropertyRow
          label="相关页面"
          value={
            project.relatedPageUrl ? (
              <a href={project.relatedPageUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                Notion 主页
              </a>
            ) : null
          }
        />
        <PropertyRow label="代码目录" value={<code className="text-xs">{project.codePath}</code>} />
        <PropertyRow
          label="本地启动"
          value={
            project.localRunGuide ? (
              <pre className="rounded bg-stone-50 p-2 text-xs">{project.localRunGuide}</pre>
            ) : null
          }
        />
        <PropertyRow
          label="更新时间"
          value={new Date(project.updatedAt).toLocaleString("zh-CN")}
        />
      </div>

      {/* 正文模板 */}
      <div className="mt-8 rounded-lg border border-stone-200 bg-white px-6 py-6">
        <div className="text-2xl font-bold text-stone-900">{project.title}</div>
        <BodySection title="初始想法" content={project.body.initialThought} />
        <BodySection title="为什么有这个想法" content={project.body.whyThought} />
        <BodySection title="产品定位" content={project.body.positioning} />
        <BodySection title="后续迭代" content={project.body.iterations} />
        <BodySection title="已做" content={project.body.done} />
        <BodySection title="未做 / 停车" content={project.body.notDone} />
        <BodySection title="当前下一步" content={project.body.nextStep} />
        <BodySection title="相关链接" content={project.body.links} />
        <BodySection title="复盘记录" content={project.body.retrospectives} />
      </div>

      {/* 关联任务 */}
      {tasks.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-stone-500">关联任务</h2>
          <ul className="mt-3 space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-md border border-stone-100 bg-white px-4 py-3 text-sm">
                <span>{t.title}</span>
                <div className="flex gap-2">
                  <StudioBadge>{TASK_STATUS_LABELS[t.status]}</StudioBadge>
                  <StudioBadge tone={t.priority === "P0" ? "p0" : "p1"}>{t.priority}</StudioBadge>
                  {t.dueDate ? <span className="text-xs text-stone-400">{t.dueDate}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 关联灵感 */}
      {ideas.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-stone-500">关联灵感</h2>
          <ul className="mt-3 space-y-2">
            {ideas.map((i) => (
              <li key={i.id} className="rounded-md border border-stone-100 bg-white px-4 py-3 text-sm">
                <span className="font-medium">{i.title}</span>
                <span className="ml-2"><StudioBadge>{IDEA_TYPE_LABELS[i.type]}</StudioBadge></span>
                <p className="mt-1 text-stone-500">{i.oneLineIdea}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 资料库 */}
      {assets.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-stone-500">资料库</h2>
          <ul className="mt-3 space-y-2">
            {assets.map((a) => (
              <li key={a.id} className="rounded-md border border-stone-100 bg-white px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <StudioBadge>{ASSET_TYPE_LABELS[a.assetType]}</StudioBadge>
                  <a href={a.url} className="font-medium text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                    {a.title}
                  </a>
                </div>
                {a.takeaway ? <p className="mt-1 text-stone-500">可借鉴：{a.takeaway}</p> : null}
                {a.risk ? <p className="mt-1 text-orange-600 text-xs">风险：{a.risk}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 演进记录 */}
      {evolution.length > 0 ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">演进记录</h2>
            <Link href="/studio/evolution" className="text-xs text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
            {evolution.slice(0, 5).map((log) => (
              <li key={log.id} className="px-4 py-3 text-sm">
                <div className="font-medium text-stone-800">{log.title}</div>
                <p className="mt-1 text-stone-500">
                  {log.before} → {log.after}
                </p>
                <p className="mt-1 text-xs text-stone-400">结论：{log.decision}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </StudioShell>
  );
}
