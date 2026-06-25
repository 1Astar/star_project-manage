"use client";

import { logoutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
      >
        退出登录
      </button>
    </form>
  );
}
