import { DEFAULT_TIMEOUT_MS, ALERT_FAILURE_THRESHOLD, MONITOR_INTERVAL_MINUTES } from "@/lib/env";
import { getStorageInfo } from "@/lib/kv-store";
import { executeMonitoringCycle, readDashboardPayload } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const dashboard = await readDashboardPayload();

  return Response.json(dashboard, {
    headers: {
      "cache-control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  const dashboardBefore = await readDashboardPayload();
  const { searchParams } = new URL(request.url);
  const timeoutValue = Number(searchParams.get("timeout"));
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_TIMEOUT_MS;
  const result = await executeMonitoringCycle({
    timeoutMs,
    notify: false
  });

  if (result.skipped) {
    return Response.json({
      ...dashboardBefore,
      storage: getStorageInfo(),
      alerting: {
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        cronConfigured: Boolean(process.env.CRON_SECRET),
        failureThreshold: ALERT_FAILURE_THRESHOLD,
        monitorIntervalMinutes: MONITOR_INTERVAL_MINUTES
      },
      operation: {
        source: "manual" as const,
        enabled: dashboardBefore.monitor.control.enabled,
        changed: false,
        skipped: true,
        reason: "paused" as const,
        message: "전체 모니터링이 일시정지되어 수동 점검을 건너뛰었습니다."
      }
    }, {
      headers: {
        "cache-control": "no-store"
      }
    });
  }

  return Response.json({
    monitor: result.store,
    storage: getStorageInfo(),
    alerting: {
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      cronConfigured: Boolean(process.env.CRON_SECRET),
      failureThreshold: ALERT_FAILURE_THRESHOLD,
      monitorIntervalMinutes: MONITOR_INTERVAL_MINUTES
    },
    operation: {
      source: "manual" as const,
      enabled: result.store.control.enabled,
      changed: false,
      skipped: false,
      reason: null,
      message: "수동 점검을 실행했습니다."
    }
  }, {
    headers: {
      "cache-control": "no-store"
    }
  });
}