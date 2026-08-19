export type AiStatsExportRow = { date: string; success: number; failed: number };

export function toAiStatsExportRows(stats: AiStatsExportRow[]) {
  return stats.map((item) => [item.date, String(item.success), String(item.failed)]);
}
