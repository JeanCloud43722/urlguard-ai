import { describe, it, expect } from "vitest";
import {
  generateUrlId,
  extractMaliciousVendors,
  calculateVTRiskScore,
  formatVTReport,
  isVirusTotalMalicious,
  isVirusTotalSuspicious,
  getVirusTotalRiskLevel,
} from "./virusTotal";

describe("VirusTotal Service", () => {
  describe("URL ID Generation", () => {
    it("should generate valid Base64 URL ID without padding", () => {
      const url = "https://example.com";
      const id = generateUrlId(url);

      // Should be Base64 without padding
      expect(id).not.toContain("=");
      expect(id).toMatch(/^[A-Za-z0-9+/]+$/);
    });

    it("should generate consistent IDs for same URL", () => {
      const url = "https://example.com";
      const id1 = generateUrlId(url);
      const id2 = generateUrlId(url);

      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different URLs", () => {
      const id1 = generateUrlId("https://example.com");
      const id2 = generateUrlId("https://different.com");

      expect(id1).not.toBe(id2);
    });
  });

  describe("Malicious Vendors Extraction", () => {
    it("should extract malicious vendors from report", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1234567890,
          last_analysis_stats: { malicious: 2, suspicious: 0, undetected: 0, harmless: 60 },
          last_analysis_results: {
            "Kaspersky": { category: "malicious", engine_name: "Kaspersky", result: "phishing" },
            "McAfee": { category: "malicious", engine_name: "McAfee", result: "phishing" },
            "Google": { category: "harmless", engine_name: "Google", result: "clean" },
          },
          url: "https://example.com",
        },
      };

      const vendors = extractMaliciousVendors(report);

      expect(vendors).toContain("Kaspersky");
      expect(vendors).toContain("McAfee");
      expect(vendors).not.toContain("Google");
      expect(vendors.length).toBe(2);
    });

    it("should return empty array if no malicious results", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1234567890,
          last_analysis_stats: { malicious: 0, suspicious: 0, undetected: 0, harmless: 60 },
          last_analysis_results: {
            "Google": { category: "harmless", engine_name: "Google", result: "clean" },
          },
          url: "https://example.com",
        },
      };

      const vendors = extractMaliciousVendors(report);

      expect(vendors.length).toBe(0);
    });
  });

  describe("Risk Score Calculation", () => {
    it("should calculate 0 for all harmless", () => {
      const stats = { malicious: 0, suspicious: 0, undetected: 0, harmless: 60 };
      expect(calculateVTRiskScore(stats)).toBe(0);
    });

    it("should calculate 100 for all malicious", () => {
      const stats = { malicious: 60, suspicious: 0, undetected: 0, harmless: 0 };
      expect(calculateVTRiskScore(stats)).toBe(100);
    });

    it("should calculate proportional score for mixed results", () => {
      const stats = { malicious: 10, suspicious: 10, undetected: 20, harmless: 20 };
      const score = calculateVTRiskScore(stats);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(20); // Should be significant
    });

    it("should handle empty stats", () => {
      const stats = { malicious: 0, suspicious: 0, undetected: 0, harmless: 0 };
      expect(calculateVTRiskScore(stats)).toBe(0);
    });
  });

  describe("Report Formatting", () => {
    it("should format report with all stats", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1609459200, // 2021-01-01
          last_analysis_stats: { malicious: 2, suspicious: 1, undetected: 5, harmless: 52 },
          last_analysis_results: {
            "Kaspersky": { category: "malicious", engine_name: "Kaspersky", result: "phishing" },
          },
          url: "https://example.com",
        },
      };

      const formatted = formatVTReport(report);

      expect(formatted).toContain("Scan Date:");
      expect(formatted).toContain("Malicious: 2");
      expect(formatted).toContain("Suspicious: 1");
      expect(formatted).toContain("Undetected: 5");
      expect(formatted).toContain("Harmless: 52");
      expect(formatted).toContain("Kaspersky");
    });
  });

  describe("Malicious Detection", () => {
    it("should detect malicious URLs", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1234567890,
          last_analysis_stats: { malicious: 5, suspicious: 0, undetected: 0, harmless: 55 },
          last_analysis_results: {},
          url: "https://example.com",
        },
      };

      expect(isVirusTotalMalicious(report)).toBe(true);
    });

    it("should not detect harmless URLs as malicious", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1234567890,
          last_analysis_stats: { malicious: 0, suspicious: 0, undetected: 0, harmless: 60 },
          last_analysis_results: {},
          url: "https://example.com",
        },
      };

      expect(isVirusTotalMalicious(report)).toBe(false);
    });
  });

  describe("Suspicious Detection", () => {
    it("should detect suspicious URLs", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1234567890,
          last_analysis_stats: { malicious: 0, suspicious: 3, undetected: 0, harmless: 57 },
          last_analysis_results: {},
          url: "https://example.com",
        },
      };

      expect(isVirusTotalSuspicious(report)).toBe(true);
    });

    it("should not detect harmless URLs as suspicious", () => {
      const report = {
        id: "test",
        type: "url",
        attributes: {
          last_analysis_date: 1234567890,
          last_analysis_stats: { malicious: 0, suspicious: 0, undetected: 0, harmless: 60 },
          last_analysis_results: {},
          url: "https://example.com",
        },
      };

      expect(isVirusTotalSuspicious(report)).toBe(false);
    });
  });

  describe("Risk Level Determination", () => {
    it("should return 'dangerous' for malicious URLs", () => {
      const stats = { malicious: 5, suspicious: 0, undetected: 0, harmless: 55 };
      expect(getVirusTotalRiskLevel(stats)).toBe("dangerous");
    });

    it("should return 'suspicious' for suspicious URLs", () => {
      const stats = { malicious: 0, suspicious: 3, undetected: 0, harmless: 57 };
      expect(getVirusTotalRiskLevel(stats)).toBe("suspicious");
    });

    it("should return 'safe' for harmless URLs", () => {
      const stats = { malicious: 0, suspicious: 0, undetected: 0, harmless: 60 };
      expect(getVirusTotalRiskLevel(stats)).toBe("safe");
    });
  });
});
