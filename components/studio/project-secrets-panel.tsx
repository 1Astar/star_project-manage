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
