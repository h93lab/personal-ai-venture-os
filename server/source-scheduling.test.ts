import { describe, expect, it } from "vitest";
import { assertValidTimeZone, localTimeToUtcCron } from "./schedule-utils";
import { competitorThreatScore } from "./competitor-refresh";

describe("source scheduling helpers", () => {
  it("converts Asia/Dubai local morning to UTC cron", () => {
    expect(localTimeToUtcCron(8, 0, "Asia/Dubai", new Date("2026-01-15T00:00:00Z"))).toBe("0 0 4 * * *");
  });
  it("rejects invalid IANA timezones", () => {
    expect(() => assertValidTimeZone("Not/AZone")).toThrow("Invalid IANA timezone");
  });
  it("scores competitor activity within the bounded threat range", () => {
    expect(competitorThreatScore({ stargazers_count: 1000, forks_count: 100, open_issues_count: 20 })).toBeGreaterThan(0);
    expect(competitorThreatScore({ stargazers_count: 999999999, forks_count: 999999999, open_issues_count: 999999999 })).toBeLessThanOrEqual(100);
  });
});
