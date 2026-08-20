import { describe, expect, it, vi, beforeEach } from "vitest";

const getGithubConnectionByTaskUid = vi.fn();
const updateGithubSync = vi.fn();
const githubStatusForConnection = vi.fn();

vi.mock("./db", () => ({ getGithubConnectionByTaskUid, updateGithubSync }));
vi.mock("./routers", () => ({ githubStatusForConnection }));

const { githubRefreshHandler } = await import("./github-refresh");

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

describe("github-refresh scheduled callback", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.JWT_SECRET = "scheduler-test-secret"; });

  it("rejects non-cron callers", async () => {
    const res = response();
    await githubRefreshHandler({ headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("refreshes the connection addressed by taskUid", async () => {

    getGithubConnectionByTaskUid.mockResolvedValue({ userId: 4, token: "secret", repoOwner: "owner", repoName: "repo", healthThreshold: 60 });
    githubStatusForConnection.mockResolvedValue({ connected: true, repo: "owner/repo", health: 82 });
    const res = response();
    await githubRefreshHandler({ headers: { "x-scheduler-token": "scheduler-test-secret" }, body: { taskUid: "task-123" } } as any, res);
    expect(getGithubConnectionByTaskUid).toHaveBeenCalledWith("task-123");
    expect(updateGithubSync).toHaveBeenCalledWith(4, { connected: true, repo: "owner/repo", health: 82 });
    expect(res.json).toHaveBeenCalledWith({ ok: true, repo: "owner/repo", health: 82, warning: false });
  });
});
