import { WorkbenchShell } from "@/components/workbench-shell";

const ENV_INDEX = [
  { key: "ADMIN_USERNAME / ADMIN_PASSWORD", purpose: "后台登录", where: "Vercel / .env.local" },
  { key: "ADMIN_SESSION_SECRET", purpose: "Session 签名", where: "服务端环境变量" },
  { key: "GITHUB_TOKEN", purpose: "Git 同步 · Issue 灵感捕捉", where: "服务端环境变量" },
  { key: "STUDIO_IDEAS_REPO", purpose: "灵感 Issue 仓库", where: "服务端环境变量" },
  { key: "IDEAS_CAPTURE_SECRET", purpose: "ChatGPT → Issue 回调密钥", where: "服务端 + GPT Action" },
  { key: "CRON_SECRET", purpose: "定时同步 / 提醒", where: "Vercel Cron" },
  { key: "NOTION_TOKEN", purpose: "Notion 导入", where: "服务端环境变量" },
  { key: "NEXT_PUBLIC_SUPABASE_*", purpose: "Studio 数据持久化", where: "Supabase 项目" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", purpose: "服务端读写 Studio 表", where: "仅服务端，勿暴露前端" },
  { key: "SECRETS_ENCRYPTION_KEY", purpose: "项目密钥 AES-256 加密主密钥", where: "服务端环境变量（32 字节 base64）" },
] as const;

export default function KeysPage() {
  return (
    <WorkbenchShell
      title="密钥索引"
      subtitle="环境变量清单 — 不存储明文密钥，只记录用途与存放位置"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">变量</th>
              <th className="px-4 py-3 font-medium">用途</th>
              <th className="px-4 py-3 font-medium">存放位置</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ENV_INDEX.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.key}</td>
                <td className="px-4 py-3 text-slate-600">{row.purpose}</td>
                <td className="px-4 py-3 text-slate-500">{row.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-400">
        完整模板见仓库根目录 .env.example；OpenAI Key 保存在浏览器 localStorage（设置页配置）。
        各项目的 API Key 等可存于「项目 → 更多操作 → 项目密钥」（Supabase 加密，需登录查看）。
      </p>
    </WorkbenchShell>
  );
}
