import { describe, expect, it, vi, beforeEach } from "vitest";

const authenticateRequest = vi.fn();
const getGithubConnectionByTaskUid = vi.fn();
const updateGithubSync = vi.fn();
const githubStatusForConnection = vi.fn();

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./db", () => ({ getGithubConnectionByTaskUid, updateGithubSync }));
vi.mock("./routers", () => ({ githubStatusForConnection }));

const { githubRefreshHandler } = await import("./github-refresh");

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

describe("github-refresh scheduled callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-cron callers", async () => {
    authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await githubRefreshHandler({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("refreshes the connection addressed by taskUid", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-123" });
    getGithubConnectionByTaskUid.mockResolvedValue({ userId: 4, token: "secret", repoOwner: "owner", repoName: "repo", healthThreshold: 60 });
    githubStatusForConnection.mockResolvedValue({ connected: true, repo: "owner/repo", health: 82 });
    const res = response();
    await githubRefreshHandler({} as any, res);
    expect(getGithubConnectionByTaskUid).toHaveBeenCalledWith("task-123");
    expect(updateGithubSync).toHaveBeenCalledWith(4, { connected: true, repo: "owner/repo", health: 82 });
    expect(res.json).toHaveBeenCalledWith({ ok: true, repo: "owner/repo", health: 82, warning: false });
  });
});
