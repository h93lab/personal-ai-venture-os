import { describe, expect, it } from "vitest";
import { toAiStatsExportRows } from "./ai-stats-export";

describe("toAiStatsExportRows", () => {
  it("serializes date, success, and failure counts for CSV/PDF", () => {
    expect(toAiStatsExportRows([{ date: "2026-08-19", success: 3, failed: 1 }])).toEqual([["2026-08-19", "3", "1"]]);
  });
});
