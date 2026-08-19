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
const invokeLLM = vi.fn();
const createHeartbeatJob = vi.fn();
const deleteHeartbeatJob = vi.fn();

vi.mock("./db", () => ({ listAiTasks, getAiTask, insertAiTask, updateAiTask, deleteAiTask, listAiTaskRuns, insertAiTaskRun, completeAiTaskRun, markAiTaskRun }));
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

  it("runs a task and persists the generated result", async () => {
    getAiTask.mockResolvedValue({ id: 3, userId: 42, title: "Daily scan", instructions: "Find opportunities" });
    insertAiTaskRun.mockResolvedValue(9);
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "نتيجة قابلة للتنفيذ" } }] });
    const result = await appRouter.createCaller(context()).aiTasks.run({ id: 3 });
    expect(result).toMatchObject({ runId: 9, status: "success", result: "نتيجة قابلة للتنفيذ" });
    expect(completeAiTaskRun).toHaveBeenCalledWith(42, 9, { status: "success", result: "نتيجة قابلة للتنفيذ" });
    expect(markAiTaskRun).toHaveBeenCalledWith(42, 3, expect.any(Date));
  });
});
