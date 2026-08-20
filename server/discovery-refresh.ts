import type { Request, Response } from "express";
import { externalFetch } from "./http-client";
import { findDiscoverySignalBySourceKey, getDiscoverySettingsByTaskUid, insertDiscoverySignal, updateDiscoveryFetch, updateDiscoverySignal } from "./db";
import { sdk } from "./_core/sdk";

type HnHit = { objectID?: string; title?: string; url?: string | null; points?: number | null; num_comments?: number | null; created_at_i?: number | null; story_text?: string | null };
type HnResponse = { hits?: HnHit[] };
export type DiscoveryCandidate = { sourceKey: string; sourceUrl: string; title: string; type: string; score: number; sourceCount: number; description: string; verificationDays: number; status: string };

export function scoreHackerNewsHit(hit: Pick<HnHit, "points" | "num_comments">) {
  return Math.max(0, Math.min(100, Math.round((hit.points ?? 0) * 1.2 + (hit.num_comments ?? 0) * 0.8)));
}

export function normalizeHackerNewsHits(payload: HnResponse): DiscoveryCandidate[] {
  return (payload.hits ?? []).filter((hit): hit is HnHit & { objectID: string; title: string } => Boolean(hit.objectID && hit.title?.trim())).map((hit) => ({
    sourceKey: `hn:${hit.objectID}`,
    sourceUrl: hit.url?.startsWith("https://") ? hit.url : `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`,
    title: hit.title.trim().slice(0, 220),
    type: "Hacker News · إشارة سوق",
    score: scoreHackerNewsHit(hit),
    sourceCount: 1,
    description: `إشارة حديثة من Hacker News: ${hit.title.trim().slice(0, 420)}`,
    verificationDays: 2,
    status: "new",
  }));
}

export async function fetchHackerNewsSignals(query: string, now = new Date()) {
  const since = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000);
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", "25");
  url.searchParams.set("numericFilters", `created_at_i>${since}`);
  const response = await externalFetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Hacker News source failed (${response.status})`);
  return normalizeHackerNewsHits(await response.json() as HnResponse);
}

export async function refreshDiscoveryForUser(userId: number, query: string) {
  const candidates = await fetchHackerNewsSignals(query);
  let inserted = 0;
  let updated = 0;
  for (const candidate of candidates) {
    const existing = await findDiscoverySignalBySourceKey(userId, candidate.sourceKey);
    if (existing) {
      await updateDiscoverySignal(userId, existing.id, candidate);
      updated += 1;
    } else {
      await insertDiscoverySignal({ ...candidate, userId });
      inserted += 1;
    }
  }
  await updateDiscoveryFetch(userId, new Date());
  return { fetched: candidates.length, inserted, updated };
}

export async function discoveryRefreshHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const settings = await getDiscoverySettingsByTaskUid(user.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    if (!settings.enabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await refreshDiscoveryForUser(settings.userId, settings.query);
    return res.json({ ok: true, source: settings.source, ...result, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /session|cron|forbidden|unauthorized/i.test(message) ? 403 : 500;
    return res.status(status).json({ error: status === 403 ? "forbidden" : "discovery-refresh-failed", timestamp: new Date().toISOString() });
  }
}
