"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ENV_NAME_SUGGESTIONS } from "@/lib/secrets/env-suggestions";

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
  /** 嵌在资源中心时略去外层大标题感 */
  embedded?: boolean;
};

function maskValue(value: string) {
  if (!value) return "（待填）";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}${"•".repeat(Math.min(12, value.length - 2))}`;
}

export function ProjectSecretsPanel({ projectId, embedded = false }: ProjectSecretsPanelProps) {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const [exportPass, setExportPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [packText, setPackText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [lastPack, setLastPack] = useState<string | null>(null);
  const [lastEnv, setLastEnv] = useState<string | null>(null);

  const existingNames = useMemo(
    () => new Set(secrets.map((s) => s.name.toUpperCase())),
    [secrets]
  );

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

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setMessage(okMsg);
    } catch {
      setError("复制失败");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setError("请填写变量名");
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
      setMessage(newValue ? "已保存（服务端加密）" : "已保存变量名（值可稍后填）");
      await loadSecrets();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit(secret: SecretItem) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/secrets/${secret.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "更新失败");
        return;
      }
      setEditingId(null);
      setEditValue("");
      setMessage("已更新值（服务端加密）；复制值为明文");
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
      <section className={embedded ? "" : "rounded-xl border border-slate-200 bg-white p-6"}>
        {!embedded ? (
          <h2 className="text-sm font-semibold text-slate-800">本项目密钥</h2>
        ) : null}
        <p className={`text-xs text-slate-500 ${embedded ? "" : "mt-1"}`}>
          可先存变量名、值稍后填。库内 AES 加密；「复制名 / 复制值」得到明文，粘贴即正确。
        </p>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">常用变量名（一键复制 / 填入）</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2">
            {ENV_NAME_SUGGESTIONS.map((row) => {
              const taken = existingNames.has(row.key.toUpperCase());
              return (
                <li
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white"
                >
                  <div className="min-w-0">
                    <code className="font-mono text-slate-800">{row.key}</code>
                    <span className="ml-2 text-slate-400">{row.purpose}</span>
                    {taken ? (
                      <span className="ml-2 text-[10px] text-emerald-600">已有</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(row.key, `已复制变量名 ${row.key}`)}
                      className="text-indigo-600 hover:underline"
                    >
                      复制名
                    </button>
                    <button
                      type="button"
                      disabled={taken}
                      onClick={() => {
                        setNewName(row.key);
                        setMessage(`已填入 ${row.key}，可填值后保存（值可空）`);
                      }}
                      className="text-slate-600 hover:underline disabled:opacity-40"
                    >
                      填入
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            变量名
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如 OPENAI_API_KEY"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
            />
          </label>
          <label className="block text-xs text-slate-600">
            值（可留空稍后填）
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder="明文；提交后库内加密"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-300"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存"}
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
          <p className="px-4 py-8 text-sm text-slate-500">暂无密钥；可先从上方复制变量名再保存</p>
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
                const isEditing = editingId === secret.id;
                return (
                  <tr key={secret.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{secret.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {isEditing ? (
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          type="password"
                          autoComplete="off"
                          className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1"
                          placeholder="填入明文值"
                        />
                      ) : show ? (
                        secret.value || "（空）"
                      ) : (
                        maskValue(secret.value)
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(secret.updatedAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => void handleSaveEdit(secret)}
                              className="text-indigo-600 hover:underline"
                            >
                              保存值
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditValue("");
                              }}
                              className="text-slate-500 hover:underline"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void copyText(secret.name, `已复制变量名 ${secret.name}`)}
                              className="text-indigo-600 hover:underline"
                            >
                              复制名
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(
                                  secret.value,
                                  secret.value
                                    ? `已复制 ${secret.name} 的值（明文）`
                                    : "值为空，请先填值"
                                )
                              }
                              className="text-slate-600 hover:underline"
                            >
                              复制值
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealed((prev) => ({
                                  ...prev,
                                  [secret.id]: !prev[secret.id],
                                }))
                              }
                              className="text-slate-600 hover:underline"
                            >
                              {show ? "隐藏" : "显示"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(secret.id);
                                setEditValue(secret.value);
                              }}
                              className="text-slate-600 hover:underline"
                            >
                              改值
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(secret)}
                              className="text-red-600 hover:underline"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800">一键导出 / 导入</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          <strong className="font-medium text-slate-600">加密包</strong>
          ：剪贴板是乱码，可转发；导入需同一口令。
          <br />
          <strong className="font-medium text-slate-600">明文 .env</strong>
          ：配 CF/本地用；复制后为正确明文。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600 sm:col-span-2">
            导出口令（≥6 位）
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
    </div>
  );
}
