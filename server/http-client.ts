import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_IPV4 = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./];

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return PRIVATE_IPV4.some(pattern => pattern.test(address));
  if (isIP(address) === 6) return address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:");
  return false;
}

export async function assertSafeExternalUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("External integrations require HTTPS");
  if (!url.hostname || ["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) throw new Error("Local endpoints are not allowed");
  if (isPrivateAddress(url.hostname)) throw new Error("Private network endpoints are not allowed");
  const records = await lookup(url.hostname, { all: true });
  if (records.some(record => isPrivateAddress(record.address))) throw new Error("Resolved endpoint belongs to a private network");
  return url;
}

export async function externalFetch(rawUrl: string, init: RequestInit = {}, timeoutMs = 15_000) {
  await assertSafeExternalUrl(rawUrl);
  const method = (init.method || "GET").toUpperCase();
  const attempts = method === "GET" ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(rawUrl, { ...init, redirect: "error", signal: controller.signal });
      if (response.ok || attempt === attempts - 1 || response.status < 500) return response;
      lastError = new Error(`External service returned ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("External request failed");
}
