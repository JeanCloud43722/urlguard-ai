import { createHash } from "crypto";

export interface CacheConfig {
  ttlExactUrl: number; // 24 hours in seconds
  ttlSimilarUrl: number; // 1 hour in seconds
  maxTokensPerRequest: number;
  maxConcurrentRequests: number;
}

export interface CachedResult {
  data: any;
  tokensUsed: number;
  timestamp: number;
  ttl: number;
}

/**
 * In-memory LLM cache with token budget management
 * In production, replace with Redis
 */
export class LLMCache {
  private cache: Map<string, CachedResult> = new Map();
  private config: CacheConfig;
  private userTokenBudget: Map<string, number> = new Map();
  private userConcurrentRequests: Map<string, number> = new Map();

  constructor(config: CacheConfig = {
    ttlExactUrl: 86400, // 24 hours
    ttlSimilarUrl: 3600, // 1 hour
    maxTokensPerRequest: 500,
    maxConcurrentRequests: 5,
  }) {
    this.config = config;
    this.startCleanupInterval();
  }

  /**
   * Generate cache key from URL
   */
  private generateCacheKey(url: string): string {
    return createHash("sha256").update(url).digest("hex");
  }

  /**
   * Get cached result for exact URL
   */
  get(url: string): any | null {
    const key = this.generateCacheKey(url);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache value with TTL
   */
  set(url: string, data: any, tokensUsed: number, ttl: number = this.config.ttlExactUrl): void {
    const key = this.generateCacheKey(url);
    this.cache.set(key, {
      data,
      tokensUsed,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Check token budget for user
   */
  checkTokenBudget(userId: number, tokensRequired: number): boolean {
    const remaining = this.userTokenBudget.get(`user_${userId}`) || this.config.maxTokensPerRequest;
    return tokensRequired <= remaining;
  }

  /**
   * Deduct tokens from user budget
   */
  deductTokens(userId: number, tokensUsed: number): void {
    const key = `user_${userId}`;
    const remaining = this.userTokenBudget.get(key) || this.config.maxTokensPerRequest;
    this.userTokenBudget.set(key, Math.max(0, remaining - tokensUsed));
  }

  /**
   * Reset user token budget (typically once per hour/day)
   */
  resetUserBudget(userId: number): void {
    this.userTokenBudget.set(`user_${userId}`, this.config.maxTokensPerRequest);
  }

  /**
   * Check concurrent request limit
   */
  canMakeRequest(userId: number): boolean {
    const key = `concurrent_${userId}`;
    const current = this.userConcurrentRequests.get(key) || 0;
    return current < this.config.maxConcurrentRequests;
  }

  /**
   * Increment concurrent request counter
   */
  incrementConcurrent(userId: number): void {
    const key = `concurrent_${userId}`;
    const current = this.userConcurrentRequests.get(key) || 0;
    this.userConcurrentRequests.set(key, current + 1);
  }

  /**
   * Decrement concurrent request counter
   */
  decrementConcurrent(userId: number): void {
    const key = `concurrent_${userId}`;
    const current = this.userConcurrentRequests.get(key) || 0;
    this.userConcurrentRequests.set(key, Math.max(0, current - 1));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      totalCacheEntries: this.cache.size,
      userBudgets: Array.from(this.userTokenBudget.entries()).map(([key, value]) => ({
        user: key,
        remainingTokens: value,
      })),
    };
  }

  /**
   * Clear expired cache entries periodically
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      let removed = 0;

      this.cache.forEach((cached, key) => {
        const age = (now - cached.timestamp) / 1000;
        if (age > cached.ttl) {
          this.cache.delete(key);
          removed++;
        }
      });

      if (removed > 0) {
        console.log(`[LLMCache] Cleaned up ${removed} expired entries`);
      }
    }, 300000); // Run every 5 minutes
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
let cacheInstance: LLMCache | null = null;

export function getCache(): LLMCache {
  if (!cacheInstance) {
    cacheInstance = new LLMCache();
  }
  return cacheInstance;
}
