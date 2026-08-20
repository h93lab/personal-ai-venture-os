import { and, desc, eq, gte, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { InsertUser, users, githubConnections, aiProviderSettings, aiTasks, aiTaskRuns, telegramConnections, InsertAiTask, projects, ideas, knowledgeItems, discoverySignals, discoverySettings, competitors, competitorSettings } from "../drizzle/schema";
import { ENV } from './_core/env';
import { buildAiTaskStats } from "../shared/ai-task-stats";
import { decryptSecret, encryptSecret, maskSecret } from "./secrets";

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

export async function updateUserProfile(userId: number, input: { name?: string | null; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, userId));
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}

export async function updateLocalPin(userId: number, pinHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ pinHash, authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, userId));
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}

export async function getGithubConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(githubConnections).where(eq(githubConnections.userId, userId)).limit(1);
  if (!rows[0]) return undefined;
  return { ...rows[0], token: decryptSecret(rows[0].token) };
}

export async function upsertGithubConnection(input: { userId: number; token: string; repoOwner: string; repoName: string; healthThreshold?: number; refreshMinutes?: number; scheduleCronTaskUid?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const token = encryptSecret(input.token);
  await db.insert(githubConnections).values({ ...input, token }).onDuplicateKeyUpdate({
    set: { token, repoOwner: input.repoOwner, repoName: input.repoName, healthThreshold: input.healthThreshold ?? 50, refreshMinutes: input.refreshMinutes ?? 60, scheduleCronTaskUid: input.scheduleCronTaskUid ?? null, updatedAt: new Date() },
  });
}

export async function getGithubConnectionByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(githubConnections).where(eq(githubConnections.scheduleCronTaskUid, taskUid)).limit(1);
  if (!rows[0]) return undefined;
  return { ...rows[0], token: decryptSecret(rows[0].token) };
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
  const apiKey = decryptSecret(row.apiKey);
  return { provider: row.provider, endpoint: row.endpoint, selectedModel: row.selectedModel, apiKey, maskedApiKey: maskSecret(apiKey) };
}

export async function upsertAiProviderSettings(input: { userId: number; provider: string; endpoint: string; apiKey: string; selectedModel?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const apiKey = encryptSecret(input.apiKey);
  await db.insert(aiProviderSettings).values({ ...input, apiKey }).onDuplicateKeyUpdate({ set: { provider: input.provider, endpoint: input.endpoint, apiKey, selectedModel: input.selectedModel ?? null, updatedAt: new Date() } });
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
  const botToken = decryptSecret(row.botToken);
  return { ...row, botToken, botTokenMasked: maskSecret(botToken) };
}

export async function upsertTelegramConnection(input: { userId: number; botToken: string; chatId: string; enabled?: number; successTemplate?: string | null; failureTemplate?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const botToken = encryptSecret(input.botToken);
  await db.insert(telegramConnections).values({ ...input, botToken, enabled: input.enabled ?? 1 }).onDuplicateKeyUpdate({ set: { botToken, chatId: input.chatId, enabled: input.enabled ?? 1, successTemplate: input.successTemplate ?? null, failureTemplate: input.failureTemplate ?? null, updatedAt: new Date() } });
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

export async function getAiTaskRunStats(userId: number, days = 14) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select({ status: aiTaskRuns.status, startedAt: aiTaskRuns.startedAt }).from(aiTaskRuns).where(and(eq(aiTaskRuns.userId, userId), gte(aiTaskRuns.startedAt, since))).orderBy(aiTaskRuns.startedAt);
  return buildAiTaskStats(rows, days);
}

export async function listAiTaskRuns(userId: number, taskId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = taskId === undefined ? eq(aiTaskRuns.userId, userId) : and(eq(aiTaskRuns.userId, userId), eq(aiTaskRuns.taskId, taskId));
  return db.select().from(aiTaskRuns).where(condition).orderBy(desc(aiTaskRuns.createdAt)).limit(100);
}

export async function listProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function insertProject(input: { userId: number; title: string; type: string; status: string; progress?: number; nextStep?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(projects).values(input);
  return Number(result[0].insertId);
}

export async function updateProject(userId: number, id: number, patch: Partial<{ title: string; type: string; status: string; progress: number; nextStep: string | null }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(projects).set({ ...patch, updatedAt: new Date() }).where(and(eq(projects.userId, userId), eq(projects.id, id)));
}

export async function deleteProject(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(projects).where(and(eq(projects.userId, userId), eq(projects.id, id)));
}

export async function listIdeas(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(desc(ideas.updatedAt));
}

export async function insertIdea(input: { userId: number; title: string; category: string; score?: number; version?: string; status: string; description?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(ideas).values(input);
  return Number(result[0].insertId);
}

export async function updateIdea(userId: number, id: number, patch: Partial<{ title: string; category: string; score: number; version: string; status: string; description: string | null }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(ideas).set({ ...patch, updatedAt: new Date() }).where(and(eq(ideas.userId, userId), eq(ideas.id, id)));
}

export async function deleteIdea(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(ideas).where(and(eq(ideas.userId, userId), eq(ideas.id, id)));
}

export async function getCompetitorSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(competitorSettings).where(eq(competitorSettings.userId, userId)).limit(1);
  return rows[0];
}

export async function getCompetitorSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(competitorSettings).where(eq(competitorSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function upsertCompetitorSettings(input: { userId: number; source?: string; query?: string; enabled?: number; refreshMinutes?: number; scheduleCronTaskUid?: string | null; lastFetchedAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(competitorSettings).values({ ...input, source: input.source ?? "github", query: input.query ?? "mobile apps indie games developer tools", enabled: input.enabled ?? 1, refreshMinutes: input.refreshMinutes ?? 1440 }).onDuplicateKeyUpdate({ set: { source: input.source ?? "github", query: input.query ?? "mobile apps indie games developer tools", enabled: input.enabled ?? 1, refreshMinutes: input.refreshMinutes ?? 1440, scheduleCronTaskUid: input.scheduleCronTaskUid ?? null, lastFetchedAt: input.lastFetchedAt ?? null, updatedAt: new Date() } });
}

export async function updateCompetitorFetch(userId: number, fetchedAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(competitorSettings).set({ lastFetchedAt: fetchedAt, updatedAt: new Date() }).where(eq(competitorSettings.userId, userId));
}

export async function findCompetitorBySourceKey(userId: number, sourceKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(competitors).where(and(eq(competitors.userId, userId), eq(competitors.sourceKey, sourceKey))).limit(1);
  return rows[0];
}

export async function listCompetitors(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitors).where(eq(competitors.userId, userId)).orderBy(desc(competitors.updatedAt));
}

export async function insertCompetitor(input: { userId: number; sourceKey?: string | null; source?: string; name: string; category: string; url?: string | null; threatLevel?: number; lastSeenAt?: Date | null; notes?: string | null; status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(competitors).values(input);
  return Number(result[0].insertId);
}

export async function updateCompetitor(userId: number, id: number, patch: Partial<{ sourceKey: string | null; source: string; name: string; category: string; url: string | null; threatLevel: number; lastSeenAt: Date | null; notes: string | null; status: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(competitors).set({ ...patch, updatedAt: new Date() }).where(and(eq(competitors.userId, userId), eq(competitors.id, id)));
}

export async function deleteCompetitor(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(competitors).where(and(eq(competitors.userId, userId), eq(competitors.id, id)));
}

export async function getDiscoverySettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(discoverySettings).where(eq(discoverySettings.userId, userId)).limit(1);
  return rows[0];
}

export async function getDiscoverySettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(discoverySettings).where(eq(discoverySettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function upsertDiscoverySettings(input: { userId: number; source?: string; query?: string; localHour?: number; localMinute?: number; timezone?: string; enabled?: number; scheduleCronTaskUid?: string | null; lastFetchedAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const source = input.source ?? "hn_algolia";
  const query = input.query ?? "mobile apps indie games developer tools";
  const localHour = input.localHour ?? 8;
  const localMinute = input.localMinute ?? 0;
  const timezone = input.timezone ?? "Asia/Dubai";
  const enabled = input.enabled ?? 1;
  await db.insert(discoverySettings).values({ ...input, source, query, localHour, localMinute, timezone, enabled }).onDuplicateKeyUpdate({ set: { source, query, localHour, localMinute, timezone, enabled, scheduleCronTaskUid: input.scheduleCronTaskUid ?? null, lastFetchedAt: input.lastFetchedAt ?? null, updatedAt: new Date() } });
}

export async function updateDiscoveryFetch(userId: number, fetchedAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(discoverySettings).set({ lastFetchedAt: fetchedAt, updatedAt: new Date() }).where(eq(discoverySettings.userId, userId));
}

export async function findDiscoverySignalBySourceKey(userId: number, sourceKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(discoverySignals).where(and(eq(discoverySignals.userId, userId), eq(discoverySignals.sourceKey, sourceKey))).limit(1);
  return rows[0];
}

export async function listDiscoverySignals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discoverySignals).where(eq(discoverySignals.userId, userId)).orderBy(desc(discoverySignals.updatedAt));
}

export async function insertDiscoverySignal(input: { userId: number; sourceKey?: string | null; sourceUrl?: string | null; title: string; type: string; score?: number; sourceCount?: number; description?: string | null; verificationDays?: number; status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(discoverySignals).values(input);
  return Number(result[0].insertId);
}

export async function updateDiscoverySignal(userId: number, id: number, patch: Partial<{ sourceKey: string | null; sourceUrl: string | null; title: string; type: string; score: number; sourceCount: number; description: string | null; verificationDays: number; status: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(discoverySignals).set({ ...patch, updatedAt: new Date() }).where(and(eq(discoverySignals.userId, userId), eq(discoverySignals.id, id)));
}

export async function deleteDiscoverySignal(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(discoverySignals).where(and(eq(discoverySignals.userId, userId), eq(discoverySignals.id, id)));
}

export async function listKnowledgeItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeItems).where(eq(knowledgeItems.userId, userId)).orderBy(desc(knowledgeItems.updatedAt));
}

export async function insertKnowledgeItem(input: { userId: number; title: string; kind: string; content?: string | null; sourceUrl?: string | null; tags?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(knowledgeItems).values(input);
  return Number(result[0].insertId);
}

export async function updateKnowledgeItem(userId: number, id: number, patch: Partial<{ title: string; kind: string; content: string | null; sourceUrl: string | null; tags: string | null }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(knowledgeItems).set({ ...patch, updatedAt: new Date() }).where(and(eq(knowledgeItems.userId, userId), eq(knowledgeItems.id, id)));
}

export async function deleteKnowledgeItem(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(knowledgeItems).where(and(eq(knowledgeItems.userId, userId), eq(knowledgeItems.id, id)));
}

export async function acquireAiTaskLock(userId: number, taskId: number, lockToken: string, now = new Date(), ttlMs = 10 * 60 * 1000) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(aiTasks).set({ lockToken, lockExpiresAt: new Date(now.getTime() + ttlMs), updatedAt: new Date() }).where(and(eq(aiTasks.userId, userId), eq(aiTasks.id, taskId), eq(aiTasks.status, "active"), or(isNull(aiTasks.lockExpiresAt), lt(aiTasks.lockExpiresAt, now))));
  return Number(result[0].affectedRows ?? 0) === 1;
}

export async function releaseAiTaskLock(userId: number, taskId: number, lockToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(aiTasks).set({ lockToken: null, lockExpiresAt: null, updatedAt: new Date() }).where(and(eq(aiTasks.userId, userId), eq(aiTasks.id, taskId), eq(aiTasks.lockToken, lockToken)));
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
