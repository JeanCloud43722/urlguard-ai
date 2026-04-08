/**
 * System Router
 * Admin-only procedures for system management (webhooks, settings, etc.)
 */

import { z } from 'zod';
import { protectedProcedure, router, adminProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { webhooks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const systemRouter = router({
  /**
   * Register a new webhook endpoint
   */
  registerWebhook: adminProcedure
    .input(
      z.object({
        url: z.string().url(),
        eventType: z.enum(['campaign_detected', 'dangerous_url_detected']),
        threshold: z.number().int().min(1).default(5),
        secret: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const result = await db.insert(webhooks).values({
          url: input.url,
          eventType: input.eventType,
          threshold: input.threshold,
          secret: input.secret,
          isActive: 1,
        });

        console.log(`[System] Webhook registered: ${input.url} for ${input.eventType}`);

        return {
          success: true,
          id: (result as any).insertId,
        };
      } catch (error) {
        console.error('[System] Error registering webhook:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to register webhook',
        });
      }
    }),

  /**
   * List all webhooks
   */
  listWebhooks: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection failed',
        });
      }

      const allWebhooks = await db.select().from(webhooks);
      return allWebhooks.map((w) => ({
        id: w.id,
        url: w.url,
        eventType: w.eventType,
        threshold: w.threshold,
        isActive: w.isActive === 1,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
    } catch (error) {
      console.error('[System] Error listing webhooks:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to list webhooks',
      });
    }
  }),

  /**
   * Delete a webhook
   */
  deleteWebhook: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        await db.delete(webhooks).where(eq(webhooks.id, input.id));

        console.log(`[System] Webhook deleted: ${input.id}`);

        return { success: true };
      } catch (error) {
        console.error('[System] Error deleting webhook:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete webhook',
        });
      }
    }),

  /**
   * Toggle webhook active status
   */
  toggleWebhook: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        await db
          .update(webhooks)
          .set({ isActive: input.isActive ? 1 : 0 })
          .where(eq(webhooks.id, input.id));

        console.log(`[System] Webhook ${input.id} toggled to ${input.isActive ? 'active' : 'inactive'}`);

        return { success: true };
      } catch (error) {
        console.error('[System] Error toggling webhook:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to toggle webhook',
        });
      }
    }),
});

export type SystemRouter = typeof systemRouter;
