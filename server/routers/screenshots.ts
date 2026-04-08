/**
 * tRPC Router for Screenshot Operations
 * Handles screenshot job management and status tracking
 */

import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { getScreenshotJobProcessor } from '../queues/screenshotJob';
import { getDb } from '../db';
import { urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
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

  /**
   * Get OCR extracted text
   */
  getOCR: publicProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const result = await db
          .select({ ocrText: urlChecks.ocrExtractedText, ocrProcessedAt: urlChecks.ocrProcessedAt })
          .from(urlChecks)
          .where(eq(urlChecks.id, input.checkId))
          .limit(1);

        return result[0] || null;
      } catch (error) {
        console.error('[tRPC] Error getting OCR data:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get OCR data',
        });
      }
    }),

  /**
   * Get structured metadata
   */
  getStructuredMetadata: publicProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const result = await db
          .select({ metadata: urlChecks.structuredMetadata, processedAt: urlChecks.metadataProcessedAt })
          .from(urlChecks)
          .where(eq(urlChecks.id, input.checkId))
          .limit(1);

        if (result[0]?.metadata) {
          return {
            metadata: JSON.parse(result[0].metadata),
            processedAt: result[0].processedAt,
          };
        }
        return null;
      } catch (error) {
        console.error('[tRPC] Error getting structured metadata:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get structured metadata',
        });
      }
    }),

  /**
   * Get XML data (sitemap/RSS)
   */
  getXmlData: publicProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const result = await db
          .select({ xmlData: urlChecks.xmlData, processedAt: urlChecks.xmlProcessedAt })
          .from(urlChecks)
          .where(eq(urlChecks.id, input.checkId))
          .limit(1);

        if (result[0]?.xmlData) {
          return {
            xmlData: JSON.parse(result[0].xmlData),
            processedAt: result[0].processedAt,
          };
        }
        return null;
      } catch (error) {
        console.error('[tRPC] Error getting XML data:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get XML data',
        });
      }
    }),

  /**
   * Get deepfake risk analysis
   */
  getDeepfakeRisk: publicProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const result = await db
          .select({
            deepfakeRisk: urlChecks.deepfakeRisk,
            hasCameraRequest: urlChecks.hasCameraRequest,
            hasMicrophoneRequest: urlChecks.hasMicrophoneRequest,
          })
          .from(urlChecks)
          .where(eq(urlChecks.id, input.checkId))
          .limit(1);

        if (!result.length) {
          return null;
        }

        const data = result[0];
        return {
          deepfakeRisk: data.deepfakeRisk ? JSON.parse(data.deepfakeRisk) : null,
          hasCameraRequest: data.hasCameraRequest === 1,
          hasMicrophoneRequest: data.hasMicrophoneRequest === 1,
        };
      } catch (error) {
        console.error('[tRPC] Error getting deepfake risk:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get deepfake risk',
        });
      }
    }),
});

export type ScreenshotRouter = typeof screenshotRouter;
