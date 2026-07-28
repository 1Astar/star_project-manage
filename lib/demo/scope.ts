import { getAdminSession, isAuthRequired } from "@/lib/auth/session";
import { isViewerRole } from "@/lib/demo/showcase";

/** 生产开启鉴权时：未登录访客 或 观看者 → 只读演示沙盘 */
export async function isDemoPublicScope(): Promise<boolean> {
  if (!isAuthRequired()) return false;
  try {
    const session = await getAdminSession();
    if (!session) return true;
    return isViewerRole(session.role);
  } catch {
    return true;
  }
}

/** 兼容旧名 */
export async function isCurrentUserViewer(): Promise<boolean> {
  return isDemoPublicScope();
}
