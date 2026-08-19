import type { Request, Response } from "express";
import { getGithubConnectionByTaskUid, updateGithubSync } from "./db";
import { githubStatusForConnection } from "./routers";
import { sdk } from "./_core/sdk";

export async function githubRefreshHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const connection = await getGithubConnectionByTaskUid(user.taskUid);
    if (!connection) return res.json({ ok: true, skipped: "orphan" });
    const status = await githubStatusForConnection(connection);
    await updateGithubSync(connection.userId, status);
    return res.json({ ok: true, repo: status.repo, health: status.health, warning: status.health < connection.healthThreshold });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
  }
}
