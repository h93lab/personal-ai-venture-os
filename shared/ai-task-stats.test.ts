import { describe, expect, it } from "vitest";
import { buildAiTaskStats } from "./ai-task-stats";

describe("buildAiTaskStats", () => {
  it("returns a continuous date series and counts success/failure", () => {
    const now = new Date("2026-08-19T12:00:00Z");
    const rows = [
      { status: "success" as const, startedAt: "2026-08-19T08:00:00Z" },
      { status: "failed" as const, startedAt: "2026-08-19T09:00:00Z" },
      { status: "running" as const, startedAt: "2026-08-18T09:00:00Z" },
    ];
    expect(buildAiTaskStats(rows, 2, now)).toEqual([{ date: "2026-08-18", success: 0, failed: 0 }, { date: "2026-08-19", success: 1, failed: 1 }]);
  });
});
