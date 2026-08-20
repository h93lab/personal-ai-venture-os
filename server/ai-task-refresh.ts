import type { Request, Response } from "express";
import { executeAiTask } from "./ai-tasks";
import { getAiTaskByScheduleUid } from "./db";
import { isLocalSchedulerRequest } from "./local-scheduler-auth";

export async function aiTaskRefreshHandler(req: Request, res: Response) {
  try {
    if (!isLocalSchedulerRequest(req)) return res.status(403).json({ error: "cron-only" });
    const taskUid = typeof req.body?.taskUid === "string" ? req.body.taskUid : null;
    if (!taskUid) return res.status(400).json({ error: "taskUid-required" });
    const task = await getAiTaskByScheduleUid(taskUid);
    if (!task) return res.json({ ok: true, skipped: "orphan" });
    if (task.status !== "active") return res.json({ ok: true, skipped: "paused" });
    const result = await executeAiTask(task.userId, task.id);
    return res.json({ ok: true, taskId: task.id, runId: result.runId, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /session|cron|forbidden|unauthorized/i.test(message) ? 403 : 500;
    return res.status(status).json({ error: status === 403 ? "forbidden" : "task-failed", timestamp: new Date().toISOString() });
  }
}
