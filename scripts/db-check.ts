import { pingSupabase } from "../lib/db/supabase-store";
import { getSupabasePublicConfig, isSupabaseConfigured } from "../lib/supabase/config";

async function main() {
  const config = getSupabasePublicConfig();
  const url = config.url ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  console.log("Supabase URL:", url || "(未设置)");
  console.log("Anon Key:", anon ? `已设置 (${anon.length} 字符)` : "未设置 ← 必填");
  console.log("Service Role:", service ? `已设置 (${service.length} 字符)` : "未设置 ← 必填（服务端读写靠这个）");

  if (!service) {
    console.log("\n❌ SUPABASE_SERVICE_ROLE_KEY 为空，应用不会走 Supabase。");
    console.log("请打开 .env.local，把 Dashboard → API 里的 key 填到等号后面，例如：");
    console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...");
    console.log("  SUPABASE_SERVICE_ROLE_KEY=eyJhbG...");
    console.log("\n常见误操作：");
    console.log("  · 只填在 Vercel 里，本地 .env.local 没改");
    console.log("  · 变量名写错（必须是 NEXT_PUBLIC_SUPABASE_ANON_KEY，不是 SUPABASE_ANON_KEY）");
    console.log("  · 填完没保存，或 dev server 没重启");
    process.exit(1);
  }

  if (!isSupabaseConfigured()) {
    console.log("\n当前使用本地 JSON / 内存存储");
    process.exit(0);
  }

  const result = await pingSupabase();
  if (result.ok) {
    console.log(`\n✅ Supabase 连接正常，projects 表 ${result.projectCount} 条`);
    if (result.projectCount === 0) {
      console.log("表是空的没关系：启动应用后会自动写入种子数据，或手动执行 003_seed.sql");
    }
    return;
  }

  console.error("\n❌ Supabase 连接失败:", result.error);
  console.error("Key 已填但仍失败时：检查是否复制完整、是否用了 service_role（不是 anon）填到 SERVICE_ROLE 那行");
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // 给 Supabase HTTP 连接留时间关闭，避免 Windows 上 libuv 断言崩溃
    setTimeout(() => process.exit(process.exitCode ?? 0), 50);
  });
