import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createURLCheck, getUserURLChecks, createBatchJob, getUserBatchJobs } from "../db";
import { analyzeURLWithDeepSeek } from "../analyzers/deepseek";
import { validateAndNormalizeURL, extractAffiliateInfo, checkPhishingIndicators } from "../analyzers/urlAnalyzer";
import { nanoid } from "nanoid";
import { notifyOwner } from "../_core/notification";
import { generateJSONReport, generateCSVReport, generateHTMLReport } from "../utils/exportReport";

export const urlCheckerRouter = router({
  checkURL: protectedProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate and normalize URL
        const validation = validateAndNormalizeURL(input.url);
        if (!validation.isValid) {
          throw new Error(validation.error || "Invalid URL");
        }

        // Extract affiliate info
        const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);

        // Check for local phishing indicators
        const localIndicators = checkPhishingIndicators(validation.normalizedUrl);

        // Analyze with DeepSeek
        const deepseekAnalysis = await analyzeURLWithDeepSeek(validation.normalizedUrl);

        // Combine indicators
        const allReasons = [...localIndicators, ...deepseekAnalysis.phishingIndicators];

        // Create database record
        await createURLCheck({
          userId: ctx.user.id,
          url: input.url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: deepseekAnalysis.riskScore,
          riskLevel: deepseekAnalysis.riskLevel,
          phishingReasons: JSON.stringify(allReasons),
          deepseekAnalysis: JSON.stringify(deepseekAnalysis),
          affiliateInfo: JSON.stringify(affiliateInfo),
        });

        // Notify owner if dangerous
        if (deepseekAnalysis.riskLevel === "dangerous") {
          await notifyOwner({
            title: "High-Risk Phishing URL Detected",
            content: `User ${ctx.user.name} detected a dangerous URL: ${validation.normalizedUrl}\n\nRisk Score: ${deepseekAnalysis.riskScore}/100\nAnalysis: ${deepseekAnalysis.analysis}`,
          });
        }

        return {
          id: Date.now(),
          url: input.url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: deepseekAnalysis.riskScore,
          riskLevel: deepseekAnalysis.riskLevel,
          analysis: deepseekAnalysis.analysis,
          indicators: allReasons,
          affiliateInfo,
          confidence: deepseekAnalysis.confidence,
          createdAt: new Date(),
        };
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
        riskScore: check.riskScore,
        riskLevel: check.riskLevel,
        createdAt: check.createdAt,
        indicators: JSON.parse(check.phishingReasons || "[]"),
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
