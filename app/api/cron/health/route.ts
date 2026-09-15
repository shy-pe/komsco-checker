import { DEFAULT_TIMEOUT_MS } from "@/lib/env";
import { executeMonitoringCycle } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return false;
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeoutValue = Number(searchParams.get("timeout"));
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_TIMEOUT_MS;
  const result = await executeMonitoringCycle({
    timeoutMs,
    notify: true
  });

  if (result.skipped) {
    return Response.json({
      ok: true,
      paused: true,
      skipped: true,
      reason: result.reason,
      message: "Monitoring is paused."
    });
  }

  return Response.json({
    ok: true,
    checkedAt: result.payload?.summary.checkedAt,
    alerts: result.alerts.length,
    up: result.payload?.summary.up ?? 0,
    down: result.payload?.summary.down ?? 0
  });
}