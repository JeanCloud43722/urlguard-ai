import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createURLCheck, getUserURLChecks, createBatchJob, getUserBatchJobs, createOCRAnalysis } from "../db";
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

        // 5. Analyze with DeepSeek using full context
        const deepseekClient = getDeepSeekClient();
        const deepseekAnalysis = await deepseekClient.analyzeWithFullContext(
          validation.normalizedUrl,
          certificateInfo,
          [...localIndicators, ...certificateRisks],
          affiliateInfo
        );

        // 6. Combine all indicators (heuristic + certificate + AI)
        const allReasons = [...localIndicators, ...certificateRisks, ...deepseekAnalysis.phishingIndicators];

        // 7. Create database record
        const urlCheckRecord = await createURLCheck({
          userId: ctx.user.id,
          url: input.url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: deepseekAnalysis.riskScore,
          riskLevel: deepseekAnalysis.riskLevel,
          phishingReasons: JSON.stringify(allReasons),
          deepseekAnalysis: JSON.stringify(deepseekAnalysis),
          affiliateInfo: JSON.stringify(affiliateInfo),
        });

        // 8. Enqueue screenshot job if dangerous
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
            console.log(`[URLChecker] Screenshot job enqueued for URL: ${validation.normalizedUrl}`);
          } catch (error) {
            console.error("[URLChecker] Failed to enqueue screenshot job:", error);
            // Don't fail the main analysis if screenshot job fails
          }
        }

        // 8b. Enqueue OCR analysis if screenshot was captured
        if (deepseekAnalysis.riskLevel === "dangerous" || deepseekAnalysis.riskLevel === "suspicious") {
          try {
            // Queue OCR analysis for screenshot (will be processed asynchronously)
            // Note: In production, pass actual screenshot buffer from storage
            await queueOCRAnalysis({
              checkId: urlCheckRecord.id,
              userId: ctx.user.id,
              screenshotBuffer: Buffer.from(''), // Will be populated from screenshot storage
              domain: new URL(validation.normalizedUrl).hostname || '',
            });
            console.log(`[URLChecker] OCR analysis job queued for check ${urlCheckRecord.id}`);
          } catch (error) {
            console.error("[URLChecker] Failed to queue OCR analysis:", error);
            // Don't fail if OCR queueing fails
          }
        }

        // 9. Notify owner if dangerous
        if (deepseekAnalysis.riskLevel === "dangerous") {
          const certificateWarning = certificateRisks.length > 0 ? `\n\nCertificate Risks: ${certificateRisks.join(", ")}` : "";
          await notifyOwner({
            title: "🚨 High-Risk Phishing URL Detected",
            content: `User ${ctx.user.name} detected a dangerous URL: ${validation.normalizedUrl}\n\nRisk Score: ${deepseekAnalysis.riskScore}/100\nConfidence: ${Math.round(deepseekAnalysis.confidence * 100)}%\n\nAnalysis: ${deepseekAnalysis.analysis}${certificateWarning}\n\nIndicators: ${allReasons.join(", ")}`,
          });
        }

        // 9. Return result
        const result = {
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
          createdAt: new Date(),
        };

        // 9b. Cache result for 24 hours
        await redis.setAnalysisCache(urlHash, result, 86400);
        console.log(`[Cache] Stored ${validation.normalizedUrl}`);

        return result;
      } catch (error) {
        console.error("URL check error:", error);
        throw new Error(`Failed to analyze URL: ${(error as Error).message}`);
      }
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
});

/**
 * Process batch job in background
 */
async function processBatchJob(jobId: string, urls: string[], userId: number) {
  // Implementation will be added in Phase 4
  console.log(`Processing batch job ${jobId} with ${urls.length} URLs`);
}
