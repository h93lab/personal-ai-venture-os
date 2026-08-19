import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeExternalUrl, externalFetch } from "./http-client";
import { isSameOriginRequest } from "./csrf";
import { decryptSecret, encryptSecret, maskSecret } from "./secrets";

afterEach(() => {
  delete process.env.JWT_SECRET;
  vi.unstubAllGlobals();
});

describe("stored secret protection", () => {
  it("encrypts, decrypts, and masks integration secrets", () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    const encrypted = encryptSecret("secret-value-123");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("secret-value-123");
    expect(decryptSecret(encrypted)).toBe("secret-value-123");
    expect(maskSecret(encrypted)).toBe("secr••••-123");
  });
});

describe("request protection", () => {
  it("accepts same-origin requests and rejects cross-origin mutations", () => {
    const same = { protocol: "https", headers: { origin: "https://app.example.com" }, get: (name: string) => name === "host" ? "app.example.com" : undefined } as never;
    const cross = { protocol: "https", headers: { origin: "https://evil.example" }, get: (name: string) => name === "host" ? "app.example.com" : undefined } as never;
    expect(isSameOriginRequest(same)).toBe(true);
    expect(isSameOriginRequest(cross)).toBe(false);
  });
});

describe("external endpoint protection", () => {
  it("rejects non-HTTPS and local endpoints", async () => {
    await expect(assertSafeExternalUrl("http://example.com/v1")).rejects.toThrow("HTTPS");
    await expect(assertSafeExternalUrl("https://localhost/v1")).rejects.toThrow("Local");
  });

  it("retries a safe GET once after a server error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await externalFetch("https://api.github.com/test", {}, 1000);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
