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
        let cacheKey = "";
        try {
          const crypto = await import("crypto");
          const { getCache } = await import("../services/cacheWrapper");
          const cache = await getCache();
          cacheKey = crypto.createHash("sha256").update(validation.normalizedUrl).digest("hex");
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
        
        // Phase 4: Erstelle DB-Eintrag mit vorläufigem Ergebnis
        console.log("[Phase4] Erstelle DB-Eintrag...");
        
        const { createURLCheck } = await import("../db");
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

        let checkId = 0;
        try {
          // Create DB record with preliminary result
          const dbRecord = await createURLCheck({
            userId: 999, // Fallback user ID (no auth in public procedure)
            url: input.url,
            normalizedUrl: validation.normalizedUrl,
            riskScore: preliminaryResult.riskScore,
            riskLevel: preliminaryResult.riskLevel,
            phishingReasons: JSON.stringify(indicators),
            deepseekAnalysis: JSON.stringify({}), // Empty = preliminary
            affiliateInfo: JSON.stringify(affiliateInfo),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          
          checkId = dbRecord?.id || 0;
          console.log("[Phase4] ✅ DB-Eintrag erstellt mit ID:", checkId);
          preliminaryResult.id = checkId;
        } catch (dbErr) {
          console.error("[Phase4] ⚠️ DB-Fehler (nicht kritisch):", (dbErr as Error).message);
          // Continue without DB - just use cache
        }

        // Phase 5: Starte Background Jobs (fire-and-forget)
        console.log("[Phase5] Starte Background Jobs...");
        setImmediate(() => {
          // Background Job: DeepSeek Fraud Detection
          const runFraudDetection = async () => {
            console.log("[Fraud] 🚀 Hintergrundjob gestartet für Check", checkId);
            try {
              const { detectFraudWithDeepSeek } = await import("../services/fraudDetector");
              console.log("[Fraud] 📞 Rufe detectFraudWithDeepSeek auf...");
              
              const fraudResult = await detectFraudWithDeepSeek(
                validation.normalizedUrl,
                indicators
              );
              
              if (fraudResult) {
                console.log("[Fraud] ✅ DeepSeek-Antwort erhalten:", {
                  fraud_score: fraudResult.fraud_score,
                  risk_level: fraudResult.risk_level,
                });
                
                // Update DB with final result
                if (checkId > 0) {
                  try {
                    const { updateCheck } = await import("../db");
                    await updateCheck(checkId, {
                      riskScore: fraudResult.fraud_score,
                      riskLevel: fraudResult.risk_level,
                      deepseekAnalysis: JSON.stringify(fraudResult),
                      updatedAt: new Date(),
                    });
                    console.log("[Fraud] ✅ DB aktualisiert mit finalem Ergebnis");
                  } catch (updateErr) {
                    console.error("[Fraud] ❌ DB-Update-Fehler:", (updateErr as Error).message);
                  }
                }
                
                // Update cache with final result
                if (cacheKey) {
                  try {
                    const { getCache } = await import("../services/cacheWrapper");
                    const cache = await getCache();
                    const finalResult = {
                      ...preliminaryResult,
                      riskScore: fraudResult.fraud_score,
                      riskLevel: fraudResult.risk_level,
                      analysis: fraudResult.reasons?.join(", ") || preliminaryResult.analysis,
                      confidence: fraudResult.confidence,
                      isPreliminary: false,
                    };
                    await cache.set(cacheKey, finalResult, 86400);
                    console.log("[Fraud] ✅ Cache aktualisiert");
                  } catch (cacheErr) {
                    console.warn("[Fraud] ⚠️ Cache-Update-Fehler:", (cacheErr as Error).message);
                  }
                }
              } else {
                console.warn("[Fraud] ⚠️ DeepSeek lieferte kein Ergebnis");
                
                // Fallback: Mark as final even without DeepSeek result
                if (checkId > 0) {
                  try {
                    const { updateCheck } = await import("../db");
                    await updateCheck(checkId, {
                      deepseekAnalysis: JSON.stringify({
                        fraud_score: preliminaryResult.riskScore,
                        risk_level: preliminaryResult.riskLevel,
                        reasons: ["DeepSeek nicht erreichbar, Ergebnis basiert auf Heuristik"],
                        confidence: 0.5,
                      }),
                      updatedAt: new Date(),
                    });
                    console.log("[Fraud] ✅ DB mit Fallback-Ergebnis aktualisiert");
                  } catch (updateErr) {
                    console.error("[Fraud] ❌ Fallback-Update-Fehler:", (updateErr as Error).message);
                  }
                }
              }
            } catch (err) {
              console.error("[Fraud] ❌ Kritischer Fehler im Hintergrundjob:", (err as Error).message);
              
              // Final fallback: Mark as complete even on error
              if (checkId > 0) {
                try {
                  const { updateCheck } = await import("../db");
                  await updateCheck(checkId, {
                    deepseekAnalysis: JSON.stringify({
                      fraud_score: preliminaryResult.riskScore,
                      risk_level: preliminaryResult.riskLevel,
                      reasons: ["Fehler bei der Analyse - Ergebnis basiert auf Heuristik"],
                      confidence: 0.5,
                    }),
                    updatedAt: new Date(),
                  });
                } catch (finalErr) {
                  console.error("[Fraud] ❌ Finaler Fallback fehlgeschlagen:", (finalErr as Error).message);
                }
              }
            }
          };
          
          // Start fraud detection
          runFraudDetection().catch((err) => {
            console.error("[Fraud] Unerwarteter Fehler:", err);
          });
        });
        
        console.log("[Phase5] ✅ Vorläufiges Ergebnis zurückgegeben, Background Jobs laufen");
        return preliminaryResult;
        
      } catch (err) {
        console.error("[checkURL] ❌ Kritischer Fehler:", (err as Error).message);
        throw err;
      }
    }),

  // Get single check by ID (for polling)
  getCheckById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      console.log('[getCheckById] 🔍 Abruf für ID:', input.id);
      try {
        if (input.id <= 0) {
          console.warn('[getCheckById] ⚠️ Ungültige ID:', input.id);
          return null;
        }

        const { getURLCheckById } = await import("../db");
        const check = await getURLCheckById(input.id);
        
        if (!check) {
          console.warn('[getCheckById] ⚠️ Check nicht gefunden:', input.id);
          return null;
        }

        console.log('[getCheckById] ✅ Check gefunden:', {
          id: check.id,
          riskScore: check.riskScore,
          deepseekAnalysis: check.deepseekAnalysis ? "vorhanden" : "leer",
        });

        // Parse deepseek analysis
        let deepData = null;
        try {
          if (check.deepseekAnalysis && check.deepseekAnalysis !== '{}') {
            deepData = JSON.parse(check.deepseekAnalysis);
          }
        } catch (parseErr) {
          console.warn('[getCheckById] ⚠️ Parse-Fehler für deepseekAnalysis:', (parseErr as Error).message);
        }

        // Calculate isPreliminary: true if no deepseek data or empty object
        const isPreliminary = !deepData || Object.keys(deepData).length === 0;
        
        console.log('[getCheckById] 📊 isPreliminary:', isPreliminary, 'deepData:', deepData ? 'ja' : 'nein');

        return {
          id: check.id,
          url: check.url,
          normalizedUrl: check.normalizedUrl,
          riskScore: deepData?.fraud_score ?? check.riskScore,
          riskLevel: deepData?.risk_level ?? check.riskLevel,
          analysis: deepData?.reasons?.join(', ') || check.deepseekAnalysis || 'Analyse läuft noch...',
          indicators: check.phishingReasons ? JSON.parse(check.phishingReasons) : [],
          affiliateInfo: check.affiliateInfo ? JSON.parse(check.affiliateInfo) : {},
          confidence: deepData?.confidence ?? 0.6,
          isPreliminary: isPreliminary,
          createdAt: check.createdAt,
        };
      } catch (err) {
        console.error('[getCheckById] ❌ Fehler:', (err as Error).message);
        return null;
      }
    }),

  // Get history of checks for current user
  getHistory: publicProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      console.log('[getHistory] Abruf mit limit:', input.limit);
      try {
        const { getDb } = await import("../db");
        const { urlChecks } = await import("../../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) {
          console.warn('[getHistory] Keine DB-Verbindung');
          return [];
        }
        
        // Get recent checks (for public procedure, get all recent checks)
        const checks = await db
          .select()
          .from(urlChecks)
          .orderBy(desc(urlChecks.createdAt))
          .limit(input.limit);
        
        console.log('[getHistory] OK: Gefunden', checks.length, 'Checks');
        
        // Transform to frontend format
        return checks.map(check => {
          let deepData = null;
          try {
            if (check.deepseekAnalysis && check.deepseekAnalysis !== '{}') {
              deepData = JSON.parse(check.deepseekAnalysis as string);
            }
          } catch (e) {
            // ignore parse errors
          }
          
          return {
            id: check.id,
            url: check.url,
            normalizedUrl: check.normalizedUrl,
            riskScore: deepData?.fraud_score ?? check.riskScore,
            riskLevel: deepData?.risk_level ?? check.riskLevel,
            analysis: deepData?.reasons?.join(', ') || 'Analyse läuft noch...',
            indicators: check.phishingReasons ? JSON.parse(check.phishingReasons as string) : [],
            affiliateInfo: check.affiliateInfo ? JSON.parse(check.affiliateInfo as string) : {},
            confidence: deepData?.confidence ?? 0.6,
            isPreliminary: !deepData || Object.keys(deepData).length === 0,
            createdAt: check.createdAt,
          };
        });
      } catch (err) {
        console.error('[getHistory] Fehler:', (err as Error).message);
        return [];
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
