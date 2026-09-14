import { isTelegramConfigured } from "@/lib/env";

export async function sendTelegramMessage(text: string) {
  if (!isTelegramConfigured()) {
    return false;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN as string;
  const chatId = process.env.TELEGRAM_CHAT_ID as string;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    }),
    cache: "no-store"
  });

  return response.ok;
}
