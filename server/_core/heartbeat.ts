import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";

export type HeartbeatJob = { name: string; cron: string; path: string; method?: "POST" | "PUT"; payload?: unknown; description?: string };
export type HeartbeatJobUpdate = Partial<Omit<HeartbeatJob, "name">> & { enable?: boolean };
export type HeartbeatJobInfo = { taskUid: string; name: string; userId: string; description: string; cronExpression: string; callbackPath: string; callbackMethod: string; callbackPayload: string; isEnable: boolean; createdAt?: string | null; lastExecutedAt?: string | null; nextExecutionAt?: string | null };

const jobs = new Map<string, { job: HeartbeatJob; enabled: boolean }>();

function validateCallbackPath(path: string) {
  if (!path.startsWith("/api/scheduled/")) throw new TRPCError({ code: "BAD_REQUEST", message: "callback path must start with /api/scheduled/" });
}

function nextExecutionAt(cron: string) {
  const now = new Date(Date.now() + 60_000);
  return now.toISOString();
}

export async function createHeartbeatJob(job: HeartbeatJob, _userSession: string) {
  validateCallbackPath(job.path);
  const taskUid = `local_${crypto.randomUUID()}`;
  jobs.set(taskUid, { job, enabled: true });
  return { taskUid, nextExecutionAt: nextExecutionAt(job.cron) };
}

export async function updateHeartbeatJob(taskUid: string, patch: HeartbeatJobUpdate, _userSession: string) {
  const current = jobs.get(taskUid);
  if (current) {
    current.job = { ...current.job, ...patch, name: current.job.name };
    if (patch.enable !== undefined) current.enabled = patch.enable;
  }
  return { nextExecutionAt: nextExecutionAt(current?.job.cron ?? "") };
}

export async function deleteHeartbeatJob(taskUid: string, _userSession: string) {
  jobs.delete(taskUid);
}

export async function listHeartbeatJobs(_userSession: string, pagination?: { page?: number; pageSize?: number }) {
  const all = Array.from(jobs.entries()).map(([taskUid, value]) => ({ taskUid, name: value.job.name, userId: "local", description: value.job.description ?? "", cronExpression: value.job.cron, callbackPath: value.job.path, callbackMethod: value.job.method ?? "POST", callbackPayload: JSON.stringify(value.job.payload ?? {}), isEnable: value.enabled, nextExecutionAt: nextExecutionAt(value.job.cron) }));
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 50;
  return { total: all.length, actorUserId: "local-admin", jobs: all.slice((page - 1) * pageSize, page * pageSize) };
}
