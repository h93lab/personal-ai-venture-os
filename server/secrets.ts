import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey() {
  const source = process.env.JWT_SECRET;
  if (!source) throw new Error("JWT_SECRET is required to protect stored integration secrets");
  return createHash("sha256").update(source, "utf8").digest();
}

export function encryptSecret(value: string) {
  if (!value) throw new Error("Secret value cannot be empty");
  if (value.startsWith(PREFIX)) return value;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptSecret(value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const encoded = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (encoded.length <= IV_BYTES + TAG_BYTES) throw new Error("Stored secret is malformed");
  const iv = encoded.subarray(0, IV_BYTES);
  const tag = encoded.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = encoded.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  const plain = decryptSecret(value);
  return plain.length <= 8 ? "••••••••" : `${plain.slice(0, 4)}••••${plain.slice(-4)}`;
}
