import type { Request, Response } from "express";
import { getGithubConnectionByTaskUid, updateGithubSync } from "./db";
import { githubStatusForConnection } from "./routers";
import { isLocalSchedulerRequest } from "./local-scheduler-auth";

export async function githubRefreshHandler(req: Request, res: Response) {
  try {
    if (!isLocalSchedulerRequest(req)) return res.status(403).json({ error: "cron-only" });
    const taskUid = typeof req.body?.taskUid === "string" ? req.body.taskUid : null;
    if (!taskUid) return res.status(400).json({ error: "taskUid-required" });
    const connection = await getGithubConnectionByTaskUid(taskUid);
    if (!connection) return res.json({ ok: true, skipped: "orphan" });
    if (connection.lastSyncedAt && Date.now() - new Date(connection.lastSyncedAt).getTime() < connection.refreshMinutes * 60_000) {
      return res.json({ ok: true, skipped: "not-due", nextAfterMinutes: connection.refreshMinutes });
    }
    const status = await githubStatusForConnection(connection);
    await updateGithubSync(connection.userId, status);
    return res.json({ ok: true, repo: status.repo, health: status.health, warning: status.health < connection.healthThreshold });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /session|cron|forbidden|unauthorized/i.test(message) ? 403 : 500;
    return res.status(status).json({ error: status === 403 ? "forbidden" : "refresh-failed", timestamp: new Date().toISOString() });
  }
}
