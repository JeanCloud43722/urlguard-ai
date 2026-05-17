/**
 * Redis Cache Service with Node-Cache Fallback
 * Automatically uses in-memory cache when Redis is unavailable
 */

import NodeCache from 'node-cache';
import Redis from 'ioredis';

let redisClient: Redis | null = null;
let memoryCache: NodeCache | null = null;
let useMemoryCache = false;

async function initializeRedis(): Promise<Redis | null> {
  try {
    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      enableReadyCheck: false,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      retryStrategy: (times: number) => (times > 2 ? null : Math.min(times * 50, 1000)),
    });

    // Test connection
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);

    console.log('[Cache] ✅ Redis connected successfully');
    useMemoryCache = false;
    return client;
  } catch (error) {
    console.warn('[Cache] ⚠️ Redis unavailable, using in-memory fallback:', (error as Error).message);
    useMemoryCache = true;
    return null;
  }
}

function getMemoryCache(): NodeCache {
  if (!memoryCache) {
    memoryCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
    console.log('[Cache] 📦 In-memory cache initialized');
  }
  return memoryCache;
}

export async function getCacheClient() {
  if (!redisClient && !useMemoryCache) {
    redisClient = await initializeRedis();
  }

  if (useMemoryCache || !redisClient) {
    return {
      get: (key: string) => getMemoryCache().get(key),
      set: (key: string, value: any, ttl?: number) => {
        getMemoryCache().set(key, value, ttl || 3600);
        return 'OK';
      },
      setex: (key: string, ttl: number, value: string) => {
        getMemoryCache().set(key, value, ttl);
        return 'OK';
      },
      del: (key: string) => getMemoryCache().del(key),
      incr: (key: string) => {
        const cache = getMemoryCache();
        const current = (cache.get(key) as number) || 0;
        cache.set(key, current + 1);
        return current + 1;
      },
      incrby: (key: string, value: number) => {
        const cache = getMemoryCache();
        const current = (cache.get(key) as number) || 0;
        cache.set(key, current + value);
        return current + value;
      },
      expire: (key: string, ttl: number) => {
        const cache = getMemoryCache();
        const value = cache.get(key);
        if (value) {
          cache.set(key, value, ttl);
          return 1;
        }
        return 0;
      },
      ttl: (key: string) => {
        const cache = getMemoryCache();
        return cache.has(key) ? 3600 : -1;
      },
      exists: (key: string) => (getMemoryCache().has(key) ? 1 : 0),
      ping: () => 'PONG (memory)',
      publish: () => 0,
      duplicate: () => getCacheClient(),
      subscribe: () => Promise.resolve(),
      quit: () => Promise.resolve(),
    };
  }

  return redisClient;
}

export async function getRedisService() {
  return await getCacheClient();
}

export async function closeCache(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[Cache] Redis connection closed');
    } catch (error) {
      console.warn('[Cache] Error closing Redis:', error);
    }
  }
  if (memoryCache) {
    memoryCache.flushAll();
    console.log('[Cache] In-memory cache cleared');
  }
}
