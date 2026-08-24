import { getAppSetting, upsertAppSetting } from "@/lib/studio/app-settings";
import { BUG_TYPE_LABELS } from "@/lib/types";
import {
  type BugTypeCatalog,
  type CustomBugTypeEntry,
  labelTaken,
  makeCustomBugTypeKey,
  parseBugTypeCatalog,
} from "@/lib/bugs/bug-type-catalog";

export const BUG_TYPE_CATALOG_SETTING_KEY = "bug_type_catalog_v1";

export async function loadBugTypeCatalog(): Promise<BugTypeCatalog> {
  const row = await getAppSetting(BUG_TYPE_CATALOG_SETTING_KEY);
  return parseBugTypeCatalog(row?.value);
}

export async function addCustomBugType(label: string): Promise<{
  catalog: BugTypeCatalog;
  entry: CustomBugTypeEntry;
}> {
  const trimmed = label.trim().slice(0, 40);
  if (!trimmed) throw new Error("类型名称不能为空");
  const catalog = await loadBugTypeCatalog();
  if (labelTaken(trimmed, catalog)) {
    throw new Error(`已有同名类型「${trimmed}」`);
  }
  const taken = new Set<string>([
    ...(Object.keys(BUG_TYPE_LABELS) as string[]),
    ...catalog.custom.map((c) => c.key),
  ]);
  const entry: CustomBugTypeEntry = {
    key: makeCustomBugTypeKey(trimmed, taken),
    label: trimmed,
    createdAt: new Date().toISOString(),
  };
  const next: BugTypeCatalog = { custom: [...catalog.custom, entry] };
  await upsertAppSetting(BUG_TYPE_CATALOG_SETTING_KEY, next);
  return { catalog: next, entry };
}
