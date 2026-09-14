import {
  APP_VERSION,
  ALERT_FAILURE_THRESHOLD,
  DEFAULT_TIMEOUT_MS,
  isTelegramConfigured,
  MONITOR_INTERVAL_MINUTES
} from "@/lib/env";
import { runHealthCheck } from "@/lib/health-check";
import { getStorageInfo } from "@/lib/kv-store";
import { loadMonitorStore, mergePayloadIntoStore, saveMonitorStore } from "@/lib/monitor-store";
import { sendTelegramMessage } from "@/lib/telegram";
import type { AlertEvent, DashboardPayload, HealthPayload, MonitorStore } from "@/lib/types";

function countConsecutiveFailures(store: MonitorStore, siteId: string) {
  const samples = store.rawHistoryBySite[siteId] || [];
  let count = 0;

  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (samples[index].state !== "down") {
      break;
    }
    count += 1;
  }

  return count;
}

function buildAlertEvents(store: MonitorStore, current: HealthPayload): AlertEvent[] {
  const previous = store.latest;
  const previousMap = new Map(previous?.results.map((result) => [result.id, result]) || []);
  const currentTime = current.summary.checkedAt;
  const events: AlertEvent[] = [];

  current.results.forEach((result) => {
    const before = previousMap.get(result.id);
    const previousFailureCount = countConsecutiveFailures(store, result.id);
    const failureCount = result.state === "down" ? previousFailureCount + 1 : 0;

    if (before && before.state !== "down" && result.state === "down" && ALERT_FAILURE_THRESHOLD > 1) {
      events.push({
        id: `${result.id}-${currentTime}-down`,
        siteId: result.id,
        siteName: result.name,
        type: "down",
        message: `[장애] ${result.name} 응답 실패 (${result.statusCode ?? result.detail})`,
        checkedAt: currentTime,
        statusCode: result.statusCode,
        failureCount
      });
    }

    // Initial checks count too, so an already-unavailable site receives an
    // external alert once it has failed the configured number of times.
    if (result.state === "down" && failureCount === ALERT_FAILURE_THRESHOLD) {
      events.push({
        id: `${result.id}-${currentTime}-failure-threshold`,
        siteId: result.id,
        siteName: result.name,
        type: "failure-threshold",
        message: `[장애] ${result.name} ${failureCount}회 연속 응답 실패 (${result.statusCode ?? result.detail})`,
        checkedAt: currentTime,
        statusCode: result.statusCode,
        failureCount
      });
    }

    // A recovery is useful externally only if the failed incident previously
    // reached the notification threshold.
    if (before?.state === "down" && result.state === "up" && previousFailureCount >= ALERT_FAILURE_THRESHOLD) {
      events.push({
        id: `${result.id}-${currentTime}-recovered`,
        siteId: result.id,
        siteName: result.name,
        type: "recovered",
        message: `[복구] ${result.name} 정상 응답 (${result.statusCode ?? "OK"})`,
        checkedAt: currentTime,
        statusCode: result.statusCode,
        failureCount: previousFailureCount
      });
    }
  });

  return events;
}

async function notifyTelegram(events: AlertEvent[]) {
  if (!isTelegramConfigured() || !events.length) {
    return;
  }

  const telegramEvents = events.filter((event) => event.type !== "down");
  if (!telegramEvents.length) {
    return;
  }

  const lines = [
    `KOMSCO Service Monitor ${APP_VERSION}`,
    ...telegramEvents.map((event) => `${event.checkedAt} ${event.message}`)
  ];

  try {
    await sendTelegramMessage(lines.join("\n"));
  } catch (error) {
    console.error("Telegram notify failed", error);
  }
}

export async function executeMonitoringCycle(options?: {
  timeoutMs?: number;
  notify?: boolean;
}) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const notify = options?.notify ?? false;
  const store = await loadMonitorStore();
  const payload = await runHealthCheck(timeoutMs);
  const alerts = buildAlertEvents(store, payload);
  const nextStore = mergePayloadIntoStore(store, payload, alerts);

  await saveMonitorStore(nextStore);

  if (notify) {
    await notifyTelegram(alerts);
  }

  return {
    payload,
    store: nextStore,
    alerts
  };
}

export async function readDashboardPayload(): Promise<DashboardPayload> {
  const store = await loadMonitorStore();
  return {
    monitor: store,
    storage: getStorageInfo(),
    alerting: {
      telegramConfigured: isTelegramConfigured(),
      cronConfigured: Boolean(process.env.CRON_SECRET),
      failureThreshold: ALERT_FAILURE_THRESHOLD,
      monitorIntervalMinutes: MONITOR_INTERVAL_MINUTES
    }
  };
}
