"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  setAdminSession,
  validateAdminCredentials,
} from "@/lib/auth/session";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const account = String(formData.get("account") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!validateAdminCredentials(account, password)) {
    return { error: "账号或密码错误" };
  }
  await setAdminSession(account);
  return {};
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}
