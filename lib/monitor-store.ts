import { ALERT_LIMIT, APP_VERSION, ARCHIVE_LIMIT, CONTROL_HISTORY_LIMIT, HOUR_MS, MONITOR_STORE_KEY, RAW_LIMIT } from "@/lib/env";
import { loadJsonValue, saveJsonValue } from "@/lib/kv-store";
import type { AlertEvent, HealthPayload, MonitorStore, MonitoringControlEvent, MonitoringControlSource, RawHistorySample } from "@/lib/types";

function createEmptyStore(): MonitorStore {
  return {
    version: APP_VERSION,
    latest: null,
    rawHistoryBySite: {},
    hourlyHistoryBySite: {},
    recentAlerts: [],
    control: {
      enabled: true,
      updatedAt: null,
      updatedBy: null
    },
    controlHistory: [],
    updatedAt: null
  };
}

function getBucketStart(ts: number) {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

function pushSample(store: MonitorStore, siteId: string, sample: RawHistorySample) {
  const existing = store.rawHistoryBySite[siteId] || [];
  store.rawHistoryBySite[siteId] = [...existing, sample].slice(-RAW_LIMIT);
}

function updateHourly(store: MonitorStore, siteId: string, sample: RawHistorySample) {
  const existing = [...(store.hourlyHistoryBySite[siteId] || [])];
  const bucketStart = getBucketStart(sample.ts);
  const last = existing[existing.length - 1];

  if (!last || last.bucketStart !== bucketStart) {
    existing.push({
      bucketStart,
      total: 0,
      up: 0,
      down: 0,
      latencySum: 0,
      latencySamples: 0
    });
  }

  const bucket = existing[existing.length - 1];
  bucket.total += 1;
  if (sample.state === "up") {
    bucket.up += 1;
  } else {
    bucket.down += 1;
  }
  if (Number.isFinite(sample.latencyMs)) {
    bucket.latencySum += sample.latencyMs || 0;
    bucket.latencySamples += 1;
  }

  store.hourlyHistoryBySite[siteId] = existing.slice(-ARCHIVE_LIMIT);
}

function createControlEvent(enabled: boolean, source: MonitoringControlSource, at: string): MonitoringControlEvent {
  return {
    id: `control-${enabled ? "resumed" : "paused"}-${at}`,
    type: enabled ? "resumed" : "paused",
    source,
    message: enabled ? "전체 모니터링을 재개했습니다." : "전체 모니터링을 일시정지했습니다.",
    at
  };
}

export async function loadMonitorStore() {
  return loadJsonValue<MonitorStore>(MONITOR_STORE_KEY, createEmptyStore());
}

export async function saveMonitorStore(store: MonitorStore) {
  await saveJsonValue(MONITOR_STORE_KEY, store);
}

export function updateMonitoringControl(
  store: MonitorStore,
  enabled: boolean,
  source: MonitoringControlSource,
  at = new Date().toISOString()
) {
  if (store.control.enabled === enabled) {
    return {
      store,
      changed: false,
      event: null
    };
  }

  const event = createControlEvent(enabled, source, at);
  const nextStore: MonitorStore = {
    ...store,
    version: APP_VERSION,
    control: {
      enabled,
      updatedAt: at,
      updatedBy: source
    },
    controlHistory: [event, ...store.controlHistory].slice(0, CONTROL_HISTORY_LIMIT)
  };

  return {
    store: nextStore,
    changed: true,
    event
  };
}

export function mergePayloadIntoStore(store: MonitorStore, payload: HealthPayload, alerts: AlertEvent[]) {
  const nextStore: MonitorStore = {
    ...store,
    version: APP_VERSION,
    latest: payload,
    updatedAt: payload.summary.checkedAt,
    rawHistoryBySite: { ...store.rawHistoryBySite },
    hourlyHistoryBySite: { ...store.hourlyHistoryBySite },
    recentAlerts: [...alerts, ...store.recentAlerts].slice(0, ALERT_LIMIT)
  };

  const checkedTs = Date.parse(payload.summary.checkedAt);
  payload.results.forEach((result) => {
    const sample: RawHistorySample = {
      ts: checkedTs,
      state: result.state,
      latencyMs: result.latencyMs,
      detail: result.detail,
      statusCode: result.statusCode
    };
    pushSample(nextStore, result.id, sample);
    updateHourly(nextStore, result.id, sample);
  });

  return nextStore;
}