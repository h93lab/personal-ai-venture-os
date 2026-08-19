export const DEFAULT_TELEGRAM_TEMPLATES = {
  success: "✅ اكتملت مهمة AI: {{task_title}}\n\n{{result}}",
  failure: "❌ فشلت مهمة AI: {{task_title}}\n\nالخطأ: {{error}}",
};

export function renderTelegramTemplate(template: string, values: { task_title: string; result?: string; error?: string }) {
  return template.replace(/\{\{\s*(task_title|result|error)\s*\}\}/g, (_, key: "task_title" | "result" | "error") => values[key] ?? "");
}
