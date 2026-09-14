type MemoryStore = Map<string, string>;

declare global {
  // eslint-disable-next-line no-var
  var __pulseboardMemoryStore: MemoryStore | undefined;
}

function getMemoryStore() {
  if (!globalThis.__pulseboardMemoryStore) {
    globalThis.__pulseboardMemoryStore = new Map<string, string>();
  }
  return globalThis.__pulseboardMemoryStore;
}

function getUpstashConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function runRedisCommand(command: unknown[]) {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error("KV is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`KV command failed (${response.status})`);
  }

  return response.json() as Promise<{ result?: unknown; error?: string }>;
}

export function getStorageInfo() {
  const configured = Boolean(getUpstashConfig());
  return {
    provider: configured ? ("upstash-rest" as const) : ("memory" as const),
    connected: configured
  };
}

export async function loadJsonValue<T>(key: string, fallback: T): Promise<T> {
  const config = getUpstashConfig();

  if (!config) {
    const raw = getMemoryStore().get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  }

  const payload = await runRedisCommand(["GET", key]);
  if (!payload.result || typeof payload.result !== "string") {
    return fallback;
  }

  return JSON.parse(payload.result) as T;
}

export async function saveJsonValue(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  const config = getUpstashConfig();

  if (!config) {
    getMemoryStore().set(key, raw);
    return;
  }

  await runRedisCommand(["SET", key, raw]);
}
