export type SiteConfig = {
  id: string;
  name: string;
  url: string;
};

export type HealthState = "up" | "down";

export type HealthDetail = "ok" | "http-error" | "timeout" | "network-error";

export type HealthResult = {
  id: string;
  name: string;
  url: string;
  state: HealthState;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  detail: HealthDetail;
};

export type HealthSummary = {
  total: number;
  up: number;
  down: number;
  averageLatencyMs: number | null;
  checkedAt: string;
};

export type HealthPayload = {
  version: string;
  runtime: "server";
  source: "data/sites.json";
  sites: SiteConfig[];
  results: HealthResult[];
  summary: HealthSummary;
};

export type RawHistorySample = {
  ts: number;
  state: HealthState;
  latencyMs: number | null;
  detail: HealthDetail;
  statusCode: number | null;
};

export type HourlyAggregate = {
  bucketStart: number;
  total: number;
  up: number;
  down: number;
  latencySum: number;
  latencySamples: number;
};

export type AlertEvent = {
  id: string;
  siteId: string;
  siteName: string;
  type: "down" | "failure-threshold" | "recovered";
  message: string;
  checkedAt: string;
  statusCode: number | null;
  failureCount?: number;
};

export type MonitorStore = {
  version: string;
  latest: HealthPayload | null;
  rawHistoryBySite: Record<string, RawHistorySample[]>;
  hourlyHistoryBySite: Record<string, HourlyAggregate[]>;
  recentAlerts: AlertEvent[];
  updatedAt: string | null;
};

export type DashboardPayload = {
  monitor: MonitorStore;
  storage: {
    provider: "upstash-rest" | "memory";
    connected: boolean;
  };
  alerting: {
    telegramConfigured: boolean;
    cronConfigured: boolean;
    failureThreshold: number;
    monitorIntervalMinutes: number;
  };
};
