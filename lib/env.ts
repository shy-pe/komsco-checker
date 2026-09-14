export const APP_VERSION = "v1.1.0";
export const RAW_LIMIT = 180;
export const ARCHIVE_LIMIT = 24 * 30;
export const ALERT_LIMIT = 80;
export const HOUR_MS = 60 * 60 * 1000;
export const MONITOR_STORE_KEY = "pulseboard:monitor-store";
export const DEFAULT_TIMEOUT_MS = 8000;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// A single failed request can be transient. Notify external channels only after
// this many consecutive failures; the dashboard still shows every failure.
export const TELEGRAM_FAILURE_THRESHOLD = positiveInteger(process.env.TELEGRAM_FAILURE_THRESHOLD, 3);

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export function isCronConfigured() {
  return Boolean(process.env.CRON_SECRET);
}
