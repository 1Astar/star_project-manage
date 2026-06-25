"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <div className="text-sm font-semibold text-blue-600">Star PM</div>
          <h1 className="text-xl font-bold">管理员登录</h1>
          <p className="mt-1 text-sm text-slate-500">默认 dev：admin@star.local / star-pm-dev</p>
        </div>
        <input
          name="email"
          type="email"
          required
          placeholder="邮箱"
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
    </div>
  );
}
