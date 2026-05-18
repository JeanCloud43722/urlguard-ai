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
        
        // Phase 4: Vorläufiges Ergebnis (Heuristic) + DeepSeek im Hintergrund
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

        // DeepSeek als Hintergrundjob (fire-and-forget)
        console.log("[Phase4] Starte DeepSeek im Hintergrund...");
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
            
            // TODO: Datenbank updaten mit finalAnalysis
          } catch (err) {
            console.error("[DeepSeek] ❌ Fehler:", (err as Error).message);
          }
        };
        
        // Starte Background Job (nicht blockierend)
        setImmediate(() => {
          runDeepSeekAnalysis().catch(console.error);
        });
        
        console.log("[Phase4] ✅ Vorläufiges Ergebnis zurückgegeben, DeepSeek läuft im Hintergrund");
        return preliminaryResult;
        
      } catch (err) {
        console.error("[checkURL] ❌ Fehler:", (err as Error).message);
        throw err;
      }
    }),
});
