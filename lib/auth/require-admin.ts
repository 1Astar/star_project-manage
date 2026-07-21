import { getAdminSession, hasKeysUnlock, type AuthSession } from "@/lib/auth/session";
import { studioErr } from "@/lib/studio/route-utils";

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    return { session: null as AuthSession | null, error: studioErr("未授权", 401) };
  }
  return { session, error: null };
}

/** 必须是管理员（观看者 403） */
export async function requireAdminRole() {
  const auth = await requireAdminSession();
  if (auth.error) return auth;
  if (auth.session!.role !== "admin") {
    return {
      session: auth.session,
      error: studioErr("观看者无权访问此功能", 403),
    };
  }
  return auth;
}

/** 管理员 + 密钥区已二次解锁 */
export async function requireKeysAccess() {
  const auth = await requireAdminRole();
  if (auth.error) return auth;
  if (!(await hasKeysUnlock())) {
    return {
      session: auth.session,
      error: studioErr("请先二次验证管理员密码以访问密钥区", 403),
    };
  }
  return auth;
}
