import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { deleteGithubConnection, getGithubConnection, upsertGithubConnection } from "./db";

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

  github: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getGithubConnection(ctx.user.id);
      return connection ? { connected: true, repoOwner: connection.repoOwner, repoName: connection.repoName, token: maskGithubToken(connection.token) } : { connected: false, repoOwner: "", repoName: "", token: null };
    }),
    saveSettings: protectedProcedure.input(githubRepoInput).mutation(async ({ ctx, input }) => {
      const existing = await getGithubConnection(ctx.user.id);
      const token = input.token?.trim() || existing?.token;
      if (!token) throw new Error("A GitHub token is required for the first connection");
      await upsertGithubConnection({ userId: ctx.user.id, token, repoOwner: input.repoOwner.trim(), repoName: input.repoName.trim() });
      return { connected: true, repoOwner: input.repoOwner.trim(), repoName: input.repoName.trim(), token: maskGithubToken(token) };
    }),
    deleteSettings: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteGithubConnection(ctx.user.id);
      return { success: true } as const;
    }),
    status: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getGithubConnection(ctx.user.id);
      if (!connection) return { connected: false as const };
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
    }),
  }),
});

export type AppRouter = typeof appRouter;
