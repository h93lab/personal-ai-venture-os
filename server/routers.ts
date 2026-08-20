import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookie } from "cookie";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { deleteGithubConnection, getGithubConnection, updateGithubSchedule, updateGithubSync, upsertGithubConnection, getAiProviderSettings, upsertAiProviderSettings, deleteAiProviderSettings, listAiTasks, getAiTask, insertAiTask, updateAiTask, deleteAiTask, listAiTaskRuns, updateUserProfile, listProjects, insertProject, updateProject, deleteProject, listIdeas, insertIdea, updateIdea, deleteIdea, listKnowledgeItems, insertKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem, listDiscoverySignals, insertDiscoverySignal, updateDiscoverySignal, deleteDiscoverySignal, listCompetitors, insertCompetitor, updateCompetitor, deleteCompetitor, getCompetitorSettings, getCompetitorSettingsByTaskUid, upsertCompetitorSettings, updateCompetitorFetch, findCompetitorBySourceKey, getDiscoverySettings, upsertDiscoverySettings } from "./db";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { executeAiTask } from "./ai-tasks";
import { getTelegramConnection, upsertTelegramConnection, deleteTelegramConnection, getAiTaskRunStats } from "./db";
import { testTelegramConnection } from "./telegram";
import { externalFetch } from "./http-client";
import { fetchHackerNewsSignals, refreshDiscoveryForUser } from "./discovery-refresh";
import { assertValidTimeZone, localTimeToUtcCron } from "./schedule-utils";
import { refreshCompetitorsForUser } from "./competitor-refresh";

export function maskGithubToken(token: string | undefined) {
  if (!token) return null;
  return token.length <= 8 ? "••••••••" : `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

async function githubRequest<T>(token: string, path: string): Promise<T> {
  const response = await externalFetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "personal-ai-venture-os",
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function githubStatusForConnection(connection: { token: string; repoOwner: string; repoName: string }) {
  const base = `/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}`;
  const [repo, commits, issues, pulls] = await Promise.all([
    githubRequest<{ full_name: string; stargazers_count: number; open_issues_count: number; pushed_at: string | null }>(connection.token, base),
    githubRequest<Array<{ sha: string; commit: { author?: { date?: string } } }>>(connection.token, `${base}/commits?per_page=10`),
    githubRequest<Array<{ id: number; pull_request?: unknown }>>(connection.token, `${base}/issues?state=open&per_page=100`),
    githubRequest<Array<{ id: number }>>(connection.token, `${base}/pulls?state=open&per_page=100`),
  ]);
  return {
    connected: true as const,
    repo: repo.full_name,
    stars: repo.stargazers_count,
    openIssues: repo.open_issues_count,
    openPullRequests: pulls.length,
    recentCommits: commits.length,
    lastPush: repo.pushed_at,
    health: Math.max(0, Math.min(100, 55 + Math.min(commits.length * 4, 24) - Math.min(issues.length * 2, 20) - Math.min(pulls.length, 10))),
  };
}

const telegramInput = z.object({ botToken: z.string().min(20).optional(), chatId: z.string().min(1).max(120), enabled: z.boolean().default(true), successTemplate: z.string().max(4000).optional(), failureTemplate: z.string().max(4000).optional() });

const aiTaskInput = z.object({
  title: z.string().min(2).max(180),
  instructions: z.string().min(3).max(10000),
  cadence: z.enum(["manual", "daily", "weekly"]),
  runTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(64).default("Asia/Dubai"),
  status: z.enum(["active", "paused"]).default("active"),
});

function timezoneOffsetMinutes(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" }).formatToParts(date);
  const value = parts.find(part => part.type === "timeZoneName")?.value ?? "GMT";
  const match = value.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "+" ? minutes : -minutes;
}

export function cronForAiTask(cadence: "manual" | "daily" | "weekly", runTime: string, timezone = "Asia/Dubai") {
  if (cadence === "manual") return null;
  const [localHour, localMinute] = runTime.split(":").map(Number);
  const offset = timezoneOffsetMinutes(timezone);
  const utcTotal = localHour * 60 + localMinute - offset;
  const utcMinute = ((utcTotal % 60) + 60) % 60;
  const dayShift = Math.floor(utcTotal / 1440);
  const utcHour = ((Math.floor(utcTotal / 60) % 24) + 24) % 24;
  if (cadence === "weekly") {
    const utcDay = ((1 + dayShift) % 7 + 7) % 7;
    return `0 ${utcMinute} ${utcHour} * * ${utcDay}`;
  }
  return `0 ${utcMinute} ${utcHour} * * *`;
}

const githubRepoInput = z.object({
  token: z.string().min(8).optional(),
  repoOwner: z.string().min(1).max(120),
  repoName: z.string().min(1).max(200),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  profile: router({
    update: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(320).optional() })).mutation(async ({ ctx, input }) => {
      const user = await updateUserProfile(ctx.user.id, { name: input.name, email: input.email });
      return { updated: true as const, user };
    }),
  }),

  projects: router({
    list: protectedProcedure.query(({ ctx }) => listProjects(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(180), type: z.string().trim().min(1).max(120), status: z.string().trim().min(1).max(80), progress: z.number().int().min(0).max(100).default(0), nextStep: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => { const id = await insertProject({ ...input, userId: ctx.user.id }); return { id }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ title: z.string().trim().min(2).max(180).optional(), type: z.string().trim().min(1).max(120).optional(), status: z.string().trim().min(1).max(80).optional(), progress: z.number().int().min(0).max(100).optional(), nextStep: z.string().max(2000).nullable().optional() }) })).mutation(async ({ ctx, input }) => { await updateProject(ctx.user.id, input.id, input.data); return { updated: true as const }; }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteProject(ctx.user.id, input.id); return { deleted: true as const }; }),
  }),

  ideas: router({
    list: protectedProcedure.query(({ ctx }) => listIdeas(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(220), category: z.string().trim().min(1).max(120), score: z.number().int().min(0).max(100).default(0), version: z.string().max(32).default("V1"), status: z.string().trim().min(1).max(80), description: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => { const id = await insertIdea({ ...input, userId: ctx.user.id }); return { id }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ title: z.string().trim().min(2).max(220).optional(), category: z.string().trim().min(1).max(120).optional(), score: z.number().int().min(0).max(100).optional(), version: z.string().max(32).optional(), status: z.string().trim().min(1).max(80).optional(), description: z.string().max(5000).nullable().optional() }) })).mutation(async ({ ctx, input }) => { await updateIdea(ctx.user.id, input.id, input.data); return { updated: true as const }; }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteIdea(ctx.user.id, input.id); return { deleted: true as const }; }),
  }),

  competitors: router({
    list: protectedProcedure.query(({ ctx }) => listCompetitors(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(220), category: z.string().trim().min(1).max(120), url: z.string().url().max(1000).optional(), threatLevel: z.number().int().min(0).max(100).default(0), notes: z.string().max(5000).optional(), status: z.string().trim().min(1).max(80).default("watching") })).mutation(async ({ ctx, input }) => { const id = await insertCompetitor({ ...input, userId: ctx.user.id, source: "manual" }); return { id }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ name: z.string().trim().min(2).max(220).optional(), category: z.string().trim().min(1).max(120).optional(), url: z.string().url().max(1000).nullable().optional(), threatLevel: z.number().int().min(0).max(100).optional(), notes: z.string().max(5000).nullable().optional(), status: z.string().trim().min(1).max(80).optional() }) })).mutation(async ({ ctx, input }) => { await updateCompetitor(ctx.user.id, input.id, input.data); return { updated: true as const }; }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteCompetitor(ctx.user.id, input.id); return { deleted: true as const }; }),
    getSettings: protectedProcedure.query(({ ctx }) => getCompetitorSettings(ctx.user.id)),
    configureSchedule: protectedProcedure.input(z.object({ query: z.string().trim().min(3).max(240).default("mobile apps indie games developer tools"), enabled: z.boolean().default(true), refreshMinutes: z.number().int().min(60).max(10080).default(1440) })).mutation(async ({ ctx, input }) => { const existing = await getCompetitorSettings(ctx.user.id); const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; if (existing?.scheduleCronTaskUid) await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken); let taskUid: string | null = null; let nextExecutionAt: string | null = null; if (input.enabled) { const job = await createHeartbeatJob({ name: `competitors-refresh-${ctx.user.id}`, cron: "0 0 6 * * *", path: "/api/scheduled/competitors-refresh", description: "Refresh competitor intelligence from GitHub" }, sessionToken); taskUid = job.taskUid; nextExecutionAt = job.nextExecutionAt ?? null; } await upsertCompetitorSettings({ userId: ctx.user.id, source: "github", query: input.query, enabled: input.enabled ? 1 : 0, refreshMinutes: input.refreshMinutes, scheduleCronTaskUid: taskUid }); return { enabled: input.enabled, query: input.query, refreshMinutes: input.refreshMinutes, taskUid, nextExecutionAt }; }),
    refreshNow: protectedProcedure.mutation(async ({ ctx }) => { const settings = await getCompetitorSettings(ctx.user.id); return refreshCompetitorsForUser(ctx.user.id, settings?.query ?? "mobile apps indie games developer tools"); }),
  }),

  discovery: router({
    list: protectedProcedure.query(({ ctx }) => listDiscoverySignals(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(220), type: z.string().trim().min(1).max(120), score: z.number().int().min(0).max(100).default(0), sourceCount: z.number().int().min(0).max(10000).default(0), description: z.string().max(5000).optional(), verificationDays: z.number().int().min(0).max(365).default(2), status: z.string().trim().min(1).max(80).default("new") })).mutation(async ({ ctx, input }) => { const id = await insertDiscoverySignal({ ...input, userId: ctx.user.id }); return { id }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ title: z.string().trim().min(2).max(220).optional(), type: z.string().trim().min(1).max(120).optional(), score: z.number().int().min(0).max(100).optional(), sourceCount: z.number().int().min(0).max(10000).optional(), description: z.string().max(5000).nullable().optional(), verificationDays: z.number().int().min(0).max(365).optional(), status: z.string().trim().min(1).max(80).optional() }) })).mutation(async ({ ctx, input }) => { await updateDiscoverySignal(ctx.user.id, input.id, input.data); return { updated: true as const }; }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteDiscoverySignal(ctx.user.id, input.id); return { deleted: true as const }; }),
    getSettings: protectedProcedure.query(({ ctx }) => getDiscoverySettings(ctx.user.id)),
    configureSchedule: protectedProcedure.input(z.object({ source: z.enum(["hn_algolia", "github"]).default("hn_algolia"), query: z.string().trim().min(3).max(240).default("mobile apps indie games developer tools"), enabled: z.boolean().default(true), localHour: z.number().int().min(0).max(23).default(8), localMinute: z.number().int().min(0).max(59).default(0), timezone: z.string().trim().min(1).max(80).default("Asia/Dubai") })).mutation(async ({ ctx, input }) => { assertValidTimeZone(input.timezone); const existing = await getDiscoverySettings(ctx.user.id); const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; if (existing?.scheduleCronTaskUid) await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken); let taskUid: string | null = null; let nextExecutionAt: string | null = null; if (input.enabled) { const job = await createHeartbeatJob({ name: `discovery-refresh-${ctx.user.id}`, cron: localTimeToUtcCron(input.localHour, input.localMinute, input.timezone), path: "/api/scheduled/discovery-refresh", description: `Daily Discovery refresh at ${String(input.localHour).padStart(2, "0")}:${String(input.localMinute).padStart(2, "0")} ${input.timezone}` }, sessionToken); taskUid = job.taskUid; nextExecutionAt = job.nextExecutionAt ?? null; } await upsertDiscoverySettings({ userId: ctx.user.id, source: input.source, query: input.query, localHour: input.localHour, localMinute: input.localMinute, timezone: input.timezone, enabled: input.enabled ? 1 : 0, scheduleCronTaskUid: taskUid }); return { ...input, taskUid, nextExecutionAt, cron: input.enabled ? localTimeToUtcCron(input.localHour, input.localMinute, input.timezone) : null }; }),
    refreshNow: protectedProcedure.mutation(async ({ ctx }) => { const settings = await getDiscoverySettings(ctx.user.id); return refreshDiscoveryForUser(ctx.user.id, settings?.query ?? "mobile apps indie games developer tools", settings?.source ?? "hn_algolia"); }),
  }),

  knowledge: router({
    list: protectedProcedure.query(({ ctx }) => listKnowledgeItems(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(220), kind: z.string().trim().min(1).max(60).default("ملاحظة"), content: z.string().max(20000).optional(), sourceUrl: z.string().url().max(1000).optional(), tags: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => { const id = await insertKnowledgeItem({ ...input, userId: ctx.user.id }); return { id }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ title: z.string().trim().min(2).max(220).optional(), kind: z.string().trim().min(1).max(60).optional(), content: z.string().max(20000).nullable().optional(), sourceUrl: z.string().url().max(1000).nullable().optional(), tags: z.string().max(500).nullable().optional() }) })).mutation(async ({ ctx, input }) => { await updateKnowledgeItem(ctx.user.id, input.id, input.data); return { updated: true as const }; }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteKnowledgeItem(ctx.user.id, input.id); return { deleted: true as const }; }),
  }),

  productBrief: router({
    generate: protectedProcedure
      .input(z.object({
        idea: z.string().min(3).max(5000),
        productType: z.string().min(1).max(120),
        focus: z.string().max(5000).optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a senior mobile product strategist and technical product manager. Generate concise, practical output for a solo developer building Android and iOS apps or games. Return only valid JSON.",
            },
            {
              role: "user",
              content: `Create a structured product brief for this idea:\nIdea: ${input.idea}\nType: ${input.productType}\nImplementation focus: ${input.focus ?? "Build a focused MVP with measurable acceptance criteria."}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "product_brief",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  problem: { type: "string" },
                  targetUser: { type: "string" },
                  valueProposition: { type: "string" },
                  scope: { type: "array", items: { type: "string" } },
                  screens: { type: "array", items: { type: "string" } },
                  userStories: { type: "array", items: { type: "string" } },
                  dataModel: { type: "array", items: { type: "string" } },
                  acceptanceCriteria: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  nextStep: { type: "string" },
                },
                required: ["problem", "targetUser", "valueProposition", "scope", "screens", "userStories", "dataModel", "acceptanceCriteria", "risks", "nextStep"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content;
        if (typeof content !== "string") throw new Error("The AI provider returned an empty Product Brief");
        return JSON.parse(content);
      }),
  }),

  ai: router({
    testConnection: protectedProcedure.query(async () => {
      const { data } = await listLLMModels();
      return { connected: true, modelCount: data.length, models: data.slice(0, 12).map((model) => ({ id: model.id })) };
    }),
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getAiProviderSettings(ctx.user.id);
      return settings ? { provider: settings.provider, endpoint: settings.endpoint, selectedModel: settings.selectedModel, maskedApiKey: settings.maskedApiKey } : { provider: "Custom API", endpoint: "", selectedModel: "", maskedApiKey: null };
    }),
    saveSettings: protectedProcedure.input(z.object({ provider: z.string().min(1).max(120), endpoint: z.string().url(), apiKey: z.string().min(8).optional(), selectedModel: z.string().max(200).optional() })).mutation(async ({ ctx, input }) => {
      const existing = await getAiProviderSettings(ctx.user.id);
      const apiKey = input.apiKey?.trim() || existing?.apiKey;
      if (!apiKey) throw new Error("An AI Provider API key is required for the first save");
      await upsertAiProviderSettings({ userId: ctx.user.id, provider: input.provider.trim(), endpoint: input.endpoint.trim(), apiKey, selectedModel: input.selectedModel?.trim() || null });
      return { saved: true, provider: input.provider.trim(), endpoint: input.endpoint.trim(), selectedModel: input.selectedModel?.trim() || null, maskedApiKey: `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}` };
    }),
    deleteSettings: protectedProcedure.mutation(async ({ ctx }) => { await deleteAiProviderSettings(ctx.user.id); return { deleted: true }; }),
    testCustomConnection: protectedProcedure.input(z.object({ endpoint: z.string().url().optional(), apiKey: z.string().min(8).optional(), provider: z.string().max(120).optional() })).mutation(async ({ ctx, input }) => {
      const saved = await getAiProviderSettings(ctx.user.id);
      const endpoint = (input.endpoint?.trim() || saved?.endpoint)?.replace(/\/+$/, "");
      const apiKey = input.apiKey?.trim() || saved?.apiKey;
      if (!endpoint || !apiKey) throw new Error("Save an AI Provider endpoint and API key first");
      const response = await externalFetch(`${endpoint}/models`, { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "User-Agent": "personal-ai-venture-os" } });
      if (!response.ok) throw new Error(`${input.provider || saved?.provider || "AI Provider"} rejected the connection (${response.status})`);
      const payload = await response.json() as { data?: Array<{ id?: string }> };
      const models = (payload.data ?? []).filter((model): model is { id: string } => typeof model.id === "string").slice(0, 50).map((model) => model.id);
      return { connected: true, modelCount: models.length, models };
    }),
  }),

  telegram: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getTelegramConnection(ctx.user.id);
      return settings ? { connected: true, chatId: settings.chatId, enabled: settings.enabled === 1, botTokenMasked: settings.botTokenMasked, successTemplate: settings.successTemplate, failureTemplate: settings.failureTemplate } : { connected: false, chatId: "", enabled: false, botTokenMasked: null, successTemplate: null, failureTemplate: null };
    }),
    saveSettings: protectedProcedure.input(telegramInput).mutation(async ({ ctx, input }) => {
      const existing = await getTelegramConnection(ctx.user.id);
      const botToken = input.botToken?.trim() || existing?.botToken;
      if (!botToken) throw new Error("أدخل Bot Token أولًا");
      await upsertTelegramConnection({ userId: ctx.user.id, botToken, chatId: input.chatId.trim(), enabled: input.enabled ? 1 : 0, successTemplate: input.successTemplate?.trim() || null, failureTemplate: input.failureTemplate?.trim() || null });
      const saved = await getTelegramConnection(ctx.user.id);
      return { connected: true, chatId: input.chatId.trim(), enabled: input.enabled, botTokenMasked: saved?.botTokenMasked ?? null, successTemplate: saved?.successTemplate ?? null, failureTemplate: saved?.failureTemplate ?? null };
    }),
    testConnection: protectedProcedure.input(z.object({ botToken: z.string().min(20).optional(), chatId: z.string().min(1).max(120) })).mutation(async ({ ctx, input }) => {
      const existing = await getTelegramConnection(ctx.user.id);
      const botToken = input.botToken?.trim() || existing?.botToken;
      if (!botToken) throw new Error("أدخل Bot Token أولًا");
      return testTelegramConnection({ botToken, chatId: input.chatId.trim() });
    }),
    deleteSettings: protectedProcedure.mutation(async ({ ctx }) => { await deleteTelegramConnection(ctx.user.id); return { deleted: true as const }; }),
  }),

  aiTasks: router({
    list: protectedProcedure.query(({ ctx }) => listAiTasks(ctx.user.id)),
    runs: protectedProcedure.input(z.object({ taskId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listAiTaskRuns(ctx.user.id, input?.taskId)),
    stats: protectedProcedure.input(z.object({ days: z.number().int().min(7).max(30).default(14) }).optional()).query(({ ctx, input }) => getAiTaskRunStats(ctx.user.id, input?.days ?? 14)),
    create: protectedProcedure.input(aiTaskInput).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const taskId = await insertAiTask({ userId: ctx.user.id, title: input.title.trim(), instructions: input.instructions.trim(), cadence: input.cadence, runTime: input.runTime, timezone: input.timezone, status: input.status });
      let task = await getAiTask(ctx.user.id, taskId);
      const cron = cronForAiTask(input.cadence, input.runTime, input.timezone);
      if (task && input.status === "active" && cron) {
        const job = await createHeartbeatJob({ name: `ai-task-${ctx.user.id}-${taskId}`, cron, path: "/api/scheduled/ai-task", description: `Run AI task ${taskId}` }, sessionToken);
        await updateAiTask(ctx.user.id, taskId, { scheduleCronTaskUid: job.taskUid, nextRunAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null });
        task = await getAiTask(ctx.user.id, taskId);
      }
      return task;
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: aiTaskInput.partial() })).mutation(async ({ ctx, input }) => {
      const existing = await getAiTask(ctx.user.id, input.id);
      if (!existing) throw new Error("AI task not found");
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (existing.scheduleCronTaskUid) await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken);
      await updateAiTask(ctx.user.id, input.id, { ...input.data, scheduleCronTaskUid: null, nextRunAt: null });
      const nextCadence = input.data.cadence ?? existing.cadence;
      const nextRunTime = input.data.runTime ?? existing.runTime;
      const nextStatus = input.data.status ?? existing.status;
      const cron = cronForAiTask(nextCadence, nextRunTime, input.data.timezone ?? existing.timezone);
      if (nextStatus === "active" && cron) {
        const job = await createHeartbeatJob({ name: `ai-task-${ctx.user.id}-${input.id}`, cron, path: "/api/scheduled/ai-task", description: `Run AI task ${input.id}` }, sessionToken);
        await updateAiTask(ctx.user.id, input.id, { scheduleCronTaskUid: job.taskUid, nextRunAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null });
      }
      return getAiTask(ctx.user.id, input.id);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const existing = await getAiTask(ctx.user.id, input.id);
      if (!existing) return { deleted: true } as const;
      if (existing.scheduleCronTaskUid) {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken);
      }
      await deleteAiTask(ctx.user.id, input.id);
      return { deleted: true } as const;
    }),
    run: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => executeAiTask(ctx.user.id, input.id)),
  }),

  github: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getGithubConnection(ctx.user.id);
      return connection ? { connected: true, repoOwner: connection.repoOwner, repoName: connection.repoName, token: maskGithubToken(connection.token), healthThreshold: connection.healthThreshold, refreshMinutes: connection.refreshMinutes, scheduleCronTaskUid: connection.scheduleCronTaskUid, lastSyncedAt: connection.lastSyncedAt } : { connected: false, repoOwner: "", repoName: "", token: null, healthThreshold: 50, refreshMinutes: 60, scheduleCronTaskUid: null, lastSyncedAt: null };
    }),
    testConnection: protectedProcedure.input(githubRepoInput).mutation(async ({ ctx, input }) => {
      const existing = await getGithubConnection(ctx.user.id);
      const token = input.token?.trim() || existing?.token;
      if (!token) throw new Error("A GitHub token is required for the first connection");
      const result = await githubStatusForConnection({ token, repoOwner: input.repoOwner.trim(), repoName: input.repoName.trim() });
      return { ...result, token: maskGithubToken(token) };
    }),
    saveSettings: protectedProcedure.input(githubRepoInput.extend({ healthThreshold: z.number().int().min(0).max(100).default(50), refreshMinutes: z.number().int().min(15).max(1440).default(60) })).mutation(async ({ ctx, input }) => {
      const existing = await getGithubConnection(ctx.user.id);
      const token = input.token?.trim() || existing?.token;
      if (!token) throw new Error("A GitHub token is required for the first connection");
      await upsertGithubConnection({ userId: ctx.user.id, token, repoOwner: input.repoOwner.trim(), repoName: input.repoName.trim(), healthThreshold: input.healthThreshold, refreshMinutes: input.refreshMinutes, scheduleCronTaskUid: existing?.scheduleCronTaskUid ?? null });
      return { connected: true, repoOwner: input.repoOwner.trim(), repoName: input.repoName.trim(), token: maskGithubToken(token), healthThreshold: input.healthThreshold, refreshMinutes: input.refreshMinutes };
    }),
    configureRefresh: protectedProcedure.input(z.object({ refreshMinutes: z.number().int().min(15).max(1440), healthThreshold: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
      const connection = await getGithubConnection(ctx.user.id);
      if (!connection) throw new Error("Connect GitHub before enabling automatic refresh");
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (connection.scheduleCronTaskUid) {
        await deleteHeartbeatJob(connection.scheduleCronTaskUid, sessionToken);
      }
      const cron = input.refreshMinutes === 1440 ? "0 0 0 * * *" : input.refreshMinutes >= 60 ? `0 0 */${Math.round(input.refreshMinutes / 60)} * * *` : `0 */${input.refreshMinutes} * * * *`;
      const job = await createHeartbeatJob({ name: `github-refresh-${ctx.user.id}`, cron, path: "/api/scheduled/github-refresh", description: "Refresh GitHub project health metrics" }, sessionToken);
      await upsertGithubConnection({ userId: ctx.user.id, token: connection.token, repoOwner: connection.repoOwner, repoName: connection.repoName, healthThreshold: input.healthThreshold, refreshMinutes: input.refreshMinutes, scheduleCronTaskUid: job.taskUid });
      return { refreshMinutes: input.refreshMinutes, healthThreshold: input.healthThreshold, taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt ?? null };
    }),
    deleteSettings: protectedProcedure.mutation(async ({ ctx }) => {
      const connection = await getGithubConnection(ctx.user.id);
      if (connection?.scheduleCronTaskUid) {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        await deleteHeartbeatJob(connection.scheduleCronTaskUid, sessionToken);
      }
      await deleteGithubConnection(ctx.user.id);
      return { success: true } as const;
    }),
    status: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getGithubConnection(ctx.user.id);
      if (!connection) return { connected: false as const };
      const result = await githubStatusForConnection(connection);
      await updateGithubSync(ctx.user.id, result);
      return { ...result, threshold: connection.healthThreshold, warning: result.health < connection.healthThreshold, lastSyncedAt: new Date().toISOString() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
