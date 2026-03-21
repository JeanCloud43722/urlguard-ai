import { describe, it, expect, beforeEach } from "vitest";
import { SYSTEM_PROMPT, buildUserPrompt, validateResponse, RESPONSE_SCHEMA } from "./analyzers/deepseekPrompt";
import { isCertificateValid, isSelfSigned, isTrustedIssuer, extractCertificateRisks } from "./utils/certificate";

describe("DeepSeek Context Analysis", () => {
  describe("Prompt Building", () => {
    it("should build user prompt with all context data", () => {
      const contextData = {
        url: "https://example.com",
        certificateInfo: {
          subject: { CN: "example.com" },
          issuer: { CN: "Let's Encrypt" },
          valid_from: "2024-01-01T00:00:00Z",
          valid_to: "2025-01-01T00:00:00Z",
        },
        heuristicIndicators: ["Suspicious domain pattern"],
        affiliateInfo: { hasAffiliateParams: false },
      };

      const prompt = buildUserPrompt(contextData);

      expect(prompt).toContain("https://example.com");
      expect(prompt).toContain("Let's Encrypt");
      expect(prompt).toContain("Suspicious domain pattern");
      expect(prompt).toContain("fraud_score");
      expect(prompt).toContain("risk_level");
    });

    it("should handle missing certificate info", () => {
      const contextData = {
        url: "https://example.com",
        certificateInfo: {},
        heuristicIndicators: [],
        affiliateInfo: {},
      };

      const prompt = buildUserPrompt(contextData);

      expect(prompt).toContain("Not available");
      expect(prompt).toContain("https://example.com");
    });

    it("should include system prompt", () => {
      expect(SYSTEM_PROMPT).toContain("cybersecurity expert");
      expect(SYSTEM_PROMPT).toContain("NO internet access");
      expect(SYSTEM_PROMPT).toContain("fraud_score");
      expect(SYSTEM_PROMPT).toContain("risk_level");
    });
  });

  describe("Response Validation", () => {
    it("should validate correct response structure", () => {
      const validResponse = {
        fraud_score: 50,
        risk_level: "suspicious",
        analysis: "Test analysis",
        phishing_indicators: ["Indicator 1"],
        confidence: 0.8,
      };

      expect(validateResponse(validResponse)).toBe(true);
    });

    it("should reject missing required fields", () => {
      const invalidResponse = {
        fraud_score: 50,
        risk_level: "suspicious",
        // Missing analysis, phishing_indicators, confidence
      };

      expect(validateResponse(invalidResponse)).toBe(false);
    });

    it("should reject invalid fraud_score", () => {
      const invalidResponse = {
        fraud_score: 150, // Out of range
        risk_level: "suspicious",
        analysis: "Test",
        phishing_indicators: [],
        confidence: 0.8,
      };

      expect(validateResponse(invalidResponse)).toBe(false);
    });

    it("should reject invalid risk_level", () => {
      const invalidResponse = {
        fraud_score: 50,
        risk_level: "invalid", // Not in enum
        analysis: "Test",
        phishing_indicators: [],
        confidence: 0.8,
      };

      expect(validateResponse(invalidResponse)).toBe(false);
    });

    it("should reject invalid confidence", () => {
      const invalidResponse = {
        fraud_score: 50,
        risk_level: "suspicious",
        analysis: "Test",
        phishing_indicators: [],
        confidence: 1.5, // Out of range
      };

      expect(validateResponse(invalidResponse)).toBe(false);
    });

    it("should accept optional fields", () => {
      const responseWithOptional = {
        fraud_score: 50,
        risk_level: "suspicious",
        analysis: "Test",
        phishing_indicators: [],
        confidence: 0.8,
        certificate_analysis: "Certificate is valid",
        recommendations: "Do not visit this site",
      };

      expect(validateResponse(responseWithOptional)).toBe(true);
    });
  });

  describe("Certificate Analysis", () => {
    it("should detect valid certificate", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);

      const certInfo = {
        subject: { CN: "example.com" },
        issuer: { CN: "Let's Encrypt" },
        valid_from: new Date().toISOString(),
        valid_to: futureDate.toISOString(),
      };

      expect(isCertificateValid(certInfo)).toBe(true);
    });

    it("should detect expired certificate", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const certInfo = {
        subject: { CN: "example.com" },
        issuer: { CN: "Let's Encrypt" },
        valid_from: new Date().toISOString(),
        valid_to: pastDate.toISOString(),
      };

      expect(isCertificateValid(certInfo)).toBe(false);
    });

    it("should detect self-signed certificate", () => {
      const certInfo = {
        subject: { CN: "example.com" },
        issuer: { CN: "example.com" },
      };

      expect(isSelfSigned(certInfo)).toBe(true);
    });

    it("should detect non-self-signed certificate", () => {
      const certInfo = {
        subject: { CN: "example.com" },
        issuer: { CN: "Let's Encrypt" },
      };

      expect(isSelfSigned(certInfo)).toBe(false);
    });

    it("should detect trusted issuer", () => {
      const certInfo = {
        issuer: { O: "Let's Encrypt", CN: "Let's Encrypt Authority" },
      };

      expect(isTrustedIssuer(certInfo)).toBe(true);
    });

    it("should detect untrusted issuer", () => {
      const certInfo = {
        issuer: { O: "Unknown Corp", CN: "Unknown Authority" },
      };

      expect(isTrustedIssuer(certInfo)).toBe(false);
    });

    it("should extract certificate risks", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const certInfo = {
        subject: { CN: "example.com" },
        issuer: { CN: "example.com" },
        valid_from: new Date().toISOString(),
        valid_to: pastDate.toISOString(),
      };

      const risks = extractCertificateRisks(certInfo);

      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some((r) => r.includes("expired") || r.includes("invalid"))).toBe(true);
      expect(risks.some((r) => r.includes("Self-signed"))).toBe(true);
    });

    it("should handle certificate errors", () => {
      const certInfo = {
        error: "Certificate fetch failed",
      };

      const risks = extractCertificateRisks(certInfo);

      expect(risks.length).toBeGreaterThan(0);
      expect(risks[0]).toContain("Certificate error");
    });
  });

  describe("Response Schema", () => {
    it("should have correct schema structure", () => {
      expect(RESPONSE_SCHEMA.type).toBe("object");
      expect(RESPONSE_SCHEMA.properties).toBeDefined();
      expect(RESPONSE_SCHEMA.required).toBeDefined();
    });

    it("should require all necessary fields", () => {
      const required = RESPONSE_SCHEMA.required;
      expect(required).toContain("fraud_score");
      expect(required).toContain("risk_level");
      expect(required).toContain("analysis");
      expect(required).toContain("phishing_indicators");
      expect(required).toContain("confidence");
    });

    it("should define fraud_score constraints", () => {
      const fraudScoreSchema = RESPONSE_SCHEMA.properties.fraud_score;
      expect(fraudScoreSchema.type).toBe("number");
      expect(fraudScoreSchema.minimum).toBe(0);
      expect(fraudScoreSchema.maximum).toBe(100);
    });

    it("should define risk_level enum", () => {
      const riskLevelSchema = RESPONSE_SCHEMA.properties.risk_level;
      expect(riskLevelSchema.enum).toEqual(["safe", "suspicious", "dangerous"]);
    });

    it("should define confidence constraints", () => {
      const confidenceSchema = RESPONSE_SCHEMA.properties.confidence;
      expect(confidenceSchema.type).toBe("number");
      expect(confidenceSchema.minimum).toBe(0);
      expect(confidenceSchema.maximum).toBe(1);
    });
  });
});
