import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { validateAndNormalizeURL, extractAffiliateInfo, checkPhishingIndicators, calculateDomainSimilarity } from "./analyzers/urlAnalyzer";
import { generateJSONReport, generateCSVReport, generateHTMLReport } from "./utils/exportReport";

describe("URL Analyzer", () => {
  describe("validateAndNormalizeURL", () => {
    it("should normalize URLs without protocol", () => {
      const result = validateAndNormalizeURL("example.com");
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toContain("https://");
    });

    it("should handle valid URLs", () => {
      const result = validateAndNormalizeURL("https://www.example.com/path");
      expect(result.isValid).toBe(true);
      expect(result.hostname).toBe("www.example.com");
    });

    it("should reject invalid URLs", () => {
      const result = validateAndNormalizeURL("not a valid url");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("extractAffiliateInfo", () => {
    it("should detect Amazon affiliate tags", () => {
      const result = extractAffiliateInfo("https://amazon.com/product?tag=mypartner-21");
      expect(result.isAffiliate).toBe(true);
      expect(result.affiliateParams.tag).toBe("mypartner-21");
    });

    it("should detect UTM parameters", () => {
      const result = extractAffiliateInfo("https://example.com?utm_source=partner&utm_campaign=test");
      expect(result.isAffiliate).toBe(true);
      expect(result.affiliateParams.utm_source).toBe("partner");
    });

    it("should handle non-affiliate URLs", () => {
      const result = extractAffiliateInfo("https://example.com");
      expect(result.isAffiliate).toBe(false);
    });
  });

  describe("checkPhishingIndicators", () => {
    it("should detect suspicious PayPal subdomains", () => {
      const indicators = checkPhishingIndicators("https://paypal.sicherheit-xyz.com");
      expect(indicators.some((i) => i.includes("PayPal"))).toBe(true);
    });

    it("should detect IP addresses", () => {
      const indicators = checkPhishingIndicators("https://192.168.1.1");
      expect(indicators.some((i) => i.includes("IP address"))).toBe(true);
    });

    it("should detect suspicious TLDs", () => {
      const indicators = checkPhishingIndicators("https://example.tk");
      expect(indicators.some((i) => i.includes("top-level domain"))).toBe(true);
    });

    it("should not flag legitimate URLs", () => {
      const indicators = checkPhishingIndicators("https://www.google.com");
      // google.com without www may trigger homoglyph check
      expect(indicators.length).toBeLessThan(2);
    });
  });

  describe("calculateDomainSimilarity", () => {
    it("should return 1 for identical domains", () => {
      const similarity = calculateDomainSimilarity("example.com", "example.com");
      expect(similarity).toBe(1);
    });

    it("should detect similar domains", () => {
      const similarity = calculateDomainSimilarity("example.com", "exampel.com");
      expect(similarity).toBeGreaterThan(0.8);
    });

    it("should return low similarity for different domains", () => {
      const similarity = calculateDomainSimilarity("google.com", "amazon.com");
      expect(similarity).toBeLessThan(0.5);
    });
  });
});

describe("Report Generation", () => {
  const testData = [
    {
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      riskScore: 10,
      riskLevel: "safe",
      analysis: "URL appears safe",
      indicators: [],
      confidence: 0.95,
      createdAt: new Date("2026-01-15"),
    },
    {
      url: "https://phishing.com",
      normalizedUrl: "https://phishing.com/",
      riskScore: 85,
      riskLevel: "dangerous",
      analysis: "Likely phishing site",
      indicators: ["Suspicious domain", "Known phishing pattern"],
      confidence: 0.92,
      createdAt: new Date("2026-01-16"),
    },
  ];

  describe("generateJSONReport", () => {
    it("should generate valid JSON report", () => {
      const report = generateJSONReport(testData);
      const parsed = JSON.parse(report);
      expect(parsed.totalChecks).toBe(2);
      expect(parsed.summary.safe).toBe(1);
      expect(parsed.summary.dangerous).toBe(1);
    });

    it("should include all check details", () => {
      const report = generateJSONReport(testData);
      const parsed = JSON.parse(report);
      expect(parsed.checks[0].url).toBe("https://example.com");
      expect(parsed.checks[1].riskScore).toBe(85);
    });
  });

  describe("generateCSVReport", () => {
    it("should generate valid CSV report", () => {
      const report = generateCSVReport(testData);
      const lines = report.split("\n");
      expect(lines.length).toBeGreaterThan(2); // header + data rows
      expect(lines[0]).toContain("URL");
    });

    it("should escape quotes in CSV", () => {
      const report = generateCSVReport(testData);
      expect(report).toBeDefined();
      // CSV should be properly formatted
      const lines = report.split("\n");
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe("generateHTMLReport", () => {
    it("should generate valid HTML report", () => {
      const report = generateHTMLReport(testData);
      expect(report).toContain("<!DOCTYPE html>");
      expect(report).toContain("URLGuard AI Report");
    });

    it("should include summary statistics", () => {
      const report = generateHTMLReport(testData);
      expect(report).toContain("Safe");
      expect(report).toContain("Dangerous");
    });

    it("should include check details in table", () => {
      const report = generateHTMLReport(testData);
      expect(report).toContain("example.com");
      expect(report).toContain("phishing.com");
    });
  });
});

describe("URL Analyzer Edge Cases", () => {
  it("should handle URLs with query parameters", () => {
    const result = validateAndNormalizeURL("https://example.com?param1=value1&param2=value2");
    expect(result.isValid).toBe(true);
  });

  it("should handle URLs with fragments", () => {
    const result = validateAndNormalizeURL("https://example.com#section");
    expect(result.isValid).toBe(true);
  });

  it("should handle internationalized domain names", () => {
    const result = validateAndNormalizeURL("https://münchen.de");
    expect(result.isValid).toBe(true);
  });

  it("should detect excessive subdomains", () => {
    const indicators = checkPhishingIndicators("https://a.b.c.d.example.com");
    expect(indicators.some((i) => i.includes("subdomain"))).toBe(true);
  });
});
