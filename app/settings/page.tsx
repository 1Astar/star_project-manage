import { WorkbenchShell } from "@/components/workbench-shell";
import { DefaultGitSettingsPanel } from "@/components/studio/default-git-settings-panel";
import { NotionImportPanel } from "@/components/studio/notion-import-panel";
import { OpenAiSettingsPanel } from "@/components/studio/openai-settings-panel";
import { StudioBackupPanel } from "@/components/studio/studio-backup-panel";

export default function SettingsPage() {
  return (
    <WorkbenchShell title="设置" subtitle="Notion 导入 · AI 配置 · Git 默认仓 · 备份">
      <div className="space-y-6">
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
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">OpenAI（浏览器本地）</h2>
          <p className="mt-1 text-xs text-slate-500">用于灵感 AI 拆解与评估，密钥仅存本机</p>
          <div className="mt-4">
            <OpenAiSettingsPanel />
          </div>
        </section>
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
