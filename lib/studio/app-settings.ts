import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AppSettingRow = {
  key: string;
  value: unknown;
  updatedAt: string;
};

const memory = new Map<string, AppSettingRow>();

export async function getAppSetting(key: string): Promise<AppSettingRow | null> {
  if (!isSupabaseConfigured()) {
    return memory.get(key) ?? null;
  }
  const client = createServiceClient();
  if (!client) return memory.get(key) ?? null;
  const { data, error } = await client
    .from("studio_app_settings")
    .select("key,value,updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    if (error.message.includes("studio_app_settings")) return memory.get(key) ?? null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    key: data.key as string,
    value: data.value,
    updatedAt: data.updated_at as string,
  };
}

export async function getAppSettings(keys: string[]): Promise<AppSettingRow[]> {
  if (!keys.length) return [];
  if (!isSupabaseConfigured()) {
    return keys.map((k) => memory.get(k)).filter((x): x is AppSettingRow => !!x);
  }
  const client = createServiceClient();
  if (!client) {
    return keys.map((k) => memory.get(k)).filter((x): x is AppSettingRow => !!x);
  }
  const { data, error } = await client
    .from("studio_app_settings")
    .select("key,value,updated_at")
    .in("key", keys);
  if (error) {
    if (error.message.includes("studio_app_settings")) {
      return keys.map((k) => memory.get(k)).filter((x): x is AppSettingRow => !!x);
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    key: row.key as string,
    value: row.value,
    updatedAt: row.updated_at as string,
  }));
}

export async function upsertAppSetting(key: string, value: unknown): Promise<AppSettingRow> {
  const updatedAt = new Date().toISOString();
  const row: AppSettingRow = { key, value, updatedAt };
  memory.set(key, row);

  if (!isSupabaseConfigured()) return row;
  const client = createServiceClient();
  if (!client) return row;

  const { error } = await client.from("studio_app_settings").upsert(
    {
      key,
      value,
      updated_at: updatedAt,
    },
    { onConflict: "key" }
  );
  if (error) {
    if (error.message.includes("studio_app_settings")) return row;
    throw new Error(error.message);
  }
  return row;
}
