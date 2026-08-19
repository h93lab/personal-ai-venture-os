import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const listAiTasks = vi.fn();
const getAiTask = vi.fn();
const insertAiTask = vi.fn();
const updateAiTask = vi.fn();
const deleteAiTask = vi.fn();
const listAiTaskRuns = vi.fn();
const insertAiTaskRun = vi.fn();
const completeAiTaskRun = vi.fn();
const markAiTaskRun = vi.fn();
const acquireAiTaskLock = vi.fn();
const releaseAiTaskLock = vi.fn();
const getTelegramConnection = vi.fn();
const invokeLLM = vi.fn();
const createHeartbeatJob = vi.fn();
const deleteHeartbeatJob = vi.fn();

vi.mock("./db", () => ({ listAiTasks, getAiTask, insertAiTask, updateAiTask, deleteAiTask, listAiTaskRuns, insertAiTaskRun, completeAiTaskRun, markAiTaskRun, acquireAiTaskLock, releaseAiTaskLock, getTelegramConnection }));
vi.mock("./_core/llm", () => ({ invokeLLM, listLLMModels: vi.fn() }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob, deleteHeartbeatJob }));

const { appRouter } = await import("./routers");

function context(): TrpcContext {
  return {
    user: { id: 42, openId: "ai-task-user", name: "Test", email: "test@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: { cookie: "" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("AI task CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createHeartbeatJob.mockResolvedValue({ taskUid: "heartbeat-1", nextExecutionAt: "2026-08-20T08:00:00Z" });
    acquireAiTaskLock.mockResolvedValue(true);
    releaseAiTaskLock.mockResolvedValue(undefined);
  });

  it("lists tasks and historical runs for the current user", async () => {
    listAiTasks.mockResolvedValue([{ id: 1, userId: 42, title: "Market scan" }]);
    listAiTaskRuns.mockResolvedValue([{ id: 5, taskId: 1, userId: 42, status: "success", result: "report" }]);
    const caller = appRouter.createCaller(context());
    expect(await caller.aiTasks.list()).toHaveLength(1);
    expect(await caller.aiTasks.runs({ taskId: 1 })).toHaveLength(1);
    expect(listAiTaskRuns).toHaveBeenCalledWith(42, 1);
  });

  it("creates a manual task without scheduling and deletes it safely", async () => {
    insertAiTask.mockResolvedValue(7);
    getAiTask.mockResolvedValue({ id: 7, userId: 42, title: "Manual task", cadence: "manual", status: "active" });
    const caller = appRouter.createCaller(context());
    const created = await caller.aiTasks.create({ title: "Manual task", instructions: "Review this idea", cadence: "manual", runTime: "08:00", status: "active" });
    expect(created?.id).toBe(7);
    expect(createHeartbeatJob).not.toHaveBeenCalled();
    await caller.aiTasks.delete({ id: 7 });
    expect(deleteAiTask).toHaveBeenCalledWith(42, 7);
  });

  it("pauses a scheduled task and removes its Heartbeat job", async () => {
    getAiTask.mockResolvedValue({ id: 8, userId: 42, title: "Scheduled", cadence: "daily", runTime: "08:00", status: "active", scheduleCronTaskUid: "heartbeat-8" });
    const caller = appRouter.createCaller(context());
    await caller.aiTasks.update({ id: 8, data: { status: "paused" } });
    expect(deleteHeartbeatJob).toHaveBeenCalledWith("heartbeat-8", "");
    expect(updateAiTask).toHaveBeenCalledWith(42, 8, { status: "paused", timezone: "Asia/Dubai", scheduleCronTaskUid: null, nextRunAt: null });
  });

  it("runs a task and persists the generated result", async () => {
    getAiTask.mockResolvedValue({ id: 3, userId: 42, title: "Daily scan", instructions: "Find opportunities" });
    insertAiTaskRun.mockResolvedValue(9);
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "نتيجة قابلة للتنفيذ" } }] });
    const result = await appRouter.createCaller(context()).aiTasks.run({ id: 3 });
    expect(result).toMatchObject({ runId: 9, status: "success", result: "نتيجة قابلة للتنفيذ" });
    expect(completeAiTaskRun).toHaveBeenCalledWith(42, 9, { status: "success", result: "نتيجة قابلة للتنفيذ" });
    expect(markAiTaskRun).toHaveBeenCalledWith(42, 3, expect.any(Date));
    expect(acquireAiTaskLock).toHaveBeenCalledWith(42, 3, expect.any(String), expect.any(Date));
    expect(releaseAiTaskLock).toHaveBeenCalledWith(42, 3, expect.any(String));
  });

  it("rejects a concurrent task run when the lock is already held", async () => {
    acquireAiTaskLock.mockResolvedValue(false);
    getAiTask.mockResolvedValue({ id: 4, userId: 42, title: "Locked task", instructions: "Do not overlap" });
    await expect(appRouter.createCaller(context()).aiTasks.run({ id: 4 })).rejects.toThrow("already running");
    expect(insertAiTaskRun).not.toHaveBeenCalled();
  });
});
