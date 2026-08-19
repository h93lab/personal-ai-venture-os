import type { Request, Response } from "express";
import { executeAiTask } from "./ai-tasks";
import { getAiTaskByScheduleUid } from "./db";
import { sdk } from "./_core/sdk";

export async function aiTaskRefreshHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const task = await getAiTaskByScheduleUid(user.taskUid);
    if (!task) return res.json({ ok: true, skipped: "orphan" });
    if (task.status !== "active") return res.json({ ok: true, skipped: "paused" });
    const result = await executeAiTask(task.userId, task.id);
    return res.json({ ok: true, taskId: task.id, runId: result.runId, status: result.status });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
  }
}
