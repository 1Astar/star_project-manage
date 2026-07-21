"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unlockKeysAction } from "@/lib/auth/actions";

export function KeysUnlockGate({
  title = "密钥区已锁定",
}: {
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("password", password);
    startTransition(async () => {
      const result = await unlockKeysAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPassword("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50/50 p-6">
      <h2 className="text-sm font-semibold text-amber-950">{title}</h2>
      <p className="mt-1 text-xs text-amber-800/80">
        请再次输入管理员密码以查看密钥索引 / 项目密钥（约 30 分钟内有效）。观看者账号无法解锁。
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-slate-600">管理员密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            required
          />
        </label>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || !password}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "验证中…" : "解锁密钥区"}
        </button>
      </form>
    </div>
  );
}
