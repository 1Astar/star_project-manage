"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { appVersionLabel } from "@/lib/app-meta";
import { loginAction } from "@/lib/auth/actions";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await loginAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-blue-600">Star PM</div>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {appVersionLabel()}
            </span>
          </div>
          <h1 className="text-xl font-bold">管理员登录</h1>
          <p className="mt-1 text-sm text-slate-500">账号 admin</p>
        </div>
        <input
          name="account"
          type="text"
          required
          autoComplete="username"
          placeholder="账号"
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="密码"
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          登录
        </button>
      </form>
      <AppBrandFooter className="mt-6 w-full max-w-sm border-none px-1" />
    </div>
  );
}
