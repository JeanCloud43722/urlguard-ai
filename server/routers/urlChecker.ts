import z from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { checkPhishingIndicators, extractAffiliateInfo } from "../analyzers/urlAnalyzer";

export const urlCheckerRouter = router({
  checkURL: publicProcedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[checkURL] ✅ Mutation aufgerufen für:", input.url);

      try {
        // Phase 1: URL-Validierung & Normalisierung
        console.log("[Phase1] Starte URL-Validierung...");
        const { validateAndNormalizeURL } = await import("../analyzers/urlAnalyzer");
        const validation = validateAndNormalizeURL(input.url);
        
        if (!validation.isValid) {
          console.error("[Phase1] ❌ Ungültige URL:", validation.error);
          throw new Error(validation.error || "Invalid URL");
        }
        
        console.log("[Phase1] ✅ Normalisiert:", validation.normalizedUrl);

        // Phase 2: Cache Check (optional, mit Fallback)
        console.log("[Phase2] Prüfe Cache...");
        try {
          const crypto = await import("crypto");
          const { getCache } = await import("../services/cacheWrapper");
          const cache = await getCache();
          const cacheKey = crypto.createHash("sha256").update(validation.normalizedUrl).digest("hex");
          const cached = await cache.get(cacheKey);
          
          if (cached) {
            console.log("[Phase2] ✅ Cache HIT – sofortige Antwort");
            return cached;
          }
        } catch (err) {
          console.warn("[Phase2] ⚠️ Cache-Fehler:", (err as Error).message);
        }

        // Phase 3: Heuristische Indikatoren & Early Exit
        console.log("[Phase3] Prüfe heuristische Indikatoren...");
        const indicators = checkPhishingIndicators(validation.normalizedUrl);
        const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);
        
        // Early Exit: Offensichtlich sichere URLs
        const isObviouslySafe = indicators.length === 0 && 
          (validation.domain.endsWith('.com') || 
           validation.domain.endsWith('.org') ||
           validation.domain.endsWith('.gov') ||
           validation.domain.endsWith('.edu'));
        
        if (isObviouslySafe) {
          console.log("[Phase3] ✅ Early Exit: URL ist offensichtlich sicher");
          return {
            id: 0,
            url: input.url,
            normalizedUrl: validation.normalizedUrl,
            domain: validation.domain,
            indicators: [],
            riskScore: 5,
            riskLevel: "safe" as const,
            analysis: "Phase 3: Heuristische Analyse - URL ist sicher",
            affiliateInfo,
            confidence: 0.95,
            isPreliminary: false,
            createdAt: new Date(),
          };
        }
        
        // Phase 4: Vorläufiges Ergebnis + Background Jobs
        console.log("[Phase4] Starte Progressive Response...");
        
        const preliminaryResult = {
          id: 0,
          url: input.url,
          normalizedUrl: validation.normalizedUrl,
          domain: validation.domain,
          indicators: indicators,
          riskScore: indicators.length > 0 ? 50 : 30,
          riskLevel: "suspicious" as const,
          analysis: "Phase 4: Erste Analyse basierend auf URL-Struktur. Tiefenanalyse läuft im Hintergrund...",
          affiliateInfo,
          confidence: 0.6,
          isPreliminary: true,
          createdAt: new Date(),
        };

        // Get cache key for later updates
        let cacheKey = "";
        try {
          const crypto = await import("crypto");
          cacheKey = crypto.createHash("sha256").update(validation.normalizedUrl).digest("hex");
        } catch (err) {
          console.warn("[Phase4] Cache-Key-Fehler:", (err as Error).message);
        }

        // Background Job 1: DeepSeek Analysis
        const runDeepSeekAnalysis = async () => {
          try {
            const { getDeepSeekClient } = await import("../analyzers/deepseekEnhanced");
            const client = getDeepSeekClient();
            console.log("[DeepSeek] Starte Analyse für:", validation.normalizedUrl);
            
            const finalAnalysis = await client.analyzeWithFullContext(
              validation.normalizedUrl,
              {}, // certificateInfo (später)
              indicators,
              affiliateInfo
            );
            
            console.log("[DeepSeek] ✅ Analyse abgeschlossen:", {
              riskScore: finalAnalysis.riskScore,
              riskLevel: finalAnalysis.riskLevel,
            });
            
            // Update cache with final result
            if (cacheKey) {
              try {
                const { getCache } = await import("../services/cacheWrapper");
                const cache = await getCache();
                const finalResult = {
                  ...preliminaryResult,
                  ...finalAnalysis,
                  isPreliminary: false,
                };
                await cache.set(cacheKey, finalResult, 86400);
                console.log("[Phase4] ✅ Cache aktualisiert mit finalem Ergebnis");
              } catch (err) {
                console.warn("[Phase4] Cache-Update-Fehler:", (err as Error).message);
              }
            }
          } catch (err) {
            console.error("[DeepSeek] ❌ Fehler:", (err as Error).message);
          }
        };
        
        // Background Job 2: SSL Certificate Fetching
        const fetchCertificateAsync = async () => {
          try {
            const { fetchCertificate } = await import("../utils/certificate");
            const hostname = new URL(validation.normalizedUrl).hostname;
            if (hostname) {
              const cert = await fetchCertificate(hostname);
              console.log("[Cert] ✅ Zertifikat abgerufen für:", hostname);
            }
          } catch (err) {
            console.warn("[Cert] ⚠️ Fehler:", (err as Error).message);
          }
        };
        
        // Background Job 3: Redirect Detection
        const detectRedirectsAsync = async () => {
          try {
            const { detectRedirectChain } = await import("../services/redirectDetector");
            const chain = await detectRedirectChain(validation.normalizedUrl);
            if (chain.redirectCount > 0) {
              console.log(`[Redirect] ✅ ${chain.redirectCount} Weiterleitungen erkannt`);
            }
          } catch (err) {
            console.warn("[Redirect] ⚠️ Fehler:", (err as Error).message);
          }
        };
        
        // Start all background jobs (fire-and-forget)
        console.log("[Phase4] Starte Background Jobs...");
        setImmediate(() => {
          runDeepSeekAnalysis().catch(console.error);
          fetchCertificateAsync().catch(console.error);
          detectRedirectsAsync().catch(console.error);
        });
        
        console.log("[Phase4] ✅ Vorläufiges Ergebnis zurückgegeben, Background Jobs laufen");
        return preliminaryResult;
        
      } catch (err) {
        console.error("[checkURL] ❌ Fehler:", (err as Error).message);
        throw err;
      }
    }),

  // Health check endpoint
  health: publicProcedure.query(async () => {
    let redisStatus = "unknown";
    try {
      const { getCache } = await import("../services/cacheWrapper");
      const cache = await getCache();
      await cache.ping();
      redisStatus = "ok";
    } catch (err) {
      redisStatus = "fallback";
    }
    
    return {
      status: "ok",
      redis: redisStatus,
      timestamp: new Date(),
    };
  }),
});
