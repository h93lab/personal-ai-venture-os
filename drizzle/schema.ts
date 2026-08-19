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

export const aiTasks = mysqlTable("ai_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  instructions: text("instructions").notNull(),
  cadence: mysqlEnum("cadence", ["manual", "daily", "weekly"]).default("daily").notNull(),
  runTime: varchar("runTime", { length: 5 }).default("08:00").notNull(),
  status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
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
