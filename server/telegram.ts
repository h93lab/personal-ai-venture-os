import { getTelegramConnection } from "./db";

async function telegramRequest<T>(token: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json() as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram rejected the request (${response.status})`);
  return payload.result as T;
}

export async function testTelegramConnection(input: { botToken: string; chatId: string }) {
  const bot = await telegramRequest<{ username?: string; first_name?: string }>(input.botToken, "getMe");
  await telegramRequest(input.botToken, "sendMessage", { chat_id: input.chatId, text: "Venture OS متصل الآن. ستصل إشعارات مهام الذكاء الاصطناعي هنا." });
  return { connected: true as const, botName: bot.username || bot.first_name || "Telegram Bot" };
}

export async function notifyTelegram(userId: number, message: string) {
  const settings = await getTelegramConnection(userId);
  if (!settings || settings.enabled !== 1) return { sent: false as const, reason: "not-configured" as const };
  await telegramRequest(settings.botToken, "sendMessage", { chat_id: settings.chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true });
  return { sent: true as const };
}
