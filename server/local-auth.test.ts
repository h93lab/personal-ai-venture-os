import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(async () => ({ id: 1, openId: "local-admin", name: "Venture OS Admin", email: null, loginMethod: "local-pin", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() })),
  upsertUser: vi.fn(async () => undefined),
  updateLocalPin: vi.fn(async (_id: number, pinHash: string) => ({ id: 1, openId: "local-admin", name: "Venture OS Admin", email: null, loginMethod: "local-pin", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), pinHash, authVersion: 1 })),
}));

import { changeLocalPin, hashPin, loginWithPin } from "./local-auth";

function mockRequest() {
  return { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" }, cookies: {}, headers: {}, protocol: "http" } as never;
}

function mockResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as never;
}

describe("local PIN authentication", () => {
  beforeEach(() => {
    process.env.LOCAL_AUTH_PIN = "0566";
    delete process.env.LOCAL_AUTH_PIN_HASH;
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  it("accepts the configured PIN through the login API handler", async () => {
    const response = await loginWithPin(mockRequest(), mockResponse(), process.env.LOCAL_AUTH_PIN!);
    expect(response.ok).toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    const response = await loginWithPin(mockRequest(), mockResponse(), "9999");
    expect(response.ok).toBe(false);
  });

  it("changes the PIN and clears the current session", async () => {
    const response = mockResponse();
    const user = { id: 1, openId: "local-admin", name: "Venture OS Admin", email: null, loginMethod: "local-pin", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), pinHash: hashPin("0566", "test-salt"), authVersion: 0 } as any;
    const result = await changeLocalPin(mockRequest(), response, user, "0566", "1234");
    expect(result.ok).toBe(true);
    expect(response.clearCookie).toHaveBeenCalled();
  });
});
