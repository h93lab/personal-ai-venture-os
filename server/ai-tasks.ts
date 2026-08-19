import { randomUUID } from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { acquireAiTaskLock, completeAiTaskRun, getAiTask, insertAiTaskRun, markAiTaskRun, releaseAiTaskLock } from "./db";
import { notifyTelegram } from "./telegram";

export async function executeAiTask(userId: number, taskId: number) {
  const task = await getAiTask(userId, taskId);
  if (!task) throw new Error("AI task not found");
  const startedAt = new Date();
  const lockToken = randomUUID();
  const locked = await acquireAiTaskLock(userId, taskId, lockToken, startedAt);
  if (!locked) throw new Error("AI task is already running or paused");
  let runId: number | undefined;
  try {
    runId = await insertAiTaskRun({ taskId, userId });
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
    try { await notifyTelegram(userId, { kind: "success", taskTitle: task.title, result: result.slice(0, 2500) }); } catch (notificationError) { console.warn("[Telegram] Success notification failed", notificationError); }
    return { runId, status: "success" as const, result, completedAt: new Date() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId !== undefined) {
      await completeAiTaskRun(userId, runId, { status: "failed", error: message });
      try { await notifyTelegram(userId, { kind: "failure", taskTitle: task.title, error: message.slice(0, 1500) }); } catch (notificationError) { console.warn("[Telegram] Failure notification failed", notificationError); }
    }
    throw error;
  } finally {
    await releaseAiTaskLock(userId, taskId, lockToken);
  }
}
