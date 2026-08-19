import { describe, expect, it, vi, beforeEach } from "vitest";

const getTelegramConnection = vi.fn();
vi.mock("./db", () => ({ getTelegramConnection }));
const { testTelegramConnection, notifyTelegram, renderTelegramTemplate } = await import("./telegram");

describe("Telegram notifications", () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("validates the bot and sends a test message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: { username: "venture_bot" } }) } as Response);
    const result = await testTelegramConnection({ botToken: "12345678901234567890:token", chatId: "123" });
    expect(result).toEqual({ connected: true, botName: "venture_bot" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders task title, result, and error variables in a custom template", () => {
    expect(renderTelegramTemplate("{{task_title}} | {{result}} | {{error}}", { task_title: "Market scan", result: "3 ideas", error: "" })).toBe("Market scan | 3 ideas | ");
  });

  it("skips notification when Telegram is not configured", async () => {
    getTelegramConnection.mockResolvedValue(undefined);
    await expect(notifyTelegram(42, "hello")).resolves.toEqual({ sent: false, reason: "not-configured" });
  });
});
