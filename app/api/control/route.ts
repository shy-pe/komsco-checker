import { isDashboardControlConfigured } from "@/lib/env";
import { getStorageInfo } from "@/lib/kv-store";
import { readDashboardPayload, setMonitoringEnabled } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const expected = process.env.DASHBOARD_CONTROL_SECRET;
  if (!expected) {
    return false;
  }

  const provided = request.headers.get("x-dashboard-control-secret");
  return provided === expected;
}

export async function GET() {
  const dashboard = await readDashboardPayload();

  return Response.json({
    ...dashboard,
    control: {
      configured: isDashboardControlConfigured()
    }
  }, {
    headers: {
      "cache-control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  const enabled = body?.enabled;

  if (typeof enabled !== "boolean") {
    return Response.json({ message: "enabled boolean is required" }, { status: 400 });
  }

  const result = await setMonitoringEnabled(enabled, "dashboard");
  const dashboard = await readDashboardPayload();

  return Response.json({
    ...dashboard,
    storage: getStorageInfo(),
    control: {
      configured: isDashboardControlConfigured()
    },
    operation: {
      source: "dashboard" as const,
      enabled: result.store.control.enabled,
      changed: result.changed,
      skipped: false,
      reason: null,
      message: result.changed
        ? enabled
          ? "전체 모니터링을 재개했습니다."
          : "전체 모니터링을 일시정지했습니다."
        : enabled
          ? "이미 모니터링이 실행 중입니다."
          : "이미 모니터링이 일시정지되어 있습니다."
    }
  }, {
    headers: {
      "cache-control": "no-store"
    }
  });
}