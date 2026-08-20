import { describe, expect, it, vi } from "vitest";

const externalFetch = vi.fn();
const findDiscoverySignalBySourceKey = vi.fn();
const insertDiscoverySignal = vi.fn();
const updateDiscoveryFetch = vi.fn();
const updateDiscoverySignal = vi.fn();
const getDiscoverySettingsByTaskUid = vi.fn();
vi.mock("./http-client", () => ({ externalFetch }));
vi.mock("./db", () => ({ findDiscoverySignalBySourceKey, insertDiscoverySignal, updateDiscoveryFetch, updateDiscoverySignal, getDiscoverySettingsByTaskUid }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));

const { normalizeHackerNewsHits, refreshDiscoveryForUser, scoreHackerNewsHit } = await import("./discovery-refresh");

describe("discovery source", () => {
  it("normalizes Hacker News hits into scored signals with stable keys", () => {
    expect(scoreHackerNewsHit({ points: 50, num_comments: 10 })).toBe(68);
    expect(normalizeHackerNewsHits({ hits: [{ objectID: "123", title: "Build a mobile tool", points: 50, num_comments: 10, url: "https://example.com/post" }] })).toEqual([expect.objectContaining({ sourceKey: "hn:123", sourceUrl: "https://example.com/post", score: 68, sourceCount: 1 })]);
  });

  it("updates existing source keys and inserts only new signals", async () => {
    findDiscoverySignalBySourceKey.mockImplementation(async (_userId: number, key: string) => key === "hn:old" ? { id: 7 } : undefined);
    externalFetch.mockResolvedValue({ ok: true, json: async () => ({ hits: [{ objectID: "old", title: "Old story", points: 10, num_comments: 1 }, { objectID: "new", title: "New story", points: 20, num_comments: 2 }] }) });
    const result = await refreshDiscoveryForUser(55, "mobile apps");
    expect(result).toEqual({ fetched: 2, inserted: 1, updated: 1 });
    expect(updateDiscoverySignal).toHaveBeenCalledWith(55, 7, expect.objectContaining({ sourceKey: "hn:old" }));
    expect(insertDiscoverySignal).toHaveBeenCalledWith(expect.objectContaining({ userId: 55, sourceKey: "hn:new" }));
    expect(updateDiscoveryFetch).toHaveBeenCalledWith(55, expect.any(Date));
  });
});
