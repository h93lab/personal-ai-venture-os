import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const invokeLLM = vi.fn();
const getGithubConnection = vi.fn();
const upsertGithubConnection = vi.fn();
const deleteGithubConnection = vi.fn();

vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./db", () => ({ getGithubConnection, upsertGithubConnection, deleteGithubConnection }));

const { appRouter } = await import("./routers");

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

describe("GitHub settings integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a masked token and saves settings for the current user", async () => {
    getGithubConnection.mockResolvedValue({ token: "ghp_1234567890abcdef", repoOwner: "owner", repoName: "repo" });
    const caller = appRouter.createCaller(context());
    const settings = await caller.github.getSettings();
    expect(settings.token).toBe("ghp_••••cdef");
    await caller.github.saveSettings({ repoOwner: "new-owner", repoName: "new-repo" });
    expect(upsertGithubConnection).toHaveBeenCalledWith({ userId: 7, token: "ghp_1234567890abcdef", repoOwner: "new-owner", repoName: "new-repo" });
  });

  it("deletes the current user's GitHub connection", async () => {
    await appRouter.createCaller(context()).github.deleteSettings();
    expect(deleteGithubConnection).toHaveBeenCalledWith(7);
  });
});
