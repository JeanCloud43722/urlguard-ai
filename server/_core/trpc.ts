import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

/**
 * In-memory concurrency limiter for DeepSeek API calls
 * Limits to 5 concurrent requests per user
 */
class DeepSeekConcurrencyLimiter {
  private activeRequests = new Map<number, number>();
  private waitingQueues = new Map<number, Array<() => void>>();
  private readonly maxConcurrent = 5;

  async acquire(userId: number): Promise<void> {
    const current = this.activeRequests.get(userId) || 0;
    
    if (current >= this.maxConcurrent) {
      // Wait for a slot to become available
      await new Promise<void>((resolve) => {
        if (!this.waitingQueues.has(userId)) {
          this.waitingQueues.set(userId, []);
        }
        this.waitingQueues.get(userId)!.push(resolve);
      });
    }

    this.activeRequests.set(userId, (this.activeRequests.get(userId) || 0) + 1);
  }

  release(userId: number): void {
    const current = this.activeRequests.get(userId) || 0;
    if (current > 0) {
      this.activeRequests.set(userId, current - 1);
    }

    // Process waiting requests
    const queue = this.waitingQueues.get(userId);
    if (queue && queue.length > 0) {
      const resolve = queue.shift();
      if (resolve) {
        resolve();
      }
    }
  }

  getActive(userId: number): number {
    return this.activeRequests.get(userId) || 0;
  }
}

const deepseekLimiter = new DeepSeekConcurrencyLimiter();

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Concurrency limiting middleware for DeepSeek calls
const deepseekConcurrencyMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  
  if (!ctx.user) {
    return next();
  }

  await deepseekLimiter.acquire(ctx.user.id);
  try {
    return await next();
  } finally {
    deepseekLimiter.release(ctx.user.id);
  }
});

export const protectedProcedure = t.procedure.use(requireUser);
export const protectedProcedureWithConcurrency = t.procedure.use(requireUser).use(deepseekConcurrencyMiddleware);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export { deepseekLimiter };
