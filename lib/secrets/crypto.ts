import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (raw) {
    const fromBase64 = Buffer.from(raw, "base64");
    if (fromBase64.length === 32) return fromBase64;

    const fromHex = Buffer.from(raw, "hex");
    if (fromHex.length === 32) return fromHex;

    throw new Error("SECRETS_ENCRYPTION_KEY 须为 32 字节（base64 或 hex）");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置 SECRETS_ENCRYPTION_KEY");
  }

  return createHash("sha256")
    .update(process.env.ADMIN_SESSION_SECRET ?? "dev-secret-change-in-production")
    .digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

export function decryptSecret(payload: string): string {
  let parsed: { iv: string; tag: string; data: string };
  try {
    parsed = JSON.parse(payload) as { iv: string; tag: string; data: string };
  } catch {
    throw new Error("密钥数据损坏");
  }

  const decipher = createDecipheriv(
    ALGO,
    getEncryptionKey(),
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
