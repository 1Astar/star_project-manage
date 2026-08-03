import { getAdminSession, type AuthSession } from "@/lib/auth/session";
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

/** 观看者 / 未登录访客只读：写操作前调用（server action 抛错） */
export async function assertNotViewerWrite() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    throw new Error("公开演示为只读，改数据请管理员登录");
  }
}
