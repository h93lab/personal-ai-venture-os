import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const listLLMModels = vi.fn();
const invokeLLM = vi.fn();
const getAiProviderSettings = vi.fn();
const getGithubConnection = vi.fn();
const upsertGithubConnection = vi.fn();
const updateGithubSync = vi.fn();
const deleteGithubConnection = vi.fn();
const getDiscoverySettings = vi.fn();
const upsertDiscoverySettings = vi.fn();
const getDiscoverySettingsByTaskUid = vi.fn();
const findDiscoverySignalBySourceKey = vi.fn();
const insertDiscoverySignal = vi.fn();
const updateDiscoveryFetch = vi.fn();
const updateDiscoverySignal = vi.fn();
const createHeartbeatJob = vi.fn();
const deleteHeartbeatJob = vi.fn();

vi.mock("./_core/llm", () => ({ listLLMModels, invokeLLM }));
vi.mock("./db", () => ({ getAiProviderSettings, getGithubConnection, upsertGithubConnection, updateGithubSync, deleteGithubConnection, getDiscoverySettings, upsertDiscoverySettings, getDiscoverySettingsByTaskUid, findDiscoverySignalBySourceKey, insertDiscoverySignal, updateDiscoveryFetch, updateDiscoverySignal }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob, deleteHeartbeatJob }));
vi.mock("./http-client", () => ({ externalFetch: (url: string, init?: RequestInit) => globalThis.fetch(url, init) }));

const { appRouter } = await import("./routers");

type TestContext = TrpcContext;
function context(): TestContext {
  return {
    user: { id: 11, openId: "refresh-user", name: "Refresh User", email: "refresh@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: { cookie: "" } } as TestContext["req"],
    res: {} as TestContext["res"],
  };
}

describe("connection tests and GitHub refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiProviderSettings.mockResolvedValue(undefined);
    getGithubConnection.mockResolvedValue({ userId: 11, token: "ghp_valid_token_1234", repoOwner: "owner", repoName: "repo", healthThreshold: 70, refreshMinutes: 60, scheduleCronTaskUid: null });
    getDiscoverySettings.mockResolvedValue({ userId: 11, source: "hn_algolia", query: "mobile apps", enabled: 1, scheduleCronTaskUid: null });
  });

  it("tests a custom OpenAI-compatible provider without returning the API key", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const result = await appRouter.createCaller(context()).ai.testCustomConnection({ endpoint: "https://provider.example/v1", apiKey: "secret-api-key-123", provider: "Custom" });
    expect(result).toEqual({ connected: true, modelCount: 2, models: ["model-a", "model-b"] });
    expect(JSON.stringify(result)).not.toContain("secret-api-key-123");
    globalThis.fetch = originalFetch;
  });

  it("creates a Heartbeat refresh job with the selected cadence", async () => {
    createHeartbeatJob.mockResolvedValue({ taskUid: "task-123", nextExecutionAt: "2026-08-19T10:00:00Z" });
    const result = await appRouter.createCaller(context()).github.configureRefresh({ refreshMinutes: 30, healthThreshold: 65 });
    expect(createHeartbeatJob).toHaveBeenCalledWith(expect.objectContaining({ cron: "0 */15 * * * *", path: "/api/scheduled/github-refresh" }), "");
    expect(result.taskUid).toBe("task-123");
  });

  it("creates a daily Discovery Heartbeat job with the source callback path", async () => {
    createHeartbeatJob.mockResolvedValue({ taskUid: "discovery-task-1", nextExecutionAt: "2026-08-21T08:00:00Z" });
    const result = await appRouter.createCaller(context()).discovery.configureSchedule({ query: "mobile apps", enabled: true });
    expect(createHeartbeatJob).toHaveBeenCalledWith(expect.objectContaining({ cron: "0 * * * * *", path: "/api/scheduled/discovery-refresh", description: expect.stringContaining("08:00 Asia/Dubai") }), "");
    expect(upsertDiscoverySettings).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, query: "mobile apps", enabled: 1, timezone: "Asia/Dubai", localHour: 8, localMinute: 0, scheduleCronTaskUid: "discovery-task-1" }));
    expect(result.taskUid).toBe("discovery-task-1");
  });

  it("surfaces a warning when GitHub health is below the configured threshold", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ full_name: "owner/repo", stargazers_count: 1, open_issues_count: 25, pushed_at: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 25 }, (_, id) => ({ id }))), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 5 }, (_, id) => ({ id }))), { status: 200 })) as typeof fetch;
    const result = await appRouter.createCaller(context()).github.status();
    expect(result.connected).toBe(true);
    if (result.connected) expect(result.warning).toBe(true);
    expect(updateGithubSync).toHaveBeenCalledWith(11, expect.objectContaining({ health: expect.any(Number) }));
    globalThis.fetch = originalFetch;
  });
});
