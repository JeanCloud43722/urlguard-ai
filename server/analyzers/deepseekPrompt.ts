/**
 * DeepSeek Prompt Engineering for Full-Context URL Analysis
 * Provides system prompt and user prompt builder with structured JSON schema
 * OPTIMIZED FOR HIGH SENSITIVITY: Newly registered domains and recent certificates treated as strong phishing indicators
 */

export const SYSTEM_PROMPT = `You are a cybersecurity expert specialized in phishing and fraud detection.
You have NO internet access. Base your analysis solely on the provided data.
Your task is to analyze the given URL and all associated data, then output a structured risk assessment.

CRITICAL SENSITIVITY RULES FOR PHISHING DETECTION:
1. NEW DOMAIN REGISTRATIONS: If domain is less than 30 days old, this is a STRONG phishing indicator. Add +25-30 points to fraud_score.
2. RECENT SSL CERTIFICATES: If SSL certificate was issued less than 7 days ago, this is a STRONG phishing indicator. Add +20-25 points to fraud_score.
3. SUSPICIOUS TLDS: Domains with .shop, .xyz, .download, .review, .trade, .tk, .ml, .ga, .cf combined with ANY other indicator = DANGEROUS.
4. MULTIPLE INDICATORS: If 2+ indicators present (suspicious TLD + recent cert + suspicious pattern), fraud_score MUST be >= 80.
5. BRAND IMPERSONATION: Any attempt to impersonate PayPal, Amazon, Apple, Google, Microsoft, etc. = fraud_score >= 75.

Risk Level Thresholds:
- fraud_score 0-30: risk_level = "safe"
- fraud_score 31-70: risk_level = "suspicious"
- fraud_score 71-100: risk_level = "dangerous"

Response Fields:
- fraud_score (0-100): overall risk level
- risk_level ("safe" | "suspicious" | "dangerous"): based on fraud_score thresholds above
- analysis: concise explanation of why URL is risky or safe
- phishing_indicators: list of detected indicators
- confidence (0-1): confidence in assessment
- certificate_analysis: optional SSL certificate analysis
- recommendations: optional suggestions for user

Analysis Factors (in order of importance):
1. Domain age and registration date (CRITICAL: new = high risk)
2. SSL certificate validity, issuer, and issuance date (CRITICAL: recent = high risk)
3. Suspicious patterns in URL structure
4. Known phishing indicators (TLD, keywords, subdomains)
5. Affiliate parameters and redirect chains
6. Brand impersonation attempts

IMPORTANT: Be conservative with "safe" classifications. When in doubt, classify as "suspicious" or "dangerous".
Return ONLY valid JSON matching the schema. Do not include any text outside the JSON object.`;

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
  const brandSection = formatBrandImpersonationContext(data.url);

  return `
URL to analyze: ${data.url}

${certificateSection}

${indicatorsSection}

${affiliateSection}

${brandSection}

Based on the above data and the CRITICAL SENSITIVITY RULES provided, perform a phishing/fraud analysis.

REMINDER: Apply the sensitivity rules strictly:
- Newly registered domains (< 30 days) = +25-30 points
- Recent SSL certificates (< 7 days) = +20-25 points
- Suspicious TLDs with other indicators = DANGEROUS
- Multiple indicators = fraud_score >= 80

Return a JSON object with the following structure:
{
  "fraud_score": <number 0-100>,
  "risk_level": <"safe" | "suspicious" | "dangerous">,
  "analysis": <string explaining the assessment>,
  "phishing_indicators": [<array of detected indicators>],
  "confidence": <number 0-1>,
  "certificate_analysis": <optional string>,
  "recommendations": <optional string>
}`;
}

function formatCertificateInfo(certInfo: any): string {
  if (!certInfo || Object.keys(certInfo).length === 0) {
    return "SSL Certificate: Not available (HTTP connection or certificate fetch failed)";
  }

  if (certInfo.error) {
    return `SSL Certificate: ERROR - ${certInfo.error}`;
  }

  const lines: string[] = ["SSL Certificate Information:"];

  if (certInfo.subject) {
    const subjectStr = typeof certInfo.subject === 'string' ? certInfo.subject : JSON.stringify(certInfo.subject);
    lines.push(`  Subject: ${subjectStr}`);
  }
  if (certInfo.issuer) {
    const issuerStr = typeof certInfo.issuer === 'string' ? certInfo.issuer : JSON.stringify(certInfo.issuer);
    lines.push(`  Issuer: ${issuerStr}`);
  }
  if (certInfo.validFrom) lines.push(`  Valid From: ${certInfo.validFrom}`);
  if (certInfo.validTo) lines.push(`  Valid To: ${certInfo.validTo}`);
  if (certInfo.isExpired !== undefined) lines.push(`  Expired: ${certInfo.isExpired}`);
  if (certInfo.isSelfSigned !== undefined) lines.push(`  Self-Signed: ${certInfo.isSelfSigned}`);
  if (certInfo.daysUntilExpiry !== undefined) lines.push(`  Days Until Expiry: ${certInfo.daysUntilExpiry}`);
  if (certInfo.daysSinceIssued !== undefined) {
    lines.push(`  Days Since Issued: ${certInfo.daysSinceIssued}`);
    if (certInfo.daysSinceIssued < 7) {
      lines.push(`  WARNING: Certificate issued very recently (< 7 days) - STRONG PHISHING INDICATOR`);
    }
  }

  return lines.join("\n");
}

function formatIndicators(indicators: string[]): string {
  if (!indicators || indicators.length === 0) {
    return "Heuristic Indicators: None detected";
  }

  const lines = ["Heuristic Indicators Detected:"];
  indicators.forEach((ind) => {
    lines.push(`  - ${ind}`);
  });

  return lines.join("\n");
}

function formatBrandImpersonationContext(url: string): string {
  const brandPatterns: Record<string, { keywords: string[]; risk: string }> = {
    lidl: {
      keywords: ['lidl', 'loporty', 'lidi', 'lidle'],
      risk: 'Lidl supermarket phishing - typically offers fake discounts or product deals',
    },
    amazon: {
      keywords: ['amazon', 'amazn', 'amzn'],
      risk: 'Amazon account verification phishing - attempts to steal login credentials',
    },
    paypal: {
      keywords: ['paypal', 'pay-pal', 'paypa1'],
      risk: 'PayPal account verification phishing - attempts to steal payment credentials',
    },
    apple: {
      keywords: ['apple', 'icloud', 'itunes'],
      risk: 'Apple/iCloud phishing - attempts to steal Apple ID credentials',
    },
    microsoft: {
      keywords: ['microsoft', 'outlook', 'office365'],
      risk: 'Microsoft/Office365 phishing - attempts to steal Microsoft account credentials',
    },
    google: {
      keywords: ['google', 'gmail', 'goog1e'],
      risk: 'Google/Gmail phishing - attempts to steal Google account credentials',
    },
  };

  const urlLower = url.toLowerCase();
  const detectedBrands: string[] = [];

  for (const [brand, data] of Object.entries(brandPatterns)) {
    if (data.keywords.some(kw => urlLower.includes(kw))) {
      detectedBrands.push(`${brand.toUpperCase()}: ${data.risk}`);
    }
  }

  if (detectedBrands.length > 0) {
    return `BRAND IMPERSONATION ALERT:\n${detectedBrands.map(b => `  • ${b}`).join('\n')}\n\nIf this URL contains brand impersonation, significantly increase fraud_score (add +15-25 points).`;
  }

  return 'Brand Impersonation: No obvious brand impersonation detected';
}

function formatAffiliateInfo(affiliateInfo: any): string {
  if (!affiliateInfo || !affiliateInfo.isAffiliate) {
    return "Affiliate/Redirect Parameters: None detected";
  }

  const lines = ["Affiliate/Redirect Parameters Detected:"];
  if (affiliateInfo.targetUrl) {
    lines.push(`  Original URL: ${affiliateInfo.originalUrl}`);
    lines.push(`  Target URL: ${affiliateInfo.targetUrl}`);
  }

  if (affiliateInfo.affiliateParams && Object.keys(affiliateInfo.affiliateParams).length > 0) {
    lines.push("  Affiliate Parameters:");
    Object.entries(affiliateInfo.affiliateParams).forEach(([key, value]) => {
      lines.push(`    ${key}: ${value}`);
    });
  }

  return lines.join("\n");
}

export function validateResponse(response: any): boolean {
  if (!response || typeof response !== 'object') return false;
  if (typeof response.fraud_score !== 'number' || response.fraud_score < 0 || response.fraud_score > 100) return false;
  if (!['safe', 'suspicious', 'dangerous'].includes(response.risk_level)) return false;
  if (typeof response.analysis !== 'string' || response.analysis.length === 0) return false;
  if (!Array.isArray(response.phishing_indicators)) return false;
  if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) return false;
  return true;
}

export const JSON_SCHEMA = {
  type: "object",
  properties: {
    fraud_score: {
      type: "number",
      description: "Overall risk score from 0-100",
      minimum: 0,
      maximum: 100,
    },
    risk_level: {
      type: "string",
      enum: ["safe", "suspicious", "dangerous"],
      description: "Risk classification based on fraud_score",
    },
    analysis: {
      type: "string",
      description: "Explanation of the risk assessment",
    },
    phishing_indicators: {
      type: "array",
      items: { type: "string" },
      description: "List of detected phishing indicators",
    },
    confidence: {
      type: "number",
      description: "Confidence level of the assessment",
      minimum: 0,
      maximum: 1,
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
