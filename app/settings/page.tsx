import { WorkbenchShell } from "@/components/workbench-shell";
import { NotionImportPanel } from "@/components/studio/notion-import-panel";
import { OpenAiSettingsPanel } from "@/components/studio/openai-settings-panel";

export default function SettingsPage() {
  return (
    <WorkbenchShell title="设置" subtitle="Notion 导入 · AI 配置 · 全局偏好">
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">OpenAI（浏览器本地）</h2>
          <p className="mt-1 text-xs text-slate-500">用于灵感 AI 拆解与评估，密钥仅存本机</p>
          <div className="mt-4">
            <OpenAiSettingsPanel />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Notion 导入</h2>
          <p className="mt-1 text-xs text-slate-500">从 Notion 看板同步灵感到收件箱</p>
          <div className="mt-4">
            <NotionImportPanel />
          </div>
        </section>
      </div>
    </WorkbenchShell>
  );
}
