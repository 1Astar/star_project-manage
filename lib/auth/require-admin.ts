import { getAdminSession } from "@/lib/auth/session";
import { studioErr } from "@/lib/studio/route-utils";

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    return { session: null, error: studioErr("未授权", 401) };
  }
  return { session, error: null };
}
