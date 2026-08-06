import { requireAdminSession } from "@/lib/auth/require-admin";
import { getAssetById } from "@/lib/studio/data";
import { downloadStudioAssetBase64 } from "@/lib/studio/asset-storage";
import { publicStudioAssetUrl } from "@/lib/studio/asset-url";
import { studioErr, studioOk } from "@/lib/studio/route-utils";

const MAX_CHARS = 400_000;

function looksMarkdown(asset: {
  title: string;
  url: string;
  mimeType: string | null;
  storagePath: string | null;
  note: string;
}) {
  const mime = (asset.mimeType || "").toLowerCase();
  if (mime.includes("markdown") || mime === "text/x-markdown") return true;
  const blob = `${asset.title} ${asset.url} ${asset.storagePath || ""}`.toLowerCase();
  if (/\.md(\?|#|$)/i.test(blob) || blob.includes("skill.md")) return true;
  const note = asset.note?.trim() || "";
  if (note.length > 40 && (/^#{1,3}\s/m.test(note) || /```/.test(note) || /\|.+\|/.test(note))) {
    return true;
  }
  return false;
}

async function fetchTextUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/plain, text/markdown, */*" },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("html") && !ct.includes("markdown") && !ct.includes("text/plain")) {
      return null;
    }
    const text = await res.text();
    return text.slice(0, MAX_CHARS);
  } catch {
    return null;
  }
}

/** 读取资源 Markdown 正文，供资源中心预览。 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const asset = await getAssetById(id);
  if (!asset) return studioErr("资源不存在", 404);
  if (!looksMarkdown(asset) && !(asset.note || "").trim()) {
    return studioErr("该资源不是 Markdown，无法预览", 400);
  }

  let content: string | null = null;
  let source: "storage" | "url" | "note" | null = null;

  if (asset.storagePath) {
    const b64 = await downloadStudioAssetBase64(asset.storagePath);
    if (b64) {
      content = Buffer.from(b64, "base64").toString("utf8").slice(0, MAX_CHARS);
      source = "storage";
    } else {
      const pub = asset.url || publicStudioAssetUrl(asset.storagePath);
      if (pub) {
        content = await fetchTextUrl(pub);
        if (content) source = "url";
      }
    }
  } else if (asset.url) {
    content = await fetchTextUrl(asset.url);
    if (content) source = "url";
  }

  if (!content && asset.note?.trim()) {
    content = asset.note.trim().slice(0, MAX_CHARS);
    source = "note";
  }

  if (!content) {
    return studioErr("无法读取 Markdown 内容（链接需可公开访问，或改用上传/备注）", 422);
  }

  return studioOk({
    assetId: asset.id,
    title: asset.title,
    source,
    content,
  });
}
