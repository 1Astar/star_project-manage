import { getAdminSession } from "@/lib/auth/session";
import { isViewerRole } from "@/lib/demo/showcase";

/**
 * 未登录访客 / 观看者 → 只读演示沙盘（绝不读真实 Bug/私域项目）。
 * 已登录管理员 → 全量。
 *
 * 与 REQUIRE_AUTH 解耦：即便托管环境误配 REQUIRE_AUTH=false，
 * 只要没有真实 admin session，仍走演示范围。
 */
export async function isDemoPublicScope(): Promise<boolean> {
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
