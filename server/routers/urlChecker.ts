import z from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createURLCheck, getUserURLChecks, createBatchJob, getUserBatchJobs, createOCRAnalysis, getDb } from "../db";
import { getDeepSeekClient } from "../analyzers/deepseekEnhanced";
import { validateAndNormalizeURL, extractAffiliateInfo, checkPhishingIndicators } from "../analyzers/urlAnalyzer";
import { fetchCertificate, extractCertificateRisks } from "../utils/certificate";
import { nanoid } from "nanoid";
import { notifyOwner } from "../_core/notification";
import { generateJSONReport, generateCSVReport, generateHTMLReport } from "../utils/exportReport";
import { getScreenshotJobProcessor } from "../queues/screenshotJob";
import { queueOCRAnalysis } from "../jobs/ocrQueue";
import { getRedisService } from "../services/redis";
import { protectedProcedureWithConcurrency } from "../_core/trpc";
import crypto from "crypto";
import { TRPCError } from '@trpc/server';
import { detectRedirectChain } from "../services/redirectDetector";
import { redirectChains, redirectHops } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const urlCheckerRouter = router({
  checkURL: protectedProcedureWithConcurrency
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      try {
        // 1. Validate and normalize URL
        const validation = validateAndNormalizeURL(input.url);
        if (!validation.isValid) {
          throw new Error(validation.error || "Invalid URL");
        }

        // 1a. Detect redirect chain
        let redirectChain = null;
        let analyzedUrl = validation.normalizedUrl;
        try {
          redirectChain = await detectRedirectChain(validation.normalizedUrl, 5);
          analyzedUrl = redirectChain.finalUrl;
          console.log(`[Redirect] ${validation.normalizedUrl} -> ${redirectChain.redirectCount} hops -> ${analyzedUrl}`);
          if (redirectChain.isLikelyPhishing && redirectChain.redirectCount > 0) {
            console.warn(`[Redirect] Suspicious redirect chain detected for ${validation.normalizedUrl}`);
          }
        } catch (redirectError) {
          console.error(`[Redirect] Failed to detect redirects:`, redirectError);
        }

        // 1b. Check Redis cache
        const redis = getRedisService();
        const urlHash = crypto.createHash('sha256').update(validation.normalizedUrl).digest('hex');
        const cacheKey = `url:${urlHash}`;
        const cached = await redis.getAnalysisCache(urlHash);
        if (cached) {
          console.log(`[Cache] HIT for ${validation.normalizedUrl}`);
          return cached;
        }

        // 2. Extract affiliate info
        const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);

        // 3. Check for local phishing indicators
        const localIndicators = checkPhishingIndicators(validation.normalizedUrl);

        // 3b. Heuristic early-exit for obvious URLs
        const isObviouslySafe = localIndicators.length === 0 && 
          (validation.domain.endsWith('.com') || validation.domain.endsWith('.org') || validation.domain.endsWith('.edu')) &&
          !validation.domain.includes('login') && 
          !validation.domain.includes('verify') &&
          !validation.domain.includes('secure') &&
          !validation.domain.includes('confirm') &&
          !validation.domain.includes('update');

        const isObviouslyDangerous = localIndicators.some(i => 
          i.includes('IP address') || i.includes('.tk') || i.includes('.ml') || i.includes('.ga') || i.includes('.cf')
        );

        if (isObviouslySafe) {
          const result = {
            id: 0,
            url: input.url,
            normalizedUrl: validation.normalizedUrl,
            riskScore: 5,
            riskLevel: 'safe' as const,
            analysis: 'Heuristic analysis indicates safe URL (no suspicious indicators).',
            indicators: [],
            affiliateInfo,
            confidence: 0.9,
            certificateInfo: { isSelfSigned: false, hasRisks: false },
            ocrQueued: false,
            isPreliminary: false,
            createdAt: new Date(),
          };
          await redis.setAnalysisCache(urlHash, result, 86400);
          console.log(`[Cache] Stored (heuristic safe) ${validation.normalizedUrl}`);
          return result;
        }

        if (isObviouslyDangerous) {
          const result = {
            id: 0,
            url: input.url,
            normalizedUrl: validation.normalizedUrl,
            riskScore: 90,
            riskLevel: 'dangerous' as const,
            analysis: 'Obvious phishing indicators detected (IP address or known malicious TLD).',
            indicators: localIndicators,
            affiliateInfo,
            confidence: 0.95,
            certificateInfo: { isSelfSigned: false, hasRisks: false },
            ocrQueued: false,
            isPreliminary: false,
            createdAt: new Date(),
          };
          await redis.setAnalysisCache(urlHash, result, 86400);
          console.log(`[Cache] Stored (heuristic dangerous) ${validation.normalizedUrl}`);
          return result;
        }

        // 4. Fetch SSL certificate info (if HTTPS)
        let certificateInfo: any = {};
        const certificateRisks: string[] = [];
        if (validation.normalizedUrl.startsWith("https://")) {
          try {
            const hostname = new URL(validation.normalizedUrl).hostname;
            if (hostname) {
              certificateInfo = await fetchCertificate(hostname);
              certificateRisks.push(...extractCertificateRisks(certificateInfo));
            }
          } catch (err) {
            console.warn("[URLChecker] Could not fetch certificate:", err);
            certificateInfo = { error: "Failed to retrieve certificate" };
          }
        }

        // 5. Create preliminary result based on heuristics (immediate response <500ms)
        const preliminaryResult = {
          id: 0,
          url: input.url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: localIndicators.length > 0 ? 50 : 10,
          riskLevel: localIndicators.length > 0 ? ('suspicious' as const) : ('safe' as const),
          analysis: 'First analysis based on URL structure. Deeper analysis running in background...',
          indicators: localIndicators,
          affiliateInfo,
          confidence: 0.6,
          certificateInfo: { isSelfSigned: false, hasRisks: certificateRisks.length > 0 },
          ocrQueued: false,
          isPreliminary: true,
          createdAt: new Date(),
        };

        // 5a. Create database record with preliminary data
        const urlCheckRecord = await createURLCheck({
          userId: ctx.user.id,
          url: input.url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: preliminaryResult.riskScore,
          riskLevel: preliminaryResult.riskLevel,
          phishingReasons: JSON.stringify(localIndicators),
          deepseekAnalysis: JSON.stringify({}),
          affiliateInfo: JSON.stringify(affiliateInfo),
        });

        // 5b. Return preliminary result immediately
        const resultWithId = { ...preliminaryResult, id: urlCheckRecord.id };

        // 5c. Start DeepSeek analysis as background job (fire-and-forget)
        const performDeepSeekAnalysis = async () => {
          try {
            const deepseekClient = getDeepSeekClient();
            const deepseekAnalysis = await deepseekClient.analyzeWithFullContext(
              validation.normalizedUrl,
              certificateInfo,
              [...localIndicators, ...certificateRisks],
              affiliateInfo
            );

            // Update database with final analysis
            const db = await getDb();
            if (db) {
              const { urlChecks } = await import('../../drizzle/schema');
              const allReasons = [...localIndicators, ...certificateRisks, ...deepseekAnalysis.phishingIndicators];
              
              await db.update(urlChecks).set({
                riskScore: deepseekAnalysis.riskScore,
                riskLevel: deepseekAnalysis.riskLevel,
                phishingReasons: JSON.stringify(allReasons),
                deepseekAnalysis: JSON.stringify(deepseekAnalysis),
              }).where(eq(urlChecks.id, urlCheckRecord.id));

              console.log(`[Progressive] Updated check ${urlCheckRecord.id} with DeepSeek analysis`);

              // Save redirect chain if detected
              if (redirectChain && redirectChain.hops.length > 0) {
                try {
                  const [chainResult] = await db.insert(redirectChains).values({
                    originalUrl: validation.normalizedUrl,
                    finalUrl: redirectChain.finalUrl,
                    statusCode: redirectChain.statusCode,
                    redirectCount: redirectChain.redirectCount,
                    isMalicious: redirectChain.isLikelyPhishing ? 1 : 0,
                    detectedAt: new Date(),
                  });
                  
                  for (let i = 0; i < redirectChain.hops.length; i++) {
                    const hop = redirectChain.hops[i];
                    await db.insert(redirectHops).values({
                      chainId: (chainResult as any).insertId,
                      hopOrder: i,
                      fromUrl: hop.fromUrl,
                      toUrl: hop.toUrl,
                      statusCode: hop.statusCode,
                      responseTimeMs: hop.responseTimeMs,
                      detectedAt: new Date(),
                    });
                  }
                  console.log(`[Progressive] Saved redirect chain with ${redirectChain.hops.length} hops`);
                } catch (error) {
                  console.error('[Progressive] Failed to save redirect chain:', error);
                }
              }

              // Enqueue screenshot job if dangerous
              if (deepseekAnalysis.riskLevel === "dangerous") {
                try {
                  const processor = await getScreenshotJobProcessor();
                  await processor.enqueueScreenshot({
                    urlCheckId: urlCheckRecord.id,
                    userId: ctx.user.id,
                    url: validation.normalizedUrl,
                    riskLevel: deepseekAnalysis.riskLevel,
                    timestamp: Date.now(),
                  });
                  console.log(`[Progressive] Screenshot job enqueued for URL: ${validation.normalizedUrl}`);
                } catch (error) {
                  console.error("[Progressive] Failed to enqueue screenshot job:", error);
                }
              }

              // Enqueue OCR analysis if suspicious/dangerous
              if (deepseekAnalysis.riskLevel === "dangerous" || deepseekAnalysis.riskLevel === "suspicious") {
                try {
                  await queueOCRAnalysis({
                    checkId: urlCheckRecord.id,
                    userId: ctx.user.id,
                    screenshotBuffer: Buffer.from(''),
                    domain: new URL(validation.normalizedUrl).hostname || '',
                  });
                  console.log(`[Progressive] OCR analysis job queued for check ${urlCheckRecord.id}`);
                } catch (error) {
                  console.error("[Progressive] Failed to queue OCR analysis:", error);
                }
              }

              // Notify owner if dangerous
              if (deepseekAnalysis.riskLevel === "dangerous") {
                const certificateWarning = certificateRisks.length > 0 ? `\n\nCertificate Risks: ${certificateRisks.join(", ")}` : "";
                await notifyOwner({
                  title: "🚨 High-Risk Phishing URL Detected",
                  content: `User ${ctx.user.name} detected a dangerous URL: ${validation.normalizedUrl}\n\nRisk Score: ${deepseekAnalysis.riskScore}/100\nConfidence: ${Math.round(deepseekAnalysis.confidence * 100)}%\n\nAnalysis: ${deepseekAnalysis.analysis}${certificateWarning}\n\nIndicators: ${allReasons.join(", ")}`,
                });
              }

              // Cache final result
              const finalResult = {
                id: urlCheckRecord.id,
                url: input.url,
                normalizedUrl: validation.normalizedUrl,
                riskScore: deepseekAnalysis.riskScore,
                riskLevel: deepseekAnalysis.riskLevel,
                analysis: deepseekAnalysis.analysis,
                indicators: allReasons,
                affiliateInfo,
                confidence: deepseekAnalysis.confidence,
                certificateInfo: {
                  isSelfSigned: certificateInfo.subject && certificateInfo.issuer && JSON.stringify(certificateInfo.subject) === JSON.stringify(certificateInfo.issuer),
                  hasRisks: certificateRisks.length > 0,
                },
                ocrQueued: deepseekAnalysis.riskLevel === "dangerous" || deepseekAnalysis.riskLevel === "suspicious",
                isPreliminary: false,
                createdAt: new Date(),
              };
              await redis.setAnalysisCache(urlHash, finalResult, 86400);
              console.log(`[Progressive] Cached final result for ${validation.normalizedUrl}`);
            }
          } catch (error) {
            console.error('[Progressive] DeepSeek analysis failed:', error);
          }
        };

        // Start background analysis without awaiting
        performDeepSeekAnalysis().catch(err => console.error('[Progressive] Background analysis error:', err));

        // Return preliminary result immediately
        return resultWithId;
      } catch (error) {
        console.error("URL check error:", error);
        throw new Error(`Failed to analyze URL: ${(error as Error).message}`);
      }
    }),

  getCheckById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');
      
      const { urlChecks } = await import('../../drizzle/schema');
      const result = await db
        .select()
        .from(urlChecks)
        .where(eq(urlChecks.id, input.id))
        .limit(1);
      
      if (!result.length) return null;
      
      const check = result[0];
      return {
        id: check.id,
        url: check.url,
        normalizedUrl: check.normalizedUrl,
        riskScore: check.riskScore,
        riskLevel: check.riskLevel,
        analysis: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).analysis : 'Preliminary analysis - waiting for deep scan...',
        indicators: check.phishingReasons ? JSON.parse(check.phishingReasons) : [],
        affiliateInfo: check.affiliateInfo ? JSON.parse(check.affiliateInfo) : {},
        confidence: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).confidence : 0.6,
        certificateInfo: { isSelfSigned: false, hasRisks: false },
        ocrQueued: false,
        isPreliminary: !check.deepseekAnalysis || check.deepseekAnalysis === '{}' || check.deepseekAnalysis === 'null',
        createdAt: check.createdAt,
      };
    }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const checks = await getUserURLChecks(ctx.user.id, input.limit);
      return checks.map((check) => ({
        id: check.id,
        url: check.url,
        normalizedUrl: check.normalizedUrl,
        riskScore: check.riskScore,
        riskLevel: check.riskLevel,
        createdAt: check.createdAt,
        updatedAt: check.updatedAt,
        phishingReasons: JSON.parse(check.phishingReasons || "[]"),
        indicators: JSON.parse(check.phishingReasons || "[]"),
        deepseekAnalysis: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis) : null,
        affiliateInfo: check.affiliateInfo ? JSON.parse(check.affiliateInfo) : null,
        screenshotUrl: check.screenshotUrl,
        screenshotKey: check.screenshotKey,
      }));
    }),

  startBatchCheck: protectedProcedure
    .input(z.object({ urls: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      const jobId = nanoid();

      // Create batch job record
      await createBatchJob({
        userId: ctx.user.id,
        jobId,
        status: "pending",
        totalUrls: input.urls.length,
      });

      // Start background processing (in production, use a job queue)
      processBatchJob(jobId, input.urls, ctx.user.id).catch((error) => {
        console.error(`Batch job ${jobId} failed:`, error);
      });

      return { jobId };
    }),

  getBatchStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      // Implementation will be added in Phase 4
      return { jobId: input.jobId, status: "pending" };
    }),

  exportJSON: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input, ctx }) => {
      const checks = await getUserURLChecks(ctx.user.id, input.limit);
      const reportData = checks.map((check) => ({
        url: check.url,
        normalizedUrl: check.normalizedUrl,
        riskScore: check.riskScore,
        riskLevel: check.riskLevel,
        analysis: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).analysis : "",
        indicators: check.phishingReasons ? JSON.parse(check.phishingReasons) : [],
        confidence: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).confidence : 0,
        createdAt: check.createdAt,
      }));
      return generateJSONReport(reportData);
    }),

  exportCSV: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input, ctx }) => {
      const checks = await getUserURLChecks(ctx.user.id, input.limit);
      const reportData = checks.map((check) => ({
        url: check.url,
        normalizedUrl: check.normalizedUrl,
        riskScore: check.riskScore,
        riskLevel: check.riskLevel,
        analysis: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).analysis : "",
        indicators: check.phishingReasons ? JSON.parse(check.phishingReasons) : [],
        confidence: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).confidence : 0,
        createdAt: check.createdAt,
      }));
      return generateCSVReport(reportData);
    }),

  exportHTML: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input, ctx }) => {
      const checks = await getUserURLChecks(ctx.user.id, input.limit);
      const reportData = checks.map((check) => ({
        url: check.url,
        normalizedUrl: check.normalizedUrl,
        riskScore: check.riskScore,
        riskLevel: check.riskLevel,
        analysis: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).analysis : "",
        indicators: check.phishingReasons ? JSON.parse(check.phishingReasons) : [],
        confidence: check.deepseekAnalysis ? JSON.parse(check.deepseekAnalysis).confidence : 0,
        createdAt: check.createdAt,
      }));
      return generateHTMLReport(reportData);
    }),

  getCampaignTimeline: protectedProcedure
    .input(z.object({ clusterId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');
      const { clusterMemberships, urlChecks } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const members = await db
        .select({
          url: urlChecks.url,
          riskScore: urlChecks.riskScore,
          riskLevel: urlChecks.riskLevel,
          createdAt: urlChecks.createdAt,
        })
        .from(clusterMemberships)
        .innerJoin(urlChecks, eq(clusterMemberships.checkId, urlChecks.id))
        .where(eq(clusterMemberships.clusterId, input.clusterId))
        .orderBy(urlChecks.createdAt);
      return members;
    }),

  getClusterInfo: protectedProcedure
    .input(z.object({ clusterId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');
      const { phishingClusters } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const result = await db
        .select()
        .from(phishingClusters)
        .where(eq(phishingClusters.id, input.clusterId))
        .limit(1);
      return result[0] || null;
    }),

  exportCampaign: protectedProcedure
    .input(z.object({
      clusterId: z.number(),
      format: z.enum(['json', 'csv', 'html']).default('json'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');
      const { phishingClusters, clusterMemberships, urlChecks } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const { storagePut } = await import('../storage');
      
      const cluster = await db.select().from(phishingClusters).where(eq(phishingClusters.id, input.clusterId)).limit(1);
      if (!cluster.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' });
      
      const members = await db
        .select()
        .from(clusterMemberships)
        .innerJoin(urlChecks, eq(clusterMemberships.checkId, urlChecks.id))
        .where(eq(clusterMemberships.clusterId, input.clusterId))
        .orderBy(urlChecks.createdAt);
      
      let content = '';
      let mimeType = '';
      let filename = `campaign-${input.clusterId}-${Date.now()}`;
      
      if (input.format === 'json') {
        content = JSON.stringify({ cluster: cluster[0], members, exportedAt: new Date() }, null, 2);
        mimeType = 'application/json';
        filename += '.json';
      } else if (input.format === 'csv') {
        const rows = members.map((m: any) => [m.url_checks.url, m.url_checks.riskScore, m.url_checks.riskLevel, m.url_checks.createdAt]);
        content = ['URL,Risk Score,Risk Level,Discovered At', ...rows.map((r: any) => r.join(','))].join('\n');
        mimeType = 'text/csv';
        filename += '.csv';
      } else {
        const rows = members.map((m: any) => `<tr><td>${m.url_checks.url}</td><td>${m.url_checks.riskScore}</td><td>${m.url_checks.riskLevel}</td><td>${m.url_checks.createdAt}</td></tr>`).join('');
        content = `<html><head><style>table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body><h1>Campaign ${cluster[0].clusterName}</h1><table><tr><th>URL</th><th>Risk Score</th><th>Risk Level</th><th>Discovered</th></tr>${rows}</table></body></html>`;
        mimeType = 'text/html';
        filename += '.html';
      }
      
      const { url } = await storagePut(`exports/${filename}`, content, mimeType);
      return { downloadUrl: url };
    }),

  getRedirectChain: protectedProcedure
    .input(z.object({ urlCheckId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');
      
      const chain = await db
        .select()
        .from(redirectChains)
        .where(eq(redirectChains.id, input.urlCheckId))
        .limit(1);
      
      if (!chain.length) return null;
      
      const hops = await db
        .select()
        .from(redirectHops)
        .where(eq(redirectHops.chainId, chain[0].id))
        .orderBy(redirectHops.hopOrder);
      
      return { chain: chain[0], hops };
    }),
});

/**
 * Process batch job in background
 */
async function processBatchJob(jobId: string, urls: string[], userId: number) {
  // Implementation will be added in Phase 4
  console.log(`Processing batch job ${jobId} with ${urls.length} URLs`);
}
