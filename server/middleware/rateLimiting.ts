/**
 * tRPC Rate Limiting Middleware
 * Implements per-user and per-endpoint rate limiting with Redis
 */

import { TRPCError } from '@trpc/server';
import { getRedisService } from '../services/redis';

export interface RateLimitConfig {
  unauthenticatedLimit: number; // requests per minute
  authenticatedLimit: number; // requests per minute
  windowSeconds: number; // time window in seconds
  deepseekConcurrentLimit: number; // max concurrent DeepSeek calls
}

const DEFAULT_CONFIG: RateLimitConfig = {
  unauthenticatedLimit: 10,
  authenticatedLimit: 100,
  windowSeconds: 60,
  deepseekConcurrentLimit: 5,
};

export class RateLimiter {
  private config: RateLimitConfig;
  private redisService = getRedisService();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check rate limit for user/endpoint
   */
  async checkRateLimit(userId: string | null, endpoint: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const limit = userId ? this.config.authenticatedLimit : this.config.unauthenticatedLimit;
    const identifier = userId || `anon:${endpoint}`;

    const result = await this.redisService.incrementRateLimit(
      identifier,
      endpoint,
      limit,
      this.config.windowSeconds
    );

    return {
      allowed: result.count <= limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
    };
  }

  /**
   * Check DeepSeek concurrency limit
   */
  async checkDeepSeekConcurrency(userId: number): Promise<{ allowed: boolean; slotKey: string | null }> {
    const slotKey = await this.redisService.acquireSemaphore(
      `deepseek:${userId}`,
      this.config.deepseekConcurrentLimit,
      30 // 30 second timeout
    );

    return {
      allowed: slotKey !== null,
      slotKey,
    };
  }

  /**
   * Release DeepSeek concurrency slot
   */
  async releaseDeepSeekConcurrency(slotKey: string): Promise<void> {
    await this.redisService.releaseSemaphore(slotKey);
  }

  /**
   * Get active DeepSeek calls for user
   */
  async getActiveCalls(userId: number): Promise<number> {
    return await this.redisService.getActiveSemaphores(
      `deepseek:${userId}`,
      this.config.deepseekConcurrentLimit
    );
  }
}

// Singleton instance
let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

/**
 * tRPC middleware for rate limiting
 */
export const rateLimitingMiddleware = (limiter: RateLimiter) => {
  return async ({ ctx, next, path }: any) => {
    const userId = ctx.user?.id?.toString() || null;
    const endpoint = path;

    // Check rate limit
    const rateLimitResult = await limiter.checkRateLimit(userId, endpoint);

    if (!rateLimitResult.allowed) {
      console.warn(`[RateLimit] Exceeded for ${userId || 'anon'} on ${endpoint}`);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Reset at ${new Date(rateLimitResult.resetAt).toISOString()}`,
      });
    }

    // Add rate limit info to context
    const contextWithRateLimit = {
      ...ctx,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      },
    };

    return next({ ctx: contextWithRateLimit });
  };
};

/**
 * Middleware for DeepSeek concurrency limiting
 */
export const deepseekConcurrencyMiddleware = (limiter: RateLimiter) => {
  return async ({ ctx, next }: any) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'DeepSeek analysis requires authentication',
      });
    }

    const concurrencyResult = await limiter.checkDeepSeekConcurrency(ctx.user.id);

    if (!concurrencyResult.allowed) {
      console.warn(`[DeepSeekConcurrency] Limit exceeded for user ${ctx.user.id}`);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many concurrent DeepSeek analyses. Please wait for current requests to complete.',
      });
    }

    // Add slot key to context for later release
    const contextWithSlot = {
      ...ctx,
      deepseekSlot: concurrencyResult.slotKey,
    };

    try {
      return await next({ ctx: contextWithSlot });
    } finally {
      // Release slot after request completes
      if (concurrencyResult.slotKey) {
        await limiter.releaseDeepSeekConcurrency(concurrencyResult.slotKey);
      }
    }
  };
};

export default RateLimiter;
