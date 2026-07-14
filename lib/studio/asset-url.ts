export function publicStudioAssetUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !storagePath) return "";
  return `${base}/storage/v1/object/public/studio-assets/${storagePath}`;
}
