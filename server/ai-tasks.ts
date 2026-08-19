import { invokeLLM } from "./_core/llm";
import { completeAiTaskRun, getAiTask, insertAiTaskRun, markAiTaskRun } from "./db";

export async function executeAiTask(userId: number, taskId: number) {
  const task = await getAiTask(userId, taskId);
  if (!task) throw new Error("AI task not found");
  const startedAt = new Date();
  const runId = await insertAiTaskRun({ taskId, userId });
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a practical venture intelligence assistant. Return a concise, actionable report in Arabic with a short summary, findings, opportunities, risks, and next actions. Do not invent sources." },
        { role: "user", content: `Task title: ${task.title}\nInstructions: ${task.instructions}\nRun date: ${startedAt.toISOString()}` },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    const result = typeof content === "string" ? content : JSON.stringify(content ?? response);
    await completeAiTaskRun(userId, runId, { status: "success", result });
    await markAiTaskRun(userId, taskId, startedAt);
    return { runId, status: "success" as const, result, completedAt: new Date() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeAiTaskRun(userId, runId, { status: "failed", error: message });
    throw error;
  }
}
