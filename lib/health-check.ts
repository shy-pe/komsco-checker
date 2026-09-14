import { APP_VERSION, DEFAULT_TIMEOUT_MS } from "@/lib/env";
import { getSites } from "@/lib/site-repository";
import type { HealthPayload, HealthResult, SiteConfig } from "@/lib/types";

async function checkSite(site: SiteConfig, timeoutMs: number): Promise<HealthResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(site.url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });

    const latencyMs = Math.round(performance.now() - startedAt);
    const state = response.ok ? "up" : "down";

    return {
      id: site.id,
      name: site.name,
      url: site.url,
      state,
      statusCode: response.status,
      latencyMs,
      checkedAt: new Date().toISOString(),
      detail: response.ok ? "ok" : "http-error"
    };
  } catch (error) {
    return {
      id: site.id,
      name: site.name,
      url: site.url,
      state: "down",
      statusCode: null,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error && error.name === "AbortError" ? "timeout" : "network-error"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runHealthCheck(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HealthPayload> {
  const sites = getSites();
  const results = await Promise.all(sites.map((site) => checkSite(site, timeoutMs)));
  const upResults = results.filter((result) => result.state === "up");
  const latencies = upResults
    .map((result) => result.latencyMs)
    .filter((value): value is number => Number.isFinite(value));

  return {
    version: APP_VERSION,
    runtime: "server",
    source: "data/sites.json",
    sites,
    results,
    summary: {
      total: results.length,
      up: upResults.length,
      down: results.length - upResults.length,
      averageLatencyMs: latencies.length
        ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
        : null,
      checkedAt: new Date().toISOString()
    }
  };
}
