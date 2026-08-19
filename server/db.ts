import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, githubConnections, aiProviderSettings, aiTasks, aiTaskRuns, telegramConnections, InsertAiTask } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getGithubConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(githubConnections).where(eq(githubConnections.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertGithubConnection(input: { userId: number; token: string; repoOwner: string; repoName: string; healthThreshold?: number; refreshMinutes?: number; scheduleCronTaskUid?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(githubConnections).values(input).onDuplicateKeyUpdate({
    set: { token: input.token, repoOwner: input.repoOwner, repoName: input.repoName, healthThreshold: input.healthThreshold ?? 50, refreshMinutes: input.refreshMinutes ?? 60, scheduleCronTaskUid: input.scheduleCronTaskUid ?? null, updatedAt: new Date() },
  });
}

export async function getGithubConnectionByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(githubConnections).where(eq(githubConnections.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function updateGithubSync(userId: number, status: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(githubConnections).set({ lastStatusJson: JSON.stringify(status), lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(githubConnections.userId, userId));
}

export async function updateGithubSchedule(userId: number, scheduleCronTaskUid: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(githubConnections).set({ scheduleCronTaskUid, updatedAt: new Date() }).where(eq(githubConnections.userId, userId));
}

export async function deleteGithubConnection(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(githubConnections).where(eq(githubConnections.userId, userId));
}

export async function getAiProviderSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(aiProviderSettings).where(eq(aiProviderSettings.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { provider: row.provider, endpoint: row.endpoint, selectedModel: row.selectedModel, apiKey: row.apiKey, maskedApiKey: `${row.apiKey.slice(0, 4)}••••${row.apiKey.slice(-4)}` };
}

export async function upsertAiProviderSettings(input: { userId: number; provider: string; endpoint: string; apiKey: string; selectedModel?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(aiProviderSettings).values(input).onDuplicateKeyUpdate({ set: { provider: input.provider, endpoint: input.endpoint, apiKey: input.apiKey, selectedModel: input.selectedModel ?? null, updatedAt: new Date() } });
}

export async function deleteAiProviderSettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(aiProviderSettings).where(eq(aiProviderSettings.userId, userId));
}

export async function getTelegramConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { ...row, botTokenMasked: row.botToken.length <= 8 ? "••••••••" : `${row.botToken.slice(0, 4)}••••${row.botToken.slice(-4)}` };
}

export async function upsertTelegramConnection(input: { userId: number; botToken: string; chatId: string; enabled?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(telegramConnections).values({ ...input, enabled: input.enabled ?? 1 }).onDuplicateKeyUpdate({ set: { botToken: input.botToken, chatId: input.chatId, enabled: input.enabled ?? 1, updatedAt: new Date() } });
}

export async function deleteTelegramConnection(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(telegramConnections).where(eq(telegramConnections.userId, userId));
}

export async function listAiTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiTasks).where(eq(aiTasks.userId, userId)).orderBy(desc(aiTasks.createdAt));
}

export async function getAiTask(userId: number, taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(aiTasks).where(and(eq(aiTasks.userId, userId), eq(aiTasks.id, taskId))).limit(1);
  return rows[0];
}

export async function getAiTaskByScheduleUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(aiTasks).where(eq(aiTasks.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function insertAiTask(input: InsertAiTask) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(aiTasks).values(input);
  return Number(result[0].insertId);
}

export async function updateAiTask(userId: number, taskId: number, patch: Partial<Pick<InsertAiTask, "title" | "instructions" | "cadence" | "runTime" | "status" | "nextRunAt" | "scheduleCronTaskUid">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(aiTasks).set({ ...patch, updatedAt: new Date() }).where(and(eq(aiTasks.userId, userId), eq(aiTasks.id, taskId)));
}

export async function deleteAiTask(userId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(aiTaskRuns).where(and(eq(aiTaskRuns.userId, userId), eq(aiTaskRuns.taskId, taskId)));
  await db.delete(aiTasks).where(and(eq(aiTasks.userId, userId), eq(aiTasks.id, taskId)));
}

export async function listAiTaskRuns(userId: number, taskId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = taskId === undefined ? eq(aiTaskRuns.userId, userId) : and(eq(aiTaskRuns.userId, userId), eq(aiTaskRuns.taskId, taskId));
  return db.select().from(aiTaskRuns).where(condition).orderBy(desc(aiTaskRuns.createdAt)).limit(100);
}

export async function insertAiTaskRun(input: { taskId: number; userId: number; model?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(aiTaskRuns).values({ ...input, status: "running" });
  return Number(result[0].insertId);
}

export async function completeAiTaskRun(userId: number, runId: number, patch: { status: "success" | "failed"; result?: string | null; error?: string | null; model?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(aiTaskRuns).set({ ...patch, completedAt: new Date() }).where(and(eq(aiTaskRuns.userId, userId), eq(aiTaskRuns.id, runId)));
}

export async function markAiTaskRun(userId: number, taskId: number, lastRunAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(aiTasks).set({ lastRunAt, updatedAt: new Date() }).where(and(eq(aiTasks.userId, userId), eq(aiTasks.id, taskId)));
}
