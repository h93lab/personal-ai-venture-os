import { describe, expect, it } from "vitest";
import { filterAiTaskRuns } from "./ai-task-filters";

describe("filterAiTaskRuns", () => {
  const runs = [
    { taskId: 1, status: "success" as const, startedAt: "2026-08-19T08:00:00Z" },
    { taskId: 1, status: "failed" as const, startedAt: "2026-08-18T08:00:00Z" },
    { taskId: 2, status: "success" as const, startedAt: "2026-08-19T12:00:00Z" },
  ];

  it("filters by task, status, and inclusive date range together", () => {
    expect(filterAiTaskRuns(runs, { taskId: 1, status: "success", fromDate: "2026-08-19", toDate: "2026-08-19" })).toEqual([runs[0]]);
  });

  it("returns all runs when filters are empty", () => {
    expect(filterAiTaskRuns(runs, {})).toHaveLength(3);
  });
});
