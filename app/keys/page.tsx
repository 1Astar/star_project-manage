import { getAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/** 旧「密钥索引」已并入各项目 · 资源中心 · 密钥 */
export default async function KeysPage() {
  const session = await getAdminSession();
  if (session?.role !== "admin") {
    redirect("/?error=keys-forbidden");
  }
  redirect("/projects/proj-star-pm/resources?cat=secrets");
}
