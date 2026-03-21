/**
 * DeepSeek Prompt Engineering for Full-Context URL Analysis
 * Provides system prompt and user prompt builder with structured JSON schema
 */

export const SYSTEM_PROMPT = `You are a cybersecurity expert specialized in phishing and fraud detection.
You have NO internet access. Base your analysis solely on the provided data.
Your task is to analyze the given URL and all associated data, then output a structured risk assessment.

Use the following fields in your response:
- fraud_score (0-100): overall risk level.
- risk_level ("safe" | "suspicious" | "dangerous"): based on fraud_score.
- analysis: a concise, user-friendly explanation of why the URL is risky or safe.
- phishing_indicators: list of detected indicators (strings).
- confidence (0-1): how confident you are in your assessment.
- certificate_analysis: optional analysis of SSL certificate (if provided).
- recommendations: optional short suggestions for the user.

Be objective and precise. Do not invent data. Consider:
1. Domain reputation and age
2. SSL certificate validity and issuer
3. Suspicious patterns in URL structure
4. Known phishing indicators
5. Affiliate parameters and redirects
6. Brand impersonation attempts

Return ONLY valid JSON matching the schema.`;

export interface ContextData {
  url: string;
  certificateInfo: any;
  heuristicIndicators: string[];
  affiliateInfo: any;
}

export function buildUserPrompt(data: ContextData): string {
  const certificateSection = formatCertificateInfo(data.certificateInfo);
  const indicatorsSection = formatIndicators(data.heuristicIndicators);
  const affiliateSection = formatAffiliateInfo(data.affiliateInfo);

  return `
URL to analyze: ${data.url}

${certificateSection}

${indicatorsSection}

${affiliateSection}

Based on the above data, perform a phishing/fraud analysis. Return a JSON object with the following structure:
{
  "fraud_score": <number 0-100>,
  "risk_level": <"safe" | "suspicious" | "dangerous">,
  "analysis": <string explaining the assessment>,
  "phishing_indicators": [<array of detected indicators>],
  "confidence": <number 0-1>,
  "certificate_analysis": <optional string>,
  "recommendations": <optional string>
}

IMPORTANT: Return ONLY the JSON object, no additional text.`;
}

function formatCertificateInfo(certInfo: any): string {
  if (!certInfo || Object.keys(certInfo).length === 0) {
    return "SSL Certificate Details: Not available (HTTP or certificate fetch failed)";
  }

  if (certInfo.error) {
    return `SSL Certificate Details: Error - ${certInfo.error}`;
  }

  const lines: string[] = ["SSL Certificate Details:"];

  if (certInfo.subject) {
    lines.push(`  Subject: ${JSON.stringify(certInfo.subject)}`);
  }
  if (certInfo.issuer) {
    lines.push(`  Issuer: ${JSON.stringify(certInfo.issuer)}`);
  }
  if (certInfo.valid_from) {
    lines.push(`  Valid From: ${certInfo.valid_from}`);
  }
  if (certInfo.valid_to) {
    lines.push(`  Valid To: ${certInfo.valid_to}`);
  }
  if (certInfo.fingerprint) {
    lines.push(`  Fingerprint: ${certInfo.fingerprint}`);
  }
  if (certInfo.serialNumber) {
    lines.push(`  Serial Number: ${certInfo.serialNumber}`);
  }

  // Check for self-signed
  if (certInfo.subject && certInfo.issuer) {
    const isSelfSigned = JSON.stringify(certInfo.subject) === JSON.stringify(certInfo.issuer);
    if (isSelfSigned) {
      lines.push("  ⚠️ WARNING: Self-signed certificate (not trusted by browsers)");
    }
  }

  return lines.join("\n");
}

function formatIndicators(indicators: string[]): string {
  if (!indicators || indicators.length === 0) {
    return "Heuristic Indicators: None detected (URL appears normal)";
  }

  const lines = ["Heuristic Indicators (detected by local rules):"];
  indicators.forEach((indicator) => {
    lines.push(`  • ${indicator}`);
  });

  return lines.join("\n");
}

function formatAffiliateInfo(affiliateInfo: any): string {
  if (!affiliateInfo || Object.keys(affiliateInfo).length === 0) {
    return "Affiliate Parameters: None detected";
  }

  const lines = ["Affiliate Parameters (if any):"];

  if (affiliateInfo.hasAffiliateParams) {
    lines.push(`  Has Affiliate Parameters: Yes`);
  }
  if (affiliateInfo.parameters && Object.keys(affiliateInfo.parameters).length > 0) {
    lines.push("  Parameters:");
    Object.entries(affiliateInfo.parameters).forEach(([key, value]) => {
      lines.push(`    ${key}: ${value}`);
    });
  }
  if (affiliateInfo.suspiciousRedirects) {
    lines.push(`  Suspicious Redirects: ${affiliateInfo.suspiciousRedirects.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * JSON Schema for response validation
 */
export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fraud_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Overall risk level score",
    },
    risk_level: {
      type: "string",
      enum: ["safe", "suspicious", "dangerous"],
      description: "Risk level category",
    },
    analysis: {
      type: "string",
      description: "User-friendly explanation of the assessment",
    },
    phishing_indicators: {
      type: "array",
      items: {
        type: "string",
      },
      description: "List of detected phishing indicators",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence level of the assessment",
    },
    certificate_analysis: {
      type: "string",
      description: "Optional analysis of SSL certificate",
    },
    recommendations: {
      type: "string",
      description: "Optional recommendations for the user",
    },
  },
  required: ["fraud_score", "risk_level", "analysis", "phishing_indicators", "confidence"],
  additionalProperties: false,
};

/**
 * Validate response against schema
 */
export function validateResponse(response: any): boolean {
  if (!response || typeof response !== "object") {
    return false;
  }

  // Check required fields
  const requiredFields = ["fraud_score", "risk_level", "analysis", "phishing_indicators", "confidence"];
  for (const field of requiredFields) {
    if (!(field in response)) {
      return false;
    }
  }

  // Validate types
  if (typeof response.fraud_score !== "number" || response.fraud_score < 0 || response.fraud_score > 100) {
    return false;
  }

  if (!["safe", "suspicious", "dangerous"].includes(response.risk_level)) {
    return false;
  }

  if (typeof response.analysis !== "string") {
    return false;
  }

  if (!Array.isArray(response.phishing_indicators)) {
    return false;
  }

  if (typeof response.confidence !== "number" || response.confidence < 0 || response.confidence > 1) {
    return false;
  }

  return true;
}
