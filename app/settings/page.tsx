import { WorkbenchShell } from "@/components/workbench-shell";
import { BugFeedbackTokensPanel } from "@/components/studio/bug-feedback-tokens-panel";
import { DefaultGitSettingsPanel } from "@/components/studio/default-git-settings-panel";
import { NotionImportPanel } from "@/components/studio/notion-import-panel";
import { OpenAiSettingsPanel } from "@/components/studio/openai-settings-panel";
import { StudioBackupPanel } from "@/components/studio/studio-backup-panel";
import { getAdminSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await getAdminSession();
  const isPublicDemo = !session || session.role === "viewer";

  return (
    <WorkbenchShell
      title="设置"
      subtitle={
        isPublicDemo
          ? "公开演示可配本机 AI / Notion；备份与 Git 总仓需管理员登录"
          : "Notion 导入 · AI 配置 · Git 默认仓 · 备份"
      }
      role={session?.role ?? "guest"}
    >
      <div className="space-y-6">
        {!isPublicDemo ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-slate-700">Studio 备份 / 还原</h2>
              <div className="mt-4">
                <StudioBackupPanel />
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-slate-700">默认 Git 总仓</h2>
              <div className="mt-4">
                <DefaultGitSettingsPanel />
              </div>
            </section>
          </>
        ) : (
          <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
            公开演示不能访问备份还原与 Git 总仓。右上角登录管理员后可用。
          </p>
        )}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">OpenAI（本机 + 服务端）</h2>
          <p className="mt-1 text-xs text-slate-500">
            灵感拆解用本机；服务端同步后，公开 Bug 反馈才能自动挂需求
          </p>
          <div className="mt-4">
            <OpenAiSettingsPanel />
          </div>
        </section>
        {!isPublicDemo ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-700">各项目 Bug 反馈 Token</h2>
            <p className="mt-1 text-xs text-slate-500">
              生成后填到随心而行 / 小手机 / 本站的环境变量或 Widget data-token
            </p>
            <div className="mt-4">
              <BugFeedbackTokensPanel />
            </div>
          </section>
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Notion 导入</h2>
          <p className="mt-1 text-xs text-slate-500">
            Token 存本机 localStorage（同 OpenAI）；导入时临时传服务端拉数据，不写底层配置
          </p>
          <div className="mt-4">
            <NotionImportPanel />
          </div>
        </section>
      </div>
    </WorkbenchShell>
  );
}
