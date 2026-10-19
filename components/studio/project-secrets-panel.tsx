"use client";

import { useCallback, useEffect, useState } from "react";

type SecretItem = {
  id: string;
  projectId: string;
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectSecretsPanelProps = {
  projectId: string;
};

function maskValue(value: string) {
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}${"•".repeat(Math.min(12, value.length - 2))}`;
}

export function ProjectSecretsPanel({ projectId }: ProjectSecretsPanelProps) {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);

  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const [exportPass, setExportPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [packText, setPackText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [lastPack, setLastPack] = useState<string | null>(null);
  const [lastEnv, setLastEnv] = useState<string | null>(null);

  const loadSecrets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "加载失败");
        setSecrets([]);
        return;
      }
      setSecrets(data.secrets ?? []);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSecrets();
  }, [loadSecrets]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newValue) {
      setError("请填写名称和值");
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), value: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败");
        return;
      }

      setNewName("");
      setNewValue("");
      setMessage("已保存（服务端加密）");
      await loadSecrets();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(secret: SecretItem) {
    const ok = window.confirm(`删除密钥「${secret.name}」？此操作不可恢复。`);
    if (!ok) return;

    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets/${secret.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      setMessage("已删除");
      await loadSecrets();
    } catch {
      setError("网络错误");
    }
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("已复制到剪贴板");
    } catch {
      setError("复制失败");
    }
  }

  async function onExportEncrypted() {
    setPending(true);
    setError(null);
    setMessage(null);
    setLastEnv(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: exportPass, format: "pack" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "导出失败");
        return;
      }
      const pack = String(data.pack ?? "");
      setLastPack(pack);
      await navigator.clipboard.writeText(pack);
      setMessage(`已复制加密包（${data.count} 条）。别人看到是乱码；导入或解开需同一口令。`);
    } catch {
      setError("导出失败");
    } finally {
      setPending(false);
    }
  }

  async function onExportEnvPlain() {
    setPending(true);
    setError(null);
    setMessage(null);
    setLastPack(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: exportPass, format: "env" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "导出失败");
        return;
      }
      const env = String(data.env ?? "");
      setLastEnv(env);
      await navigator.clipboard.writeText(env);
      setMessage(
        `已复制明文 .env（${data.count} 条）。仅用于粘贴到 CF/本地；剪贴板此时可读，用完请清空。`
      );
    } catch {
      setError("导出失败");
    } finally {
      setPending(false);
    }
  }

  async function onImportEncrypted() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passphrase: importPass,
          pack: packText,
          mode: importMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "导入失败");
        return;
      }
      setPackText("");
      setMessage(
        `已导入 ${data.imported} 条（${data.mode === "replace" ? "覆盖" : "合并"}）` +
          (data.sourceProjectTitle ? ` · 来自 ${data.sourceProjectTitle}` : "")
      );
      await loadSecrets();
    } catch {
      setError("导入失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800">新增密钥</h2>
        <p className="mt-1 text-xs text-slate-500">
          名称 + 值保存在 Supabase，写入前经 AES-256-GCM 加密；仅登录后可查看。
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            名称
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如 OPENAI_API_KEY"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
            />
          </label>
          <label className="block text-xs text-slate-600 sm:col-span-2">
            值
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder="密钥明文（仅提交时传输，库内为密文）"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-300"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存密钥"}
            </button>
          </div>
        </form>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800">一键导出 / 导入</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          <strong className="font-medium text-slate-600">加密包</strong>
          ：剪贴板是乱码，可微信/邮件转发；对方在本页粘贴 + 同一口令即可导入。
          <br />
          <strong className="font-medium text-slate-600">明文 .env</strong>
          ：Cloudflare / 本地部署要用明文，须口令确认后再复制；CF 控制台不能直接吃加密包。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600 sm:col-span-2">
            导出口令（≥6 位；加密包用它加密，明文 .env 用它作确认）
            <input
              type="password"
              autoComplete="new-password"
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-300"
            />
          </label>
          <button
            type="button"
            disabled={pending || secrets.length === 0}
            onClick={() => void onExportEncrypted()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            复制加密包
          </button>
          <button
            type="button"
            disabled={pending || secrets.length === 0}
            onClick={() => void onExportEnvPlain()}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            复制明文 .env（配 CF）
          </button>
        </div>
        {lastPack ? (
          <textarea
            readOnly
            value={lastPack}
            className="mt-3 h-24 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600"
          />
        ) : null}
        {lastEnv ? (
          <textarea
            readOnly
            value={lastEnv}
            className="mt-3 h-24 w-full rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 font-mono text-[11px] text-slate-700"
          />
        ) : null}

        <div className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold text-slate-700">导入加密包</h3>
          <label className="mt-2 block text-xs text-slate-600">
            粘贴 STARPM_SECRETS_V1.…
            <textarea
              value={packText}
              onChange={(e) => setPackText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[11px] outline-none focus:border-indigo-300"
              placeholder="STARPM_SECRETS_V1.…"
            />
          </label>
          <label className="mt-2 block text-xs text-slate-600">
            导入口令
            <input
              type="password"
              autoComplete="off"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-300"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="import-mode"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
              />
              合并（同名覆盖值）
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="import-mode"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
              />
              覆盖（先清空本项目密钥）
            </label>
            <button
              type="button"
              disabled={pending || !packText.trim()}
              onClick={() => void onImportEncrypted()}
              className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              导入
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">已保存密钥</h2>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-slate-500">加载中…</p>
        ) : secrets.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">暂无项目密钥</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">值</th>
                <th className="px-4 py-3 font-medium">更新于</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {secrets.map((secret) => {
                const show = revealed[secret.id];
                return (
                  <tr key={secret.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{secret.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {show ? secret.value : maskValue(secret.value)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(secret.updatedAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealed((prev) => ({ ...prev, [secret.id]: !prev[secret.id] }))
                          }
                          className="text-indigo-600 hover:underline"
                        >
                          {show ? "隐藏" : "显示"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyValue(secret.value)}
                          className="text-slate-600 hover:underline"
                        >
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(secret)}
                          className="text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
