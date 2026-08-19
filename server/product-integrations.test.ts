import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const invokeLLM = vi.fn();
const listLLMModels = vi.fn();
const getAiProviderSettings = vi.fn();
const upsertAiProviderSettings = vi.fn();
const deleteAiProviderSettings = vi.fn();
const getGithubConnection = vi.fn();
const upsertGithubConnection = vi.fn();
const deleteGithubConnection = vi.fn();

vi.mock("./_core/llm", () => ({ invokeLLM, listLLMModels }));
vi.mock("./db", () => ({ getAiProviderSettings, upsertAiProviderSettings, deleteAiProviderSettings, getGithubConnection, upsertGithubConnection, deleteGithubConnection }));
vi.mock("./http-client", () => ({ externalFetch: (url: string, init?: RequestInit) => globalThis.fetch(url, init) }));

const { appRouter } = await import("./routers");

afterEach(() => vi.unstubAllGlobals());

type TestContext = TrpcContext;

function context(): TestContext {
  return {
    user: { id: 7, openId: "test-user", name: "Test", email: "test@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TestContext["req"],
    res: {} as TestContext["res"],
  };
}

describe("Product Brief integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns structured Product Brief content from the LLM", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ problem: "p", targetUser: "u", valueProposition: "v", scope: ["s"], screens: ["home"], userStories: ["story"], dataModel: ["users"], acceptanceCriteria: ["works"], risks: ["risk"], nextStep: "test" }) } }] });
    const result = await appRouter.createCaller(context()).productBrief.generate({ idea: "Test app", productType: "تطبيق موبايل", focus: "MVP" });
    expect(result.problem).toBe("p");
    expect(result.screens).toEqual(["home"]);
  });

  it("fails safely when the LLM returns invalid JSON", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "not-json" } }] });
    await expect(appRouter.createCaller(context()).productBrief.generate({ idea: "Test app", productType: "تطبيق موبايل" })).rejects.toThrow();
  });
});

describe("AI connection integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tests the built-in AI connection and returns available models", async () => {
    listLLMModels.mockResolvedValue({ data: [{ id: "model-a" }, { id: "model-b" }] });
    const result = await appRouter.createCaller(context()).ai.testConnection();
    expect(result).toEqual({ connected: true, modelCount: 2, models: [{ id: "model-a" }, { id: "model-b" }] });
    expect(listLLMModels).toHaveBeenCalledOnce();
  });
});

describe("GitHub connection integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ full_name: "owner/repo", stargazers_count: 2, open_issues_count: 1, pushed_at: "2026-08-19T00:00:00Z" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ sha: "abc", commit: { author: { date: "2026-08-19T00:00:00Z" } } }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 1 }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) }));
  });

  it("tests GitHub with the saved token when no new token is supplied", async () => {
    getGithubConnection.mockResolvedValue({ token: "ghp_1234567890abcdef", repoOwner: "owner", repoName: "repo" });
    const result = await appRouter.createCaller(context()).github.testConnection({ repoOwner: "owner", repoName: "repo" });
    expect(result.connected).toBe(true);
    expect(result.repo).toBe("owner/repo");
    expect(result.token).toBe("ghp_••••cdef");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});

describe("GitHub settings integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a masked token and saves settings for the current user", async () => {
    getGithubConnection.mockResolvedValue({ token: "ghp_1234567890abcdef", repoOwner: "owner", repoName: "repo" });
    const caller = appRouter.createCaller(context());
    const settings = await caller.github.getSettings();
    expect(settings.token).toBe("ghp_••••cdef");
    await caller.github.saveSettings({ repoOwner: "new-owner", repoName: "new-repo" });
    expect(upsertGithubConnection).toHaveBeenCalledWith({ userId: 7, token: "ghp_1234567890abcdef", repoOwner: "new-owner", repoName: "new-repo", healthThreshold: 50, refreshMinutes: 60, scheduleCronTaskUid: null });
  });

  it("deletes the current user's GitHub connection", async () => {
    await appRouter.createCaller(context()).github.deleteSettings();
    expect(deleteGithubConnection).toHaveBeenCalledWith(7);
  });
});
