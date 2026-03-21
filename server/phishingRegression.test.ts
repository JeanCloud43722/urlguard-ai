import { describe, it, expect, beforeAll } from "vitest";
import { EnhancedDeepSeekClient } from "./analyzers/deepseekEnhanced";
import { validateAndNormalizeURL, checkPhishingIndicators, extractAffiliateInfo } from "./analyzers/urlAnalyzer";
import { fetchCertificate, extractCertificateRisks } from "./utils/certificate";

/**
 * Regression Tests for Known Phishing URLs
 * 
 * These tests ensure that the system correctly identifies known phishing URLs
 * as "dangerous" based on heuristic indicators, certificate analysis, and DeepSeek AI.
 * 
 * This test suite validates that the removal of VirusTotal integration
 * does not degrade the system's ability to detect phishing.
 */

describe("Phishing Regression Tests - Known Dangerous URLs", () => {
  let deepseekClient: EnhancedDeepSeekClient;

  beforeAll(() => {
    deepseekClient = new EnhancedDeepSeekClient();
  });

  /**
   * Test Case 1: gatevacessoferiao.shop
   * Known phishing URL with suspicious indicators:
   * - Suspicious TLD (.shop)
   * - Domain name impersonating legitimate services
   * - Recently registered domain (expected)
   * - Recently issued SSL certificate (expected)
   */
  it("should classify gatevacessoferiao.shop as dangerous", async () => {
    const url = "https://gatevacessoferiao.shop";

    // 1. Validate and normalize
    const validation = validateAndNormalizeURL(url);
    expect(validation.isValid).toBe(true);
    // URL normalization may add trailing slash
    expect(validation.normalizedUrl).toMatch(/gatevacessoferiao\.shop\/?$/);

    // 2. Check heuristic indicators
    const heuristicIndicators = checkPhishingIndicators(validation.normalizedUrl);
    console.log("[Test] Heuristic indicators:", heuristicIndicators);
    
    // Should detect suspicious TLD
    expect(heuristicIndicators.some((ind) => ind.includes(".shop"))).toBe(true);

    // 3. Extract affiliate info
    const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);
    console.log("[Test] Affiliate info:", affiliateInfo);

    // 4. Fetch certificate info
    let certificateInfo: any = {};
    let certificateRisks: string[] = [];
    try {
      const hostname = new URL(validation.normalizedUrl).hostname;
      if (hostname) {
        certificateInfo = await fetchCertificate(hostname);
        certificateRisks = extractCertificateRisks(certificateInfo);
        console.log("[Test] Certificate info:", certificateInfo);
        console.log("[Test] Certificate risks:", certificateRisks);
      }
    } catch (err) {
      console.warn("[Test] Could not fetch certificate:", err);
      certificateInfo = { error: "Failed to retrieve certificate" };
    }

    // 5. Analyze with DeepSeek using full context
    const allIndicators = [...heuristicIndicators, ...certificateRisks];
    const analysis = await deepseekClient.analyzeWithFullContext(
      validation.normalizedUrl,
      certificateInfo,
      allIndicators,
      affiliateInfo
    );

    console.log("[Test] DeepSeek Analysis:", {
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      analysis: analysis.analysis,
      indicators: analysis.phishingIndicators,
      confidence: analysis.confidence,
    });

    // 6. Assertions
    expect(analysis.riskLevel).toBe("dangerous");
    expect(analysis.riskScore).toBeGreaterThanOrEqual(80);
    expect(analysis.confidence).toBeGreaterThan(0.7);
    expect(analysis.phishingIndicators.length).toBeGreaterThan(0);
  }, { timeout: 15000 });

  /**
   * Test Case 2: Legitimate URL - google.com
   * Should be classified as safe
   */
  it("should classify legitimate URL (google.com) as safe", async () => {
    const url = "https://www.google.com";

    const validation = validateAndNormalizeURL(url);
    expect(validation.isValid).toBe(true);

    const heuristicIndicators = checkPhishingIndicators(validation.normalizedUrl);
    console.log("[Test] Google indicators:", heuristicIndicators);

    // Should have minimal indicators
    expect(heuristicIndicators.length).toBeLessThan(5);

    const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);
    let certificateInfo: any = {};
    let certificateRisks: string[] = [];

    try {
      const hostname = new URL(validation.normalizedUrl).hostname;
      if (hostname) {
        certificateInfo = await fetchCertificate(hostname);
        certificateRisks = extractCertificateRisks(certificateInfo);
      }
    } catch (err) {
      certificateInfo = { error: "Failed to retrieve certificate" };
    }

    const allIndicators = [...heuristicIndicators, ...certificateRisks];
    const analysis = await deepseekClient.analyzeWithFullContext(
      validation.normalizedUrl,
      certificateInfo,
      allIndicators,
      affiliateInfo
    );

    console.log("[Test] Google analysis:", {
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
    });

    expect(analysis.riskLevel).toBe("safe");
    expect(analysis.riskScore).toBeLessThanOrEqual(30);
  }, { timeout: 15000 });

  /**
   * Test Case 3: IP Address URL
   * Should be classified as dangerous due to:
   * - IP address instead of domain
   * - Suspicious pattern
   */
  it("should classify IP address URL as dangerous", async () => {
    const url = "https://192.168.1.1/admin";

    const validation = validateAndNormalizeURL(url);
    expect(validation.isValid).toBe(true);

    const heuristicIndicators = checkPhishingIndicators(validation.normalizedUrl);
    console.log("[Test] IP address indicators:", heuristicIndicators);

    // Should detect IP address
    expect(heuristicIndicators.some((ind) => ind.toLowerCase().includes("ip address"))).toBe(true);

    const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);
    let certificateInfo: any = {};
    let certificateRisks: string[] = [];

    try {
      const hostname = new URL(validation.normalizedUrl).hostname;
      if (hostname) {
        certificateInfo = await fetchCertificate(hostname);
        certificateRisks = extractCertificateRisks(certificateInfo);
      }
    } catch (err) {
      certificateInfo = { error: "Failed to retrieve certificate" };
    }

    const allIndicators = [...heuristicIndicators, ...certificateRisks];
    const analysis = await deepseekClient.analyzeWithFullContext(
      validation.normalizedUrl,
      certificateInfo,
      allIndicators,
      affiliateInfo
    );

    console.log("[Test] IP address analysis:", {
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
    });

    expect(analysis.riskLevel).toBe("dangerous");
    expect(analysis.riskScore).toBeGreaterThanOrEqual(75);
  }, { timeout: 15000 });
});
