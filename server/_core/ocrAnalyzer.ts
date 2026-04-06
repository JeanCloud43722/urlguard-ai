/**
 * OCR Phishing Analyzer
 * Detects phishing indicators in extracted OCR text
 */

export type IndicatorType =
  | 'urgency'
  | 'fake_login'
  | 'email'
  | 'phone'
  | 'typosquatting'
  | 'cta'
  | 'credential_harvest';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface OCRPhishingIndicator {
  type: IndicatorType;
  text: string;
  confidence: number;
  risk: RiskLevel;
}

// Pattern definitions for phishing detection
const URGENCY_PATTERNS = [
  /act\s+now/i,
  /verify\s+immediately/i,
  /confirm\s+identity/i,
  /update\s+payment/i,
  /urgent\s+action/i,
  /limited\s+time/i,
  /expire[ds]?/i,
  /click\s+here/i,
  /don't\s+wait/i,
  /action\s+required/i,
];

const FAKE_LOGIN_PATTERNS = [
  /enter\s+your\s+password/i,
  /sign\s+in\s+required/i,
  /login\s+to\s+continue/i,
  /authenticate\s+now/i,
  /verify\s+account/i,
  /re-enter\s+credentials/i,
  /confirm\s+password/i,
  /session\s+expired/i,
];

const CREDENTIAL_HARVEST_PATTERNS = [
  /username/i,
  /password/i,
  /credit\s+card/i,
  /card\s+number/i,
  /cvv/i,
  /social\s+security/i,
  /ssn/i,
  /bank\s+account/i,
];

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN =
  /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;

// Typosquatting patterns
const TYPOSQUATTING_PATTERNS = [
  /paypa1/i,
  /paypa!/i,
  /amaz0n/i,
  /amaz0n/i,
  /micr0soft/i,
  /microso1t/i,
  /goog1e/i,
  /goog!e/i,
  /facebookk/i,
  /faceb00k/i,
];

/**
 * Detect all phishing indicators in OCR text
 */
export function detectPhishingIndicators(
  text: string,
  domain: string
): OCRPhishingIndicator[] {
  const indicators: OCRPhishingIndicator[] = [];
  const normalizedText = text.toLowerCase();

  // Detect urgency language
  URGENCY_PATTERNS.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      indicators.push({
        type: 'urgency',
        text: matches[0],
        confidence: 0.8,
        risk: 'high',
      });
    }
  });

  // Detect fake login prompts
  FAKE_LOGIN_PATTERNS.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      indicators.push({
        type: 'fake_login',
        text: matches[0],
        confidence: 0.9,
        risk: 'high',
      });
    }
  });

  // Detect credential harvesting language
  CREDENTIAL_HARVEST_PATTERNS.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      indicators.push({
        type: 'credential_harvest',
        text: matches[0],
        confidence: 0.75,
        risk: 'high',
      });
    }
  });

  // Extract and validate emails
  const emails = text.match(EMAIL_PATTERN) || [];
  const uniqueEmails = Array.from(new Set(emails));
  uniqueEmails.forEach((email) => {
    const emailDomain = email.split('@')[1];
    // Check if email domain matches URL domain
    if (!domain.includes(emailDomain)) {
      indicators.push({
        type: 'email',
        text: email,
        confidence: 0.7,
        risk: 'medium',
      });
    }
  });

  // Extract phone numbers
  const phones = text.match(PHONE_PATTERN) || [];
  const uniquePhones = Array.from(new Set(phones));
  uniquePhones.forEach((phone) => {
    indicators.push({
      type: 'phone',
      text: phone,
      confidence: 0.6,
      risk: 'low',
    });
  });

  // Detect typosquatting
  TYPOSQUATTING_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        indicators.push({
          type: 'typosquatting',
          text: match[0],
          confidence: 0.85,
          risk: 'high',
        });
      }
    }
  });

  // Detect suspicious CTAs
  const ctaPatterns = [
    /verify\s+now/i,
    /confirm\s+now/i,
    /update\s+now/i,
    /secure\s+account/i,
  ];
  ctaPatterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      indicators.push({
        type: 'cta',
        text: matches[0],
        confidence: 0.7,
        risk: 'medium',
      });
    }
  });

  // Remove duplicates based on text
  const uniqueIndicators = indicators.filter(
    (indicator, index, self) =>
      index ===
      self.findIndex(
        (i) =>
          i.text.toLowerCase() === indicator.text.toLowerCase() &&
          i.type === indicator.type
      )
  );

  return uniqueIndicators;
}

/**
 * Generate OCR analysis summary with risk assessment
 */
export function generateOCRSummary(
  indicators: OCRPhishingIndicator[]
): {
  summary: string;
  riskIncrease: number;
  indicatorCount: number;
} {
  const highRiskCount = indicators.filter((i) => i.risk === 'high').length;
  const mediumRiskCount = indicators.filter((i) => i.risk === 'medium').length;
  const lowRiskCount = indicators.filter((i) => i.risk === 'low').length;

  // Calculate risk increase
  const riskIncrease = highRiskCount * 15 + mediumRiskCount * 8 + lowRiskCount * 2;

  // Generate summary
  const parts: string[] = [];
  if (highRiskCount > 0) parts.push(`${highRiskCount} high-risk`);
  if (mediumRiskCount > 0) parts.push(`${mediumRiskCount} medium-risk`);
  if (lowRiskCount > 0) parts.push(`${lowRiskCount} low-risk`);

  const summary =
    parts.length > 0
      ? `OCR Analysis: Detected ${parts.join(' and ')} indicators in page text.`
      : 'OCR Analysis: No phishing indicators detected in page text.';

  return {
    summary,
    riskIncrease,
    indicatorCount: indicators.length,
  };
}

/**
 * Calculate OCR-based risk score adjustment (0-100)
 */
export function calculateOCRRiskAdjustment(
  indicators: OCRPhishingIndicator[]
): number {
  if (indicators.length === 0) return 0;

  const highRiskCount = indicators.filter((i) => i.risk === 'high').length;
  const mediumRiskCount = indicators.filter((i) => i.risk === 'medium').length;

  // Cap at 40 points to avoid overwhelming other indicators
  return Math.min(highRiskCount * 15 + mediumRiskCount * 8, 40);
}

/**
 * Categorize indicators by type for detailed analysis
 */
export function categorizeIndicators(
  indicators: OCRPhishingIndicator[]
): Record<IndicatorType, OCRPhishingIndicator[]> {
  const categories: Record<IndicatorType, OCRPhishingIndicator[]> = {
    urgency: [],
    fake_login: [],
    email: [],
    phone: [],
    typosquatting: [],
    cta: [],
    credential_harvest: [],
  };

  indicators.forEach((indicator) => {
    categories[indicator.type].push(indicator);
  });

  return categories;
}

/**
 * Generate detailed OCR analysis report
 */
export function generateOCRReport(
  text: string,
  indicators: OCRPhishingIndicator[]
): {
  textLength: number;
  indicatorCount: number;
  highRiskCount: number;
  categories: Record<IndicatorType, number>;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
} {
  const categories = categorizeIndicators(indicators);
  const highRiskCount = indicators.filter((i) => i.risk === 'high').length;
  const { summary } = generateOCRSummary(indicators);

  // Determine risk level based on indicators
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (highRiskCount >= 3) {
    riskLevel = 'high';
  } else if (highRiskCount >= 1 || indicators.length >= 5) {
    riskLevel = 'medium';
  }

  return {
    textLength: text.length,
    indicatorCount: indicators.length,
    highRiskCount,
    categories: {
      urgency: categories.urgency.length,
      fake_login: categories.fake_login.length,
      email: categories.email.length,
      phone: categories.phone.length,
      typosquatting: categories.typosquatting.length,
      cta: categories.cta.length,
      credential_harvest: categories.credential_harvest.length,
    },
    summary,
    riskLevel,
  };
}
