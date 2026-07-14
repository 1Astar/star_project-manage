import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProjectById } from "@/lib/studio/data";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";
import type { ProjectSecret, ProjectSecretRow } from "@/lib/secrets/types";

function sb() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置，无法存储项目密钥");
  return client;
}

function nowIso() {
  return new Date().toISOString();
}

function secretId() {
  return `sec-${crypto.randomUUID().slice(0, 12)}`;
}

function rowToSecret(row: ProjectSecretRow): ProjectSecret {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    value: decryptSecret(row.encrypted_value),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertProjectExists(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("项目不存在");
}

export async function listProjectSecrets(projectId: string): Promise<ProjectSecret[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置，无法读取项目密钥");
  }

  await assertProjectExists(projectId);

  const { data, error } = await sb()
    .from("studio_project_secrets")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as ProjectSecretRow[]).map(rowToSecret);
}

export type UpsertProjectSecretInput = {
  name: string;
  value: string;
};

export async function createProjectSecret(
  projectId: string,
  input: UpsertProjectSecretInput
): Promise<ProjectSecret> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置，无法存储项目密钥");
  }

  const name = input.name.trim();
  if (!name) throw new Error("名称必填");
  if (!input.value) throw new Error("值必填");

  await assertProjectExists(projectId);

  const now = nowIso();
  const row: ProjectSecretRow = {
    id: secretId(),
    project_id: projectId,
    name,
    encrypted_value: encryptSecret(input.value),
    created_at: now,
    updated_at: now,
  };

  const { error } = await sb().from("studio_project_secrets").insert(row);
  if (error) {
    if (error.message.includes("unique") || error.code === "23505") {
      throw new Error("同名密钥已存在");
    }
    throw new Error(error.message);
  }

  return rowToSecret(row);
}

export async function updateProjectSecret(
  projectId: string,
  secretIdValue: string,
  input: Partial<UpsertProjectSecretInput>
): Promise<ProjectSecret> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置，无法存储项目密钥");
  }

  const { data: existing, error: fetchError } = await sb()
    .from("studio_project_secrets")
    .select("*")
    .eq("id", secretIdValue)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("密钥不存在");

  const row = existing as ProjectSecretRow;
  const name = input.name !== undefined ? input.name.trim() : row.name;
  if (!name) throw new Error("名称必填");

  const patch: Partial<ProjectSecretRow> = {
    name,
    updated_at: nowIso(),
  };

  if (input.value !== undefined) {
    if (!input.value) throw new Error("值不能为空");
    patch.encrypted_value = encryptSecret(input.value);
  }

  const { data, error } = await sb()
    .from("studio_project_secrets")
    .update(patch)
    .eq("id", secretIdValue)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("unique") || error.code === "23505") {
      throw new Error("同名密钥已存在");
    }
    throw new Error(error.message);
  }

  return rowToSecret(data as ProjectSecretRow);
}

export async function deleteProjectSecret(projectId: string, secretIdValue: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置，无法删除项目密钥");
  }

  const { data, error } = await sb()
    .from("studio_project_secrets")
    .delete()
    .eq("id", secretIdValue)
    .eq("project_id", projectId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("密钥不存在");
}
