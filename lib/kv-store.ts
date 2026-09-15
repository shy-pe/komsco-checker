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

function safeParseJson<T>(raw: string | null, fallback: T) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
    return safeParseJson(getMemoryStore().get(key) ?? null, fallback);
  }

  try {
    const payload = await runRedisCommand(["GET", key]);
    if (!payload.result || typeof payload.result !== "string") {
      return fallback;
    }

    return safeParseJson(payload.result, fallback);
  } catch (error) {
    console.warn("Falling back to in-memory KV read.", error);
    return safeParseJson(getMemoryStore().get(key) ?? null, fallback);
  }
}

export async function saveJsonValue(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  const config = getUpstashConfig();

  if (!config) {
    getMemoryStore().set(key, raw);
    return;
  }

  try {
    await runRedisCommand(["SET", key, raw]);
  } catch (error) {
    console.warn("Falling back to in-memory KV write.", error);
    getMemoryStore().set(key, raw);
  }
}