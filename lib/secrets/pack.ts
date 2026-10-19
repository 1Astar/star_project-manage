import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const MAGIC = "SPK1";
const PREFIX = "STARPM_SECRETS_V1.";

export type PackedSecretItem = { name: string; value: string };

export type SecretsPackPayload = {
  v: 1;
  exportedAt: string;
  projectId?: string;
  projectTitle?: string;
  secrets: PackedSecretItem[];
};

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

/** 口令加密打包：剪贴板里是乱码，需同口令解开后才是明文 .env / 可导入 */
export function packSecretsWithPassphrase(
  secrets: PackedSecretItem[],
  passphrase: string,
  meta?: { projectId?: string; projectTitle?: string }
): string {
  const pwd = passphrase.trim();
  if (pwd.length < 6) throw new Error("口令至少 6 位");
  if (!secrets.length) throw new Error("没有可导出的密钥");

  const payload: SecretsPackPayload = {
    v: 1,
    exportedAt: new Date().toISOString(),
    projectId: meta?.projectId,
    projectTitle: meta?.projectTitle,
    secrets: secrets.map((s) => ({ name: s.name, value: s.value })),
  };

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(pwd, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  const blob = Buffer.concat([
    Buffer.from(MAGIC, "ascii"),
    Buffer.from([1]),
    salt,
    iv,
    tag,
    encrypted,
  ]);
  return `${PREFIX}${blob.toString("base64url")}`;
}

export function unpackSecretsWithPassphrase(
  pack: string,
  passphrase: string
): SecretsPackPayload {
  const pwd = passphrase.trim();
  if (!pwd) throw new Error("请输入口令");

  const raw = pack.trim();
  if (!raw.startsWith(PREFIX)) {
    throw new Error("不是有效的 Star PM 密钥包（须以 STARPM_SECRETS_V1. 开头）");
  }

  let blob: Buffer;
  try {
    blob = Buffer.from(raw.slice(PREFIX.length), "base64url");
  } catch {
    throw new Error("密钥包损坏");
  }

  if (blob.length < 4 + 1 + 16 + 12 + 16) throw new Error("密钥包过短");
  if (blob.subarray(0, 4).toString("ascii") !== MAGIC) {
    throw new Error("密钥包格式不正确");
  }
  const version = blob[4];
  if (version !== 1) throw new Error(`不支持的密钥包版本 ${version}`);

  const salt = blob.subarray(5, 21);
  const iv = blob.subarray(21, 33);
  const tag = blob.subarray(33, 49);
  const encrypted = blob.subarray(49);

  try {
    const key = deriveKey(pwd, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(plain.toString("utf8")) as SecretsPackPayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.secrets)) {
      throw new Error("密钥包内容无效");
    }
    return parsed;
  } catch (e) {
    if (e instanceof Error && /口令|格式|版本|内容|损坏|开头|过短/.test(e.message)) {
      throw e;
    }
    throw new Error("口令错误或密钥包已损坏");
  }
}

/** 生成可粘贴到 Cloudflare / .env 的明文（解开后才有） */
export function secretsToEnvText(secrets: PackedSecretItem[]): string {
  const lines: string[] = [];
  for (const s of secrets) {
    const name = s.name.trim();
    if (!name) continue;
    const value = s.value;
    if (/[\n\r"\\ ]/.test(value) || value === "") {
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
      lines.push(`${name}="${escaped}"`);
    } else {
      lines.push(`${name}=${value}`);
    }
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}
