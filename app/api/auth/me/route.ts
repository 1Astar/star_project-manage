import { getAdminSession } from "@/lib/auth/session";
import { studioOk } from "@/lib/studio/route-utils";

/** 未登录返回 guest，前端右上角显示「登录」 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return studioOk({ account: null, role: "guest" });
  }
  return studioOk({
    account: session.email,
    role: session.role,
  });
}
