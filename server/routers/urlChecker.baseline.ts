import z from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { checkPhishingIndicators } from "../analyzers/urlAnalyzer";

export const urlCheckerRouter = router({
  checkURL: publicProcedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input }) => {
      // Step 1: Simple URL normalization
      let rawUrl = input.url.trim();
      if (!rawUrl.startsWith("http")) rawUrl = "https://" + rawUrl;
      
      // Step 2: Check phishing indicators
      const indicators = checkPhishingIndicators(rawUrl);
      
      return { 
        id: 1, 
        url: input.url, 
        normalizedUrl: rawUrl,
        indicators: indicators,
        riskScore: indicators.length > 0 ? 75 : 25, 
        riskLevel: indicators.length > 0 ? "suspicious" : "safe" as const, 
        isPreliminary: false, 
        createdAt: new Date() 
      };
    }),
});
