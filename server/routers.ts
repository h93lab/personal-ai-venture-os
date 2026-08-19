import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookie } from "cookie";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { deleteGithubConnection, getGithubConnection, updateGithubSchedule, updateGithubSync, upsertGithubConnection, getAiProviderSettings, upsertAiProviderSettings, deleteAiProviderSettings } from "./db";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";

export function maskGithubToken(token: string | undefined) {
  if (!token) return null;
  return token.length <= 8 ? "••••••••" : `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

async function githubRequest<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
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
      const response = await fetch(`${endpoint}/models`, { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "User-Agent": "personal-ai-venture-os" } });
      if (!response.ok) throw new Error(`${input.provider || saved?.provider || "AI Provider"} rejected the connection (${response.status})`);
      const payload = await response.json() as { data?: Array<{ id?: string }> };
      const models = (payload.data ?? []).filter((model): model is { id: string } => typeof model.id === "string").slice(0, 50).map((model) => model.id);
      return { connected: true, modelCount: models.length, models };
    }),
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
