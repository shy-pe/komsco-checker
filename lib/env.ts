export const APP_VERSION = "v1.3.0";
export const RAW_LIMIT = 180;
export const ARCHIVE_LIMIT = 24 * 30;
export const ALERT_LIMIT = 80;
export const CONTROL_HISTORY_LIMIT = 24;
export const HOUR_MS = 60 * 60 * 1000;
export const MONITOR_STORE_KEY = "pulseboard:monitor-store";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const DEFAULT_TIMEOUT_MS = positiveInteger(process.env.MONITOR_TIMEOUT_MS, 8000);
export const MONITOR_INTERVAL_MINUTES = positiveInteger(process.env.MONITOR_INTERVAL_MINUTES, 5);

// Shared by every alert channel. The legacy variable remains supported.
export const ALERT_FAILURE_THRESHOLD = positiveInteger(
  process.env.ALERT_FAILURE_THRESHOLD ?? process.env.TELEGRAM_FAILURE_THRESHOLD,
  1
);

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export function isCronConfigured() {
  return Boolean(process.env.CRON_SECRET);
}

export function isDashboardControlConfigured() {
  return Boolean(process.env.DASHBOARD_CONTROL_SECRET);
}