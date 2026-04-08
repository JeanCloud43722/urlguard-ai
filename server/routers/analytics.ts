/**
 * Analytics Router
 * Redirect pattern analytics and dashboard data
 */

import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { redirectChains, redirectHops, urlChecks } from '../../drizzle/schema';
import { desc, count, sql, and, gte, eq } from 'drizzle-orm';
import { z } from 'zod';

export const analyticsRouter = router({
  // Top suspicious redirect patterns
  getTopSuspiciousPatterns: protectedProcedure
    .input(z.object({ days: z.number().default(7), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      try {
        const results = await db
          .select({
            originalDomain: sql<string>`SUBSTRING_INDEX(${redirectChains.originalUrl}, '/', 3)`,
            finalDomain: sql<string>`SUBSTRING_INDEX(${redirectChains.finalUrl}, '/', 3)`,
            count: count(),
            avgRedirectCount: sql<number>`AVG(${redirectChains.redirectCount})`,
          })
          .from(redirectChains)
          .where(
            and(
              eq(redirectChains.isMalicious, 1),
              gte(redirectChains.detectedAt, cutoffDate)
            )
          )
          .groupBy(
            sql`SUBSTRING_INDEX(${redirectChains.originalUrl}, '/', 3), SUBSTRING_INDEX(${redirectChains.finalUrl}, '/', 3)`
          )
          .orderBy(desc(count()))
          .limit(input.limit);

        return results;
      } catch (error) {
        console.error('[Analytics] Failed to get suspicious patterns:', error);
        return [];
      }
    }),

  // Top redirect sources
  getTopRedirectSources: protectedProcedure
    .input(z.object({ days: z.number().default(7), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      try {
        const results = await db
          .select({
            sourceDomain: sql<string>`SUBSTRING_INDEX(${redirectChains.originalUrl}, '/', 3)`,
            totalRedirects: count(),
            uniqueTargets: sql<number>`COUNT(DISTINCT ${redirectChains.finalUrl})`,
          })
          .from(redirectChains)
          .where(gte(redirectChains.detectedAt, cutoffDate))
          .groupBy(sql`SUBSTRING_INDEX(${redirectChains.originalUrl}, '/', 3)`)
          .orderBy(desc(count()))
          .limit(input.limit);

        return results;
      } catch (error) {
        console.error('[Analytics] Failed to get redirect sources:', error);
        return [];
      }
    }),

  // Redirect chain length distribution
  getChainLengthDistribution: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    try {
      const results = await db
        .select({
          redirectCount: redirectChains.redirectCount,
          count: count(),
        })
        .from(redirectChains)
        .groupBy(redirectChains.redirectCount)
        .orderBy(redirectChains.redirectCount);

      return results;
    } catch (error) {
      console.error('[Analytics] Failed to get chain distribution:', error);
      return [];
    }
  }),

  // Recent suspicious redirects
  getRecentSuspiciousRedirects: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const results = await db
          .select({
            id: redirectChains.id,
            originalUrl: redirectChains.originalUrl,
            finalUrl: redirectChains.finalUrl,
            redirectCount: redirectChains.redirectCount,
            detectedAt: redirectChains.detectedAt,
            isMalicious: redirectChains.isMalicious,
          })
          .from(redirectChains)
          .where(eq(redirectChains.isMalicious, 1))
          .orderBy(desc(redirectChains.detectedAt))
          .limit(input.limit);

        return results;
      } catch (error) {
        console.error('[Analytics] Failed to get recent suspicious redirects:', error);
        return [];
      }
    }),

  // Redirect statistics summary
  getRedirectStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      return {
        totalRedirects: 0,
        suspiciousRedirects: 0,
        avgHopsPerChain: 0,
        topSourceDomain: '',
      };

    try {
      const totalResult = await db
        .select({ count: count() })
        .from(redirectChains);

      const suspiciousResult = await db
        .select({ count: count() })
        .from(redirectChains)
        .where(eq(redirectChains.isMalicious, 1));

      const avgResult = await db
        .select({ avg: sql<number>`AVG(${redirectChains.redirectCount})` })
        .from(redirectChains);

      const topSourceResult = await db
        .select({
          sourceDomain: sql<string>`SUBSTRING_INDEX(${redirectChains.originalUrl}, '/', 3)`,
          count: count(),
        })
        .from(redirectChains)
        .groupBy(sql`SUBSTRING_INDEX(${redirectChains.originalUrl}, '/', 3)`)
        .orderBy(desc(count()))
        .limit(1);

      return {
        totalRedirects: totalResult[0]?.count || 0,
        suspiciousRedirects: suspiciousResult[0]?.count || 0,
        avgHopsPerChain: avgResult[0]?.avg || 0,
        topSourceDomain: topSourceResult[0]?.sourceDomain || 'N/A',
      };
    } catch (error) {
      console.error('[Analytics] Failed to get stats:', error);
      return {
        totalRedirects: 0,
        suspiciousRedirects: 0,
        avgHopsPerChain: 0,
        topSourceDomain: '',
      };
    }
  }),
});
