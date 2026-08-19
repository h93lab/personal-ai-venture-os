from pathlib import Path
import re

path = Path('/home/ubuntu/personal-ai-venture-os/server/routers.ts')
text = path.read_text()
text = text.replace('import { invokeLLM } from "./_core/llm";', 'import { invokeLLM, listLLMModels } from "./_core/llm";')
start = text.index('  github: router({')
end = text.index('\n  }),\n});', start) + len('\n  }),')
new = r'''  ai: router({
    testConnection: protectedProcedure.query(async () => {
      const { data } = await listLLMModels();
      return { connected: true, modelCount: data.length, models: data.slice(0, 12).map((model) => ({ id: model.id, name: model.name ?? model.id })) };
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
  }),'''
text = text[:start] + new + text[end:]
path.write_text(text)
print('added AI connection test, GitHub test, alerts, and refresh scheduling')
