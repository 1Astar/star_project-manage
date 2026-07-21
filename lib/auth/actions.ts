"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  clearKeysUnlock,
  getAdminPassword,
  getAdminSession,
  resolveLoginRole,
  setAdminSession,
  setKeysUnlock,
} from "@/lib/auth/session";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const account = String(formData.get("account") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = resolveLoginRole(account, password);
  if (!role) {
    return { error: "账号或密码错误" };
  }
  await setAdminSession(account, role);
  await clearKeysUnlock();
  return {};
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

/** 管理员二次确认密码，解锁密钥区（约 30 分钟） */
export async function unlockKeysAction(
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { error: "需要管理员登录" };
  }
  const password = String(formData.get("password") ?? "");
  if (!password || password !== getAdminPassword()) {
    return { error: "密码错误" };
  }
  await setKeysUnlock();
  return { ok: true };
}
