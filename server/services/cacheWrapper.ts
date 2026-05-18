// In-Memory Fallback Cache (no external dependencies)
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  memoryCache.forEach((entry, key) => {
    if (entry.expiresAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => memoryCache.delete(key));
}, 60000); // Every minute

interface CacheService {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttl?: number) => Promise<void>;
  ping: () => Promise<void>;
}

let cacheInstance: CacheService | null = null;

export async function getCache(): Promise<CacheService> {
  // Return cached instance if available
  if (cacheInstance) {
    return cacheInstance;
  }

  // Try to load Redis dynamically
  let redisModule: any = null;
  try {
    redisModule = await import("./redis");
    const redis = redisModule.getRedisService();
    
    // Test connection with ping
    await redis.ping();
    console.log("[Cache] ✅ Redis connected");
    
    cacheInstance = {
      get: (key: string) => redis.getAnalysisCache(key),
      set: (key: string, value: any, ttl?: number) =>
        redis.setAnalysisCache(key, value, ttl || 86400),
      ping: () => redis.ping(),
    };
    
    return cacheInstance;
  } catch (err) {
    console.warn(
      "[Cache] ⚠️ Redis not available, using In-Memory fallback:",
      (err as Error).message
    );
  }

  // Fallback to in-memory cache
  cacheInstance = {
    get: async (key: string) => {
      const entry = memoryCache.get(key);
      if (!entry) return null;
      
      const now = Date.now();
      if (entry.expiresAt < now) {
        memoryCache.delete(key);
        return null;
      }
      
      return entry.value;
    },
    
    set: async (key: string, value: any, ttl: number = 86400) => {
      const expiresAt = Date.now() + ttl * 1000;
      memoryCache.set(key, { value, expiresAt });
    },
    
    ping: async () => {
      // In-memory cache is always available
      return;
    },
  };

  return cacheInstance;
}
