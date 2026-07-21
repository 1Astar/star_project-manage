import { requireAdminSession } from "@/lib/auth/require-admin";
import { studioOk } from "@/lib/studio/route-utils";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  return studioOk({
    account: auth.session!.email,
    role: auth.session!.role,
  });
}
