export type AiTaskRunFilterInput = {
  taskId: number;
  status: "running" | "success" | "failed";
  startedAt: Date | string | number;
};

export type AiTaskRunFilters = {
  taskId?: number;
  status?: "running" | "success" | "failed";
  fromDate?: string;
  toDate?: string;
};

export function filterAiTaskRuns<T extends AiTaskRunFilterInput>(runs: T[], filters: AiTaskRunFilters) {
  return runs.filter((run) => {
    const date = new Date(run.startedAt);
    const matchesTask = filters.taskId === undefined || run.taskId === filters.taskId;
    const matchesStatus = filters.status === undefined || run.status === filters.status;
    const afterFrom = !filters.fromDate || date >= new Date(`${filters.fromDate}T00:00:00`);
    const beforeTo = !filters.toDate || date <= new Date(`${filters.toDate}T23:59:59`);
    return matchesTask && matchesStatus && afterFrom && beforeTo;
  });
}
