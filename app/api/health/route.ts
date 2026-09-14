import { DEFAULT_TIMEOUT_MS } from "@/lib/env";
import { ALERT_FAILURE_THRESHOLD, MONITOR_INTERVAL_MINUTES } from "@/lib/env";
import { executeMonitoringCycle, readDashboardPayload } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const dashboard = await readDashboardPayload();

  if (!dashboard.monitor.latest) {
    const result = await executeMonitoringCycle({
      timeoutMs: DEFAULT_TIMEOUT_MS,
      notify: false
    });

    return Response.json({
      monitor: result.store,
      storage: dashboard.storage,
      alerting: dashboard.alerting
    }, {
      headers: {
        "cache-control": "no-store"
      }
    });
  }

  return Response.json(dashboard, {
    headers: {
      "cache-control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeoutValue = Number(searchParams.get("timeout"));
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_TIMEOUT_MS;
  const result = await executeMonitoringCycle({
    timeoutMs,
    notify: false
  });

  return Response.json({
    monitor: result.store,
    storage: {
      provider: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ? "upstash-rest" : "memory",
      connected: Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
    },
    alerting: {
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      cronConfigured: Boolean(process.env.CRON_SECRET),
      failureThreshold: ALERT_FAILURE_THRESHOLD,
      monitorIntervalMinutes: MONITOR_INTERVAL_MINUTES
    }
  }, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
