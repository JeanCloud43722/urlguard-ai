/**
 * tRPC Router for Analysis Operations
 * Handles fingerprint and cluster retrieval
 */

import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { browserFingerprints, phishingClusters, clusterMemberships, urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const analysisRouter = router({
  /**
   * Get browser fingerprint for a URL check
   */
  getFingerprint: publicProcedure
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

        const fingerprint = await db
          .select()
          .from(browserFingerprints)
          .where(eq(browserFingerprints.checkId, input.checkId))
          .limit(1);

        if (!fingerprint.length) {
          return null;
        }

        const fp = fingerprint[0];
        return {
          id: fp.id,
          checkId: fp.checkId,
          userAgent: fp.userAgent,
          platform: fp.platform,
          languages: fp.languages ? JSON.parse(fp.languages) : [],
          webGLVendor: fp.webGLVendor,
          webGLRenderer: fp.webGLRenderer,
          canvasFingerprint: fp.canvasFingerprint,
          screenResolution: fp.screenResolution,
          timezone: fp.timezone,
          plugins: fp.plugins ? JSON.parse(fp.plugins) : [],
          isBotLikely: fp.isBotLikely === 1,
          botIndicators: fp.botIndicators ? JSON.parse(fp.botIndicators) : [],
          createdAt: fp.createdAt,
        };
      } catch (error) {
        console.error('[tRPC] Error getting fingerprint:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get fingerprint',
        });
      }
    }),

  /**
   * Get cluster information for a URL check
   */
  getCluster: publicProcedure
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

        // Get cluster membership
        const membership = await db
          .select()
          .from(clusterMemberships)
          .where(eq(clusterMemberships.checkId, input.checkId))
          .limit(1);

        if (!membership.length) {
          return null;
        }

        // Get cluster details
        const cluster = await db
          .select()
          .from(phishingClusters)
          .where(eq(phishingClusters.id, membership[0].clusterId))
          .limit(1);

        if (!cluster.length) {
          return null;
        }

        const c = cluster[0];
        return {
          id: c.id,
          clusterId: c.clusterId,
          clusterName: c.clusterName,
          domStructureHash: c.domStructureHash,
          formCount: c.formCount,
          inputTypes: c.inputTypes ? JSON.parse(c.inputTypes) : [],
          externalScripts: c.externalScripts ? JSON.parse(c.externalScripts) : [],
          cssClassPatterns: c.cssClassPatterns ? JSON.parse(c.cssClassPatterns) : [],
          similarity: c.similarity,
          memberCount: c.memberCount,
          similarityToThisUrl: membership[0].similarityScore,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      } catch (error) {
        console.error('[tRPC] Error getting cluster:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get cluster',
        });
      }
    }),

  /**
   * Get all URLs in a cluster
   */
  getClusterMembers: publicProcedure
    .input(z.object({ clusterId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const members = await db
          .select({
            checkId: clusterMemberships.checkId,
            url: urlChecks.url,
            riskLevel: urlChecks.riskLevel,
            riskScore: urlChecks.riskScore,
            similarityScore: clusterMemberships.similarityScore,
            addedAt: clusterMemberships.addedAt,
          })
          .from(clusterMemberships)
          .innerJoin(urlChecks, eq(clusterMemberships.checkId, urlChecks.id))
          .where(eq(clusterMemberships.clusterId, input.clusterId))
          .limit(100);

        return members;
      } catch (error) {
        console.error('[tRPC] Error getting cluster members:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get cluster members',
        });
      }
    }),

  /**
   * Get bot detection status
   */
  getBotDetectionStatus: publicProcedure
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

        const fingerprint = await db
          .select({
            isBotLikely: browserFingerprints.isBotLikely,
            botIndicators: browserFingerprints.botIndicators,
          })
          .from(browserFingerprints)
          .where(eq(browserFingerprints.checkId, input.checkId))
          .limit(1);

        if (!fingerprint.length) {
          return null;
        }

        return {
          isBotLikely: fingerprint[0].isBotLikely === 1,
          botIndicators: fingerprint[0].botIndicators ? JSON.parse(fingerprint[0].botIndicators) : [],
        };
      } catch (error) {
        console.error('[tRPC] Error getting bot detection status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get bot detection status',
        });
      }
    }),

  /**
   * Get campaign statistics
   */
  getCampaignStats: publicProcedure
    .input(z.object({ clusterId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }

        const cluster = await db
          .select()
          .from(phishingClusters)
          .where(eq(phishingClusters.id, input.clusterId))
          .limit(1);

        if (!cluster.length) {
          return null;
        }

        const members = await db
          .select({
            riskLevel: urlChecks.riskLevel,
          })
          .from(clusterMemberships)
          .innerJoin(urlChecks, eq(clusterMemberships.checkId, urlChecks.id))
          .where(eq(clusterMemberships.clusterId, input.clusterId));

        const stats = {
          totalMembers: members.length,
          dangerousCount: members.filter((m) => m.riskLevel === 'dangerous').length,
          suspiciousCount: members.filter((m) => m.riskLevel === 'suspicious').length,
          safeCount: members.filter((m) => m.riskLevel === 'safe').length,
          dangerousPercentage:
            members.length > 0
              ? Math.round(
                  (members.filter((m) => m.riskLevel === 'dangerous').length / members.length) * 100
                )
              : 0,
        };

        return {
          clusterId: cluster[0].clusterId,
          clusterName: cluster[0].clusterName,
          ...stats,
        };
      } catch (error) {
        console.error('[tRPC] Error getting campaign stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get campaign stats',
        });
      }
    }),
});

export type AnalysisRouter = typeof analysisRouter;
