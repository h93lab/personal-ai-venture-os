import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, githubConnections, aiProviderSettings } from "../drizzle/schema";
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
