import { createClient, type RedisClientType } from 'redis';

/**
 * Where free-usage counters actually live.
 *
 * The app previously reached for `@vercel/kv`, which speaks to a REST endpoint and needs
 * `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Neither was ever configured, and both helpers were
 * written to return 0 and do nothing when they were missing -- so every server-side counter silently
 * read as zero. The only limit still standing was a cookie, which resets by clearing site data,
 * opening a private window, or switching browser. That is why a second Google account on the same
 * machine came with a fresh allowance.
 *
 * The database Vercel provisions here hands out a plain `redis://` URL, so it is reached over a
 * socket instead.
 */
let clientPromise: Promise<RedisClientType> | null = null;

function getClient(): Promise<RedisClientType> {
  if (clientPromise) return clientPromise;

  const url = process.env.KV_REDIS_URL || process.env.REDIS_URL;
  if (!url) return Promise.reject(new Error('KV_REDIS_URL is not configured'));

  clientPromise = (async () => {
    const client: RedisClientType = createClient({
      url,
      socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 200, 2000) },
    });
    client.on('error', (e) => console.error('Redis error:', e));
    await client.connect();
    return client;
  })();

  // Don't cache a failed connection, or one blip disables counting until the next deploy.
  clientPromise.catch(() => {
    clientPromise = null;
  });

  return clientPromise;
}

/** True when counters are actually being recorded. */
export async function quotaStoreReady(): Promise<boolean> {
  try {
    await getClient();
    return true;
  } catch {
    return false;
  }
}

export async function quotaGet(key: string): Promise<number> {
  try {
    const client = await getClient();
    const value = await client.get(key);
    return value ? Number(value) || 0 : 0;
  } catch (e) {
    // Loud, because a silent zero here is what let the limits be bypassed for months.
    console.error(`QUOTA NOT ENFORCED: could not read ${key}.`, e);
    return 0;
  }
}

/** Adds one to a counter and returns the new value. Sets an expiry the first time. */
export async function quotaIncrement(key: string, ttlSeconds?: number): Promise<number> {
  try {
    const client = await getClient();
    const next = await client.incr(key);
    if (next === 1 && ttlSeconds) await client.expire(key, ttlSeconds);
    return next;
  } catch (e) {
    console.error(`QUOTA NOT RECORDED: could not increment ${key}.`, e);
    return 0;
  }
}

/** Reads a JSON value written by {@link storeSetJson}. */
export async function storeGetJson<T>(key: string): Promise<T | null> {
  try {
    const client = await getClient();
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`Could not read ${key}:`, e);
    return null;
  }
}

export async function storeSetJson(key: string, value: unknown): Promise<boolean> {
  try {
    const client = await getClient();
    await client.set(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Could not write ${key}:`, e);
    return false;
  }
}

export async function storeGetString(key: string): Promise<string | null> {
  try {
    const client = await getClient();
    return await client.get(key);
  } catch (e) {
    console.error(`Could not read ${key}:`, e);
    return null;
  }
}

export async function storeSetString(key: string, value: string): Promise<boolean> {
  try {
    const client = await getClient();
    await client.set(key, value);
    return true;
  } catch (e) {
    console.error(`Could not write ${key}:`, e);
    return false;
  }
}
