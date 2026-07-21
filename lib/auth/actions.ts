"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  resolveLoginRole,
  setAdminSession,
} from "@/lib/auth/session";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const account = String(formData.get("account") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = resolveLoginRole(account, password);
  if (!role) {
    return { error: "账号或密码错误" };
  }
  await setAdminSession(account, role);
  return {};
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}
