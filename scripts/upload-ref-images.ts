/**
 * 一次性脚本：将禅道参考截图上传到 Supabase studio-assets，并写入 studio_assets。
 * 用法：
 *   npx tsx scripts/upload-ref-images.ts
 *   npx tsx scripts/upload-ref-images.ts "C:\path\to\images"
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "proj-star-pm";

const IMAGES: Array<{ file: string; title: string; takeaway: string }> = [
  {
    file: "c__Users_l1397_AppData_Roaming_Cursor_User_workspaceStorage_83a3472ea3a40033a3472fd4751305b7_images_image-db357596-911f-4239-aaa2-2472be10baff.png",
    title: "禅道看板参考",
    takeaway: "列式看板 + 任务卡片",
  },
  {
    file: "c__Users_l1397_AppData_Roaming_Cursor_User_workspaceStorage_83a3472ea3a40033a3472fd4751305b7_images_image-41fb2825-6b71-4b6c-a55e-0222aeba6674.png",
    title: "禅道 Bug 列表参考",
    takeaway: "Notion 式表格列设计",
  },
  {
    file: "c__Users_l1397_AppData_Roaming_Cursor_User_workspaceStorage_83a3472ea3a40033a3472fd4751305b7_images_image-6272b95f-c546-4e79-b2d8-ad1d67e79a32.png",
    title: "禅道文档库参考",
    takeaway: "资料/附件库布局",
  },
  {
    file: "c__Users_l1397_AppData_Roaming_Cursor_User_workspaceStorage_83a3472ea3a40033a3472fd4751305b7_images_image-32792aee-a9a5-4d56-8011-14c8d0a812fe.png",
    title: "禅道项目概况参考",
    takeaway: "概况页 widget + 燃尽图改甘特",
  },
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function resolveAssetsDir(): string {
  const fromArg = process.argv[2];
  if (fromArg) return path.resolve(fromArg);

  const candidates = [
    path.join(process.cwd(), "scripts", "ref-images"),
    path.join(process.env.USERPROFILE ?? "", ".cursor", "projects", "e-star-private", "assets"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  return candidates[0];
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（.env.local）");
    process.exit(1);
  }

  const assetsDir = resolveAssetsDir();
  console.log("图片目录:", assetsDir);

  const sb = createClient(url, key);
  let ok = 0;

  for (const item of IMAGES) {
    const localPath = path.join(assetsDir, item.file);
    if (!fs.existsSync(localPath)) {
      console.warn("跳过（文件不存在）:", item.file);
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    const storagePath = `${PROJECT_ID}/refs/${item.file}`;
    const publicUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/studio-assets/${storagePath}`;

    const { error: upErr } = await sb.storage.from("studio-assets").upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: true,
    });
    if (upErr) {
      console.error("上传失败", item.title, upErr.message);
      continue;
    }

    const assetId = `asset-ref-${item.file.slice(-20, -4)}`;
    const { error: dbErr } = await sb.from("studio_assets").upsert(
      {
        id: assetId,
        title: item.title,
        project_id: PROJECT_ID,
        asset_type: "ui_ref",
        url: publicUrl,
        storage_path: storagePath,
        mime_type: "image/png",
        note: "禅道 UI 参考截图",
        takeaway: item.takeaway,
        risk: null,
      },
      { onConflict: "id" }
    );

    if (dbErr) {
      console.error("写入资料失败", item.title, dbErr.message);
      continue;
    }

    ok += 1;
    console.log("OK:", item.title, publicUrl);
  }

  if (ok === 0) {
    console.log("\n未上传任何文件。可：");
    console.log("1. 把 4 张 png 放到 scripts/ref-images/ 后重跑");
    console.log("2. 或在 /projects/proj-star-pm/resources 点「+ 上传图片」");
  } else {
    console.log(`\n完成 ${ok}/${IMAGES.length} 张`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
