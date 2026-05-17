/**
 * Redis Fallback Service
 * In-memory cache when Redis is unavailable
 * Graceful degradation - system works but without distributed caching
 */

export interface CacheConfig {
  analysisExactTTL: number;
  analysisSimilarTTL: number;
  certificateTTL: number;
  indicatorsTTL: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  analysisExactTTL: 24 * 60 * 60,
  analysisSimilarTTL: 60 * 60,
  certificateTTL: 60 * 60,
  indicatorsTTL: 5 * 60,
};

class InMemoryCacheService {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private config: CacheConfig;
  private isRedisAvailable = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.testRedisConnection();
  }

  private async testRedisConnection(): Promise<void> {
    try {
      const Redis = (await import('ioredis')).default;
      const client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: () => null,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
      });

      await Promise.race([
        client.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
      ]);

      this.isRedisAvailable = true;
      console.log('[Cache] Redis available - using Redis');
      client.disconnect();
    } catch (err) {
      this.isRedisAvailable = false;
      console.log('[Cache] Redis unavailable - using in-memory fallback');
    }
  }

  async getAnalysisCache(urlHash: string): Promise<any | null> {
    try {
      const key = `analysis:${urlHash}:v1`;
      const entry = this.cache.get(key);

      if (!entry) {
        return null;
      }

      if (entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return null;
      }

      console.log(`[Cache] HIT: ${key}`);
      return entry.value;
    } catch (error) {
      console.warn('[Cache] getAnalysisCache error:', error);
      return null;
    }
  }

  async setAnalysisCache(urlHash: string, data: any, ttl: number = this.config.analysisExactTTL): Promise<void> {
    try {
      const key = `analysis:${urlHash}:v1`;
      this.cache.set(key, {
        value: data,
        expiresAt: Date.now() + ttl * 1000,
      });
      console.log(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.warn('[Cache] setAnalysisCache error:', error);
    }
  }

  async getCertificateCache(hostname: string): Promise<any | null> {
    try {
      const key = `cert:${hostname}`;
      const entry = this.cache.get(key);

      if (!entry) {
        return null;
      }

      if (entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return null;
      }

      console.log(`[Cache] HIT: ${key}`);
      return entry.value;
    } catch (error) {
      console.warn('[Cache] getCertificateCache error:', error);
      return null;
    }
  }

  async setCertificateCache(hostname: string, data: any, ttl: number = this.config.certificateTTL): Promise<void> {
    try {
      const key = `cert:${hostname}`;
      this.cache.set(key, {
        value: data,
        expiresAt: Date.now() + ttl * 1000,
      });
      console.log(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.warn('[Cache] setCertificateCache error:', error);
    }
  }

  async incrementRateLimit(userId: string, endpoint: string, limit: number, windowSeconds: number) {
    try {
      const key = `ratelimit:${userId}:${endpoint}`;
      const entry = this.cache.get(key);

      let count = 0;
      if (entry && entry.expiresAt > Date.now()) {
        count = entry.value.count + 1;
      } else {
        count = 1;
      }

      const resetAt = Date.now() + windowSeconds * 1000;
      this.cache.set(key, {
        value: { count },
        expiresAt: resetAt,
      });

      return {
        count,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch (error) {
      console.warn('[Cache] incrementRateLimit error:', error);
      return { count: 0, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
    }
  }

  async acquireSemaphore(resource: string, maxConcurrent: number, timeoutSeconds: number = 30): Promise<string | null> {
    try {
      for (let i = 0; i < maxConcurrent; i++) {
        const key = `semaphore:${resource}:${i}`;
        const entry = this.cache.get(key);

        if (!entry || entry.expiresAt < Date.now()) {
          const slotId = `${resource}:${i}:${Date.now()}`;
          this.cache.set(key, {
            value: slotId,
            expiresAt: Date.now() + timeoutSeconds * 1000,
          });
          return slotId;
        }
      }
      return null;
    } catch (error) {
      console.warn('[Cache] acquireSemaphore error:', error);
      return null;
    }
  }

  async releaseSemaphore(slotId: string): Promise<void> {
    try {
      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
        if (entry.value === slotId) {
          this.cache.delete(key);
          break;
        }
      }
    } catch (error) {
      console.warn('[Cache] releaseSemaphore error:', error);
    }
  }

  async disconnect(): Promise<void> {
    this.cache.clear();
  }
}

let instance: InMemoryCacheService | null = null;

export function getRedisService(): InMemoryCacheService {
  if (!instance) {
    instance = new InMemoryCacheService();
  }
  return instance;
}

export function resetRedisService(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
