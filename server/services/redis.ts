/**
 * Redis Client & Caching Service
 * Handles all Redis operations: analysis caching, certificate caching, rate limiting
 */

import Redis from 'ioredis';
import { ENV } from '../_core/env';

export interface CacheConfig {
  analysisExactTTL: number; // 24h for exact URL matches
  analysisSimilarTTL: number; // 1h for similar domains
  certificateTTL: number; // 1h for SSL certificates
  indicatorsTTL: number; // 5min for heuristic indicators
}

const DEFAULT_CONFIG: CacheConfig = {
  analysisExactTTL: 24 * 60 * 60, // 24 hours
  analysisSimilarTTL: 60 * 60, // 1 hour
  certificateTTL: 60 * 60, // 1 hour
  indicatorsTTL: 5 * 60, // 5 minutes
};

class RedisService {
  private client: Redis;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      enableReadyCheck: false,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
    });

    this.client.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }

  /**
   * Get analysis result from cache
   * Key format: analysis:{url_hash}:v1
   */
  async getAnalysisCache(urlHash: string): Promise<any | null> {
    try {
      const key = `analysis:${urlHash}:v1`;
      const cached = await this.client.get(key);
      if (cached) {
        console.log(`[Redis Cache] HIT: ${key}`);
        return JSON.parse(cached);
      }
      console.log(`[Redis Cache] MISS: ${key}`);
      return null;
    } catch (error) {
      console.warn('[Redis] getAnalysisCache error:', error);
      return null;
    }
  }

  /**
   * Set analysis result in cache
   */
  async setAnalysisCache(urlHash: string, data: any, ttl: number = this.config.analysisExactTTL): Promise<void> {
    try {
      const key = `analysis:${urlHash}:v1`;
      await this.client.setex(key, ttl, JSON.stringify(data));
      console.log(`[Redis Cache] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.warn('[Redis] setAnalysisCache error:', error);
    }
  }

  /**
   * Get certificate info from cache
   * Key format: cert:{hostname}
   */
  async getCertificateCache(hostname: string): Promise<any | null> {
    try {
      const key = `cert:${hostname}`;
      const cached = await this.client.get(key);
      if (cached) {
        console.log(`[Redis Cache] HIT: ${key}`);
        return JSON.parse(cached);
      }
      console.log(`[Redis Cache] MISS: ${key}`);
      return null;
    } catch (error) {
      console.warn('[Redis] getCertificateCache error:', error);
      return null;
    }
  }

  /**
   * Set certificate info in cache
   */
  async setCertificateCache(hostname: string, data: any, ttl: number = this.config.certificateTTL): Promise<void> {
    try {
      const key = `cert:${hostname}`;
      await this.client.setex(key, ttl, JSON.stringify(data));
      console.log(`[Redis Cache] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.warn('[Redis] setCertificateCache error:', error);
    }
  }

  /**
   * Rate limiting: increment counter for user
   * Key format: ratelimit:{userId}:{endpoint}
   */
  async incrementRateLimit(userId: string, endpoint: string, limit: number, windowSeconds: number): Promise<{ count: number; remaining: number; resetAt: number }> {
    try {
      const key = `ratelimit:${userId}:${endpoint}`;
      const count = await this.client.incr(key);
      
      if (count === 1) {
        await this.client.expire(key, windowSeconds);
      }

      const ttl = await this.client.ttl(key);
      const resetAt = Date.now() + ttl * 1000;

      return {
        count,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch (error) {
      console.warn('[Redis] incrementRateLimit error:', error);
      return { count: 0, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
    }
  }

  /**
   * Semaphore: acquire slot for concurrent operation
   * Key format: semaphore:{resource}:{slot}
   */
  async acquireSemaphore(resource: string, maxConcurrent: number, timeoutSeconds: number = 30): Promise<string | null> {
    try {
      for (let i = 0; i < maxConcurrent; i++) {
        const key = `semaphore:${resource}:${i}`;
        const acquired = await this.client.set(key, Date.now().toString(), 'EX', timeoutSeconds, 'NX');
        if (acquired) {
          console.log(`[Redis Semaphore] ACQUIRED: ${key}`);
          return key;
        }
      }
      console.log(`[Redis Semaphore] FAILED: all ${maxConcurrent} slots busy for ${resource}`);
      return null;
    } catch (error) {
      console.warn('[Redis] acquireSemaphore error:', error);
      return null;
    }
  }

  /**
   * Release semaphore slot
   */
  async releaseSemaphore(key: string): Promise<void> {
    try {
      await this.client.del(key);
      console.log(`[Redis Semaphore] RELEASED: ${key}`);
    } catch (error) {
      console.warn('[Redis] releaseSemaphore error:', error);
    }
  }

  /**
   * Get all active semaphore slots
   */
  async getActiveSemaphores(resource: string, maxConcurrent: number): Promise<number> {
    try {
      let active = 0;
      for (let i = 0; i < maxConcurrent; i++) {
        const key = `semaphore:${resource}:${i}`;
        const exists = await this.client.exists(key);
        if (exists) active++;
      }
      return active;
    } catch (error) {
      console.warn('[Redis] getActiveSemaphores error:', error);
      return 0;
    }
  }

  /**
   * Publish event to Redis Pub/Sub channel
   */
  async publish(channel: string, message: any): Promise<void> {
    try {
      await this.client.publish(channel, JSON.stringify(message));
      console.log(`[Redis Pub/Sub] PUBLISHED: ${channel}`);
    } catch (error) {
      console.warn('[Redis] publish error:', error);
    }
  }

  /**
   * Subscribe to Redis Pub/Sub channel
   */
  subscribe(channel: string, callback: (message: any) => void): () => void {
    const subscriber = this.client.duplicate();
    
    subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch (error) {
          console.warn('[Redis Pub/Sub] Parse error:', error);
        }
      }
    });

    subscriber.subscribe(channel, (err: any) => {
      if (err) {
        console.error(`[Redis Pub/Sub] Subscribe error on ${channel}:`, err);
      } else {
        console.log(`[Redis Pub/Sub] SUBSCRIBED: ${channel}`);
      }
    });

    // Return unsubscribe function
    return () => {
      subscriber.unsubscribe(channel);
      subscriber.disconnect();
    };
  }

  /**
   * Increment metric counter
   */
  async incrementMetric(metric: string, value: number = 1): Promise<void> {
    try {
      const key = `metric:${metric}`;
      await this.client.incrby(key, value);
      // Set expiry to 24h for metrics
      await this.client.expire(key, 24 * 60 * 60);
    } catch (error) {
      console.warn('[Redis] incrementMetric error:', error);
    }
  }

  /**
   * Get metric value
   */
  async getMetric(metric: string): Promise<number> {
    try {
      const key = `metric:${metric}`;
      const value = await this.client.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      console.warn('[Redis] getMetric error:', error);
      return 0;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('[Redis] Health check failed:', error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.client.quit();
    console.log('[Redis] Disconnected');
  }
}

// Singleton instance
let redisService: RedisService | null = null;

export function getRedisService(): RedisService {
  if (!redisService) {
    redisService = new RedisService();
  }
  return redisService;
}

export default RedisService;
