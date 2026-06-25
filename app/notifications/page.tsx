import Link from "next/link";
import { readDb } from "@/lib/db";
import { AppShell } from "@/components/ui";

export default async function NotificationsPage() {
  const db = await readDb();
  const notifications = db.notifications.slice(0, 50);

  return (
    <AppShell
      title="通知中心"
      subtitle="任务分配、待测试、测试不通过、待验收等系统内提醒"
      actions={
        <Link href="/" className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
          返回总览
        </Link>
      }
    >
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">暂无通知</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`card p-4 ${n.is_read ? "opacity-70" : "border-blue-200"}`}
            >
              <div className="font-medium">{n.title}</div>
              {n.body ? <p className="mt-1 text-sm text-slate-600">{n.body}</p> : null}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                <span>{new Date(n.created_at).toLocaleString("zh-CN")}</span>
                {n.link ? (
                  <Link href={n.link} className="text-blue-600">
                    查看
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
