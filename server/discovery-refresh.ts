import type { Request, Response } from "express";
import { externalFetch } from "./http-client";
import { findDiscoverySignalBySourceKey, getDiscoverySettingsByTaskUid, insertDiscoverySignal, updateDiscoveryFetch, updateDiscoverySignal } from "./db";
import { isLocalSchedulerRequest } from "./local-scheduler-auth";

type HnHit = { objectID?: string; title?: string; url?: string | null; points?: number | null; num_comments?: number | null };
type HnResponse = { hits?: HnHit[] };
type GithubRepo = { id?: number; full_name?: string; html_url?: string; description?: string | null; stargazers_count?: number; forks_count?: number; open_issues_count?: number; language?: string | null; updated_at?: string };
type GithubResponse = { items?: GithubRepo[] };
export type DiscoveryCandidate = { sourceKey: string; sourceUrl: string; title: string; type: string; score: number; sourceCount: number; description: string; verificationDays: number; status: string };

export function scoreHackerNewsHit(hit: Pick<HnHit, "points" | "num_comments">) { return Math.max(0, Math.min(100, Math.round((hit.points ?? 0) * 1.2 + (hit.num_comments ?? 0) * 0.8))); }
export function normalizeHackerNewsHits(payload: HnResponse): DiscoveryCandidate[] { return (payload.hits ?? []).filter((hit): hit is HnHit & { objectID: string; title: string } => Boolean(hit.objectID && hit.title?.trim())).map((hit) => ({ sourceKey: `hn:${hit.objectID}`, sourceUrl: hit.url?.startsWith("https://") ? hit.url : `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`, title: hit.title.trim().slice(0, 220), type: "Hacker News · إشارة سوق", score: scoreHackerNewsHit(hit), sourceCount: 1, description: `إشارة حديثة من Hacker News: ${hit.title.trim().slice(0, 420)}`, verificationDays: 2, status: "new" })); }

export function scoreGithubRepository(repo: Pick<GithubRepo, "stargazers_count" | "forks_count" | "open_issues_count">) { return Math.max(0, Math.min(100, Math.round(Math.log10((repo.stargazers_count ?? 0) + 1) * 22 + Math.log10((repo.forks_count ?? 0) + 1) * 10 + Math.min(repo.open_issues_count ?? 0, 50) * 0.25))); }
export function normalizeGithubRepositories(payload: GithubResponse): DiscoveryCandidate[] { return (payload.items ?? []).filter((repo): repo is GithubRepo & { id: number; full_name: string; html_url: string } => Boolean(repo.id && repo.full_name && repo.html_url)).map((repo) => ({ sourceKey: `github:${repo.id}`, sourceUrl: repo.html_url, title: repo.full_name.slice(0, 220), type: "GitHub Trending · مستودع", score: scoreGithubRepository(repo), sourceCount: 1, description: `${repo.description?.trim() || "مستودع مفتوح المصدر يستحق المتابعة."} · ${repo.language || "لغة متعددة"} · ${repo.stargazers_count ?? 0} stars`, verificationDays: 3, status: "new" })); }

export async function fetchHackerNewsSignals(query: string, now = new Date()) { const since = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000); const url = new URL("https://hn.algolia.com/api/v1/search_by_date"); url.searchParams.set("query", query); url.searchParams.set("tags", "story"); url.searchParams.set("hitsPerPage", "25"); url.searchParams.set("numericFilters", `created_at_i>${since}`); const response = await externalFetch(url.toString(), { headers: { Accept: "application/json" } }); if (!response.ok) throw new Error(`Hacker News source failed (${response.status})`); return normalizeHackerNewsHits(await response.json() as HnResponse); }
export async function fetchGithubDiscoverySignals(query: string, now = new Date()) { const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); const url = new URL("https://api.github.com/search/repositories"); url.searchParams.set("q", `${query} created:>${since}`); url.searchParams.set("sort", "updated"); url.searchParams.set("order", "desc"); url.searchParams.set("per_page", "25"); const response = await externalFetch(url.toString(), { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "personal-ai-venture-os" } }); if (!response.ok) throw new Error(`GitHub source failed (${response.status})`); return normalizeGithubRepositories(await response.json() as GithubResponse); }

export async function refreshDiscoveryForUser(userId: number, query: string, source: string = "hn_algolia") { const candidates = source === "github" ? await fetchGithubDiscoverySignals(query) : await fetchHackerNewsSignals(query); let inserted = 0; let updated = 0; for (const candidate of candidates) { const existing = await findDiscoverySignalBySourceKey(userId, candidate.sourceKey); if (existing) { await updateDiscoverySignal(userId, existing.id, candidate); updated += 1; } else { await insertDiscoverySignal({ ...candidate, userId }); inserted += 1; } } await updateDiscoveryFetch(userId, new Date()); return { fetched: candidates.length, inserted, updated, source }; }

function localDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localMinuteKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour12: false, hour: "2-digit", minute: "2-digit" }).format(date);
}

export async function discoveryRefreshHandler(req: Request, res: Response) {
  try {
    if (!isLocalSchedulerRequest(req)) return res.status(403).json({ error: "cron-only" });
    const taskUid = typeof req.body?.taskUid === "string" ? req.body.taskUid : null;
    if (!taskUid) return res.status(400).json({ error: "taskUid-required" });
    const settings = await getDiscoverySettingsByTaskUid(taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    if (!settings.enabled) return res.json({ ok: true, skipped: "disabled" });
    const now = new Date();
    const expectedMinute = `${String(settings.localHour).padStart(2, "0")}:${String(settings.localMinute).padStart(2, "0")}`;
    if (localMinuteKey(now, settings.timezone) !== expectedMinute) return res.json({ ok: true, skipped: "not-local-time", expectedMinute, timezone: settings.timezone });
    if (settings.lastFetchedAt && localDateKey(new Date(settings.lastFetchedAt), settings.timezone) === localDateKey(now, settings.timezone)) return res.json({ ok: true, skipped: "already-ran-today", timezone: settings.timezone });
    const result = await refreshDiscoveryForUser(settings.userId, settings.query, settings.source);
    return res.json({ ok: true, ...result, fetchedAt: now.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /session|cron|forbidden|unauthorized/i.test(message) ? 403 : 500;
    return res.status(status).json({ error: status === 403 ? "forbidden" : "discovery-refresh-failed", timestamp: new Date().toISOString() });
  }
}
