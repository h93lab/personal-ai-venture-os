export type AiTaskRunStatRow = { status: "running" | "success" | "failed"; startedAt: Date | string | number };

export function buildAiTaskStats(rows: AiTaskRunStatRow[], days: number, now = new Date()) {
  const byDate = new Map<string, { date: string; success: number; failed: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) { const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); byDate.set(date, { date, success: 0, failed: 0 }); }
  for (const row of rows) { const date = new Date(row.startedAt).toISOString().slice(0, 10); const entry = byDate.get(date); if (!entry) continue; if (row.status === "success") entry.success += 1; if (row.status === "failed") entry.failed += 1; }
  return Array.from(byDate.values());
}
