import { describe, expect, it } from "vitest";
import { cronForAiTask } from "./routers";

describe("AI task timezone scheduling", () => {
  it("converts the user's local time to UTC for Heartbeat", () => {
    expect(cronForAiTask("daily", "08:00", "UTC")).toBe("0 0 8 * * *");
    expect(cronForAiTask("daily", "08:00", "Asia/Dubai")).toBe("0 0 4 * * *");
  });
});
