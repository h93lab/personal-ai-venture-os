import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const githubConnections = mysqlTable("github_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  token: text("token").notNull(),
  repoOwner: varchar("repoOwner", { length: 120 }).notNull(),
  repoName: varchar("repoName", { length: 200 }).notNull(),
  healthThreshold: int("healthThreshold").default(50).notNull(),
  refreshMinutes: int("refreshMinutes").default(60).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastStatusJson: text("lastStatusJson"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GithubConnection = typeof githubConnections.$inferSelect;
export type InsertGithubConnection = typeof githubConnections.$inferInsert;

export const aiProviderSettings = mysqlTable("ai_provider_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  provider: varchar("provider", { length: 120 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  apiKey: text("apiKey").notNull(),
  selectedModel: varchar("selectedModel", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiProviderSetting = typeof aiProviderSettings.$inferSelect;
export type InsertAiProviderSetting = typeof aiProviderSettings.$inferInsert;

export const telegramConnections = mysqlTable("telegram_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  botToken: text("botToken").notNull(),
  chatId: varchar("chatId", { length: 120 }).notNull(),
  enabled: int("enabled").default(1).notNull(),
  successTemplate: text("successTemplate"),
  failureTemplate: text("failureTemplate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramConnection = typeof telegramConnections.$inferSelect;
export type InsertTelegramConnection = typeof telegramConnections.$inferInsert;

export const aiTasks = mysqlTable("ai_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  instructions: text("instructions").notNull(),
  cadence: mysqlEnum("cadence", ["manual", "daily", "weekly"]).default("daily").notNull(),
  runTime: varchar("runTime", { length: 5 }).default("08:00").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Dubai").notNull(),
  status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  lockToken: varchar("lockToken", { length: 64 }),
  lockExpiresAt: timestamp("lockExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiTask = typeof aiTasks.$inferSelect;
export type InsertAiTask = typeof aiTasks.$inferInsert;

export const aiTaskRuns = mysqlTable("ai_task_runs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["running", "success", "failed"]).default("running").notNull(),
  result: text("result"),
  error: text("error"),
  model: varchar("model", { length: 200 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiTaskRun = typeof aiTaskRuns.$inferSelect;
export type InsertAiTaskRun = typeof aiTaskRuns.$inferInsert;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  type: varchar("type", { length: 120 }).notNull(),
  status: varchar("status", { length: 80 }).notNull(),
  progress: int("progress").default(0).notNull(),
  nextStep: text("nextStep"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const knowledgeItems = mysqlTable("knowledge_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  kind: varchar("kind", { length: 60 }).default("ملاحظة").notNull(),
  content: text("content"),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  tags: varchar("tags", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const discoverySettings = mysqlTable("discovery_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  source: varchar("source", { length: 80 }).default("hn_algolia").notNull(),
  query: varchar("query", { length: 240 }).default("mobile apps indie games developer tools").notNull(),
  enabled: int("enabled").default(1).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastFetchedAt: timestamp("lastFetchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DiscoverySetting = typeof discoverySettings.$inferSelect;
export type InsertDiscoverySetting = typeof discoverySettings.$inferInsert;

export const discoverySignals = mysqlTable("discovery_signals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceKey: varchar("sourceKey", { length: 180 }),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  title: varchar("title", { length: 220 }).notNull(),
  type: varchar("type", { length: 120 }).notNull(),
  score: int("score").default(0).notNull(),
  sourceCount: int("sourceCount").default(0).notNull(),
  description: text("description"),
  verificationDays: int("verificationDays").default(2).notNull(),
  status: varchar("status", { length: 80 }).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DiscoverySignal = typeof discoverySignals.$inferSelect;
export type InsertDiscoverySignal = typeof discoverySignals.$inferInsert;

export const competitors = mysqlTable("competitors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 220 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  url: varchar("url", { length: 1000 }),
  threatLevel: int("threatLevel").default(0).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  notes: text("notes"),
  status: varchar("status", { length: 80 }).default("watching").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = typeof competitors.$inferInsert;

export const ideas = mysqlTable("ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  score: int("score").default(0).notNull(),
  version: varchar("version", { length: 32 }).default("V1").notNull(),
  status: varchar("status", { length: 80 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;
