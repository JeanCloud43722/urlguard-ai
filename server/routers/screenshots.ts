/**
 * tRPC Router for Screenshot Operations
 * Handles screenshot job management and status tracking
 */

import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { getScreenshotJobProcessor } from '../queues/screenshotJob';
import { TRPCError } from '@trpc/server';

export const screenshotRouter = router({
  /**
   * Get screenshot job status
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      try {
        const processor = await getScreenshotJobProcessor();
        const status = await processor.getJobStatus(input.jobId);

        if (!status) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Screenshot job not found',
          });
        }

        return status;
      } catch (error) {
        console.error('[tRPC] Error getting screenshot job status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get screenshot job status',
        });
      }
    }),

  /**
   * Get queue statistics
   */
  getQueueStats: publicProcedure.query(async () => {
    try {
      const processor = await getScreenshotJobProcessor();
      return await processor.getQueueStats();
    } catch (error) {
      console.error('[tRPC] Error getting queue stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get queue statistics',
      });
    }
  }),

  /**
   * Get processor status
   */
  getProcessorStatus: publicProcedure.query(async () => {
    try {
      const processor = await getScreenshotJobProcessor();
      const stats = await processor.getQueueStats();

      return {
        isHealthy: true,
        queueStats: stats,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[tRPC] Error getting processor status:', error);
      return {
        isHealthy: false,
        queueStats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
        timestamp: Date.now(),
      };
    }
  }),
});

export type ScreenshotRouter = typeof screenshotRouter;
