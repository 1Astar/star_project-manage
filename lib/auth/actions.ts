"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  setAdminSession,
  validateAdminCredentials,
} from "@/lib/auth/session";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!validateAdminCredentials(email, password)) {
    return { error: "邮箱或密码错误" };
  }
  await setAdminSession(email);
  return {};
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}
