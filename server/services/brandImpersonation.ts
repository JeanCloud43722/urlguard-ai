/**
 * Brand Impersonation Detector Service
 * Identifies phishing attempts that impersonate well-known brands
 * Provides detailed explanations for brand-specific phishing patterns
 */

export interface BrandMatch {
  brand: string;
  confidence: number; // 0-1
  indicators: string[];
  explanation: string;
  riskBoost: number; // Additional points to add to fraud_score
}

// Known brand phishing patterns
const BRAND_PATTERNS: Record<string, {
  keywords: string[];
  domains: string[];
  patterns: RegExp[];
  description: string;
  riskBoost: number;
}> = {
  lidl: {
    keywords: ['lidl', 'lidi', 'lidle', 'liddl', 'lödl', 'lÖdl'],
    domains: ['loporty.shop', 'lidl-shop.shop', 'lidl-offer.shop', 'lidl-deals.shop'],
    patterns: [
      /lidl.*shop/i,
      /lidi.*shop/i,
      /lidle.*shop/i,
      /loporty/i,
    ],
    description: 'Lidl supermarket phishing - typically offers fake discounts or product deals',
    riskBoost: 15,
  },
  amazon: {
    keywords: ['amazon', 'amazn', 'amzn', 'amazone'],
    domains: ['amazon-verify.shop', 'amazon-account.shop', 'amazon-secure.shop'],
    patterns: [
      /amazon.*verify/i,
      /amazon.*account/i,
      /amazon.*secure/i,
      /amazn.*shop/i,
    ],
    description: 'Amazon account verification phishing - attempts to steal login credentials',
    riskBoost: 20,
  },
  paypal: {
    keywords: ['paypal', 'pay-pal', 'paypa1', 'paypa|'],
    domains: ['paypal-verify.shop', 'paypal-secure.shop', 'paypal-confirm.shop'],
    patterns: [
      /paypal.*verify/i,
      /paypal.*confirm/i,
      /paypal.*secure/i,
      /pay-pal/i,
    ],
    description: 'PayPal account verification phishing - attempts to steal payment credentials',
    riskBoost: 20,
  },
  apple: {
    keywords: ['apple', 'icloud', 'itunes', 'appstore'],
    domains: ['apple-verify.shop', 'icloud-verify.shop', 'apple-secure.shop'],
    patterns: [
      /apple.*verify/i,
      /icloud.*verify/i,
      /apple.*secure/i,
      /itunes.*verify/i,
    ],
    description: 'Apple/iCloud phishing - attempts to steal Apple ID credentials',
    riskBoost: 18,
  },
  microsoft: {
    keywords: ['microsoft', 'outlook', 'office365', 'windows'],
    domains: ['microsoft-verify.shop', 'outlook-verify.shop', 'office365-verify.shop'],
    patterns: [
      /microsoft.*verify/i,
      /outlook.*verify/i,
      /office365.*verify/i,
      /windows.*verify/i,
    ],
    description: 'Microsoft/Office365 phishing - attempts to steal Microsoft account credentials',
    riskBoost: 18,
  },
  google: {
    keywords: ['google', 'gmail', 'goog1e', 'gogle'],
    domains: ['google-verify.shop', 'gmail-verify.shop', 'google-secure.shop'],
    patterns: [
      /google.*verify/i,
      /gmail.*verify/i,
      /goog1e/i,
      /gogle/i,
    ],
    description: 'Google/Gmail phishing - attempts to steal Google account credentials',
    riskBoost: 18,
  },
  bank: {
    keywords: ['bank', 'banking', 'secure-login', 'verify-account'],
    domains: ['bank-verify.shop', 'banking-secure.shop', 'bank-confirm.shop'],
    patterns: [
      /bank.*verify/i,
      /banking.*secure/i,
      /secure.*login/i,
      /verify.*account/i,
    ],
    description: 'Generic banking phishing - attempts to steal banking credentials',
    riskBoost: 20,
  },
};

/**
 * Detect brand impersonation in URL and content
 */
export function detectBrandImpersonation(url: string, pageContent?: string): BrandMatch | null {
  const fullText = `${url} ${pageContent || ''}`.toLowerCase();

  let bestMatch: BrandMatch | null = null;
  let bestConfidence = 0;

  for (const [brandName, brandData] of Object.entries(BRAND_PATTERNS)) {
    let confidence = 0;
    const indicators: string[] = [];

    // Check keywords
    const keywordMatches = brandData.keywords.filter(kw => fullText.includes(kw.toLowerCase()));
    if (keywordMatches.length > 0) {
      confidence += 0.3;
      indicators.push(`Contains brand keywords: ${keywordMatches.join(', ')}`);
    }

    // Check domain patterns
    const domainMatches = brandData.domains.filter(d => url.toLowerCase().includes(d));
    if (domainMatches.length > 0) {
      confidence += 0.4;
      indicators.push(`Matches known phishing domain: ${domainMatches.join(', ')}`);
    }

    // Check regex patterns
    const patternMatches = brandData.patterns.filter(p => p.test(url));
    if (patternMatches.length > 0) {
      confidence += 0.3;
      indicators.push(`URL structure matches ${brandName} phishing pattern`);
    }

    // Boost confidence if .shop TLD is present (common for phishing)
    if (url.includes('.shop')) {
      confidence += 0.1;
      indicators.push('Uses suspicious .shop TLD (common for phishing)');
    }

    // Boost confidence if URL contains suspicious keywords
    const suspiciousKeywords = ['verify', 'confirm', 'secure', 'login', 'account', 'update', 'urgent'];
    const suspiciousMatches = suspiciousKeywords.filter(kw => url.toLowerCase().includes(kw));
    if (suspiciousMatches.length > 0) {
      confidence += 0.2;
      indicators.push(`Contains suspicious keywords: ${suspiciousMatches.join(', ')}`);
    }

    // Normalize confidence to 0-1
    confidence = Math.min(confidence, 1);

    if (confidence > bestConfidence && confidence > 0.3) {
      bestConfidence = confidence;
      bestMatch = {
        brand: brandName.toUpperCase(),
        confidence,
        indicators,
        explanation: generateBrandExplanation(brandName, brandData, indicators),
        riskBoost: brandData.riskBoost,
      };
    }
  }

  return bestMatch;
}

/**
 * Generate detailed explanation for brand impersonation
 */
function generateBrandExplanation(
  brandName: string,
  brandData: typeof BRAND_PATTERNS[keyof typeof BRAND_PATTERNS],
  indicators: string[]
): string {
  const indicatorList = indicators.map(i => `• ${i}`).join('\n');

  return `BRAND IMPERSONATION DETECTED: ${brandName.toUpperCase()}

This URL appears to be impersonating ${brandName.toUpperCase()} to trick users.

${brandData.description}

Detected Indicators:
${indicatorList}

WHAT TO DO:
1. Do NOT enter your credentials on this site
2. Do NOT click any links or download files
3. Report this phishing attempt to the legitimate ${brandName.toUpperCase()} company
4. Delete any suspicious emails or messages that led you to this site

LEGITIMATE CONTACT INFO:
- Lidl: support@lidl.com or visit lidl.com directly
- Amazon: amazon.com/contact-us or amazon.com directly
- PayPal: paypal.com/contact or paypal.com directly
- Apple: support.apple.com or apple.com directly
- Microsoft: support.microsoft.com or microsoft.com directly
- Google: support.google.com or google.com directly`;
}

/**
 * Get brand-specific risk boost for fraud score
 */
export function getBrandRiskBoost(url: string, pageContent?: string): number {
  const match = detectBrandImpersonation(url, pageContent);
  if (match && match.confidence > 0.5) {
    return match.riskBoost;
  }
  return 0;
}

/**
 * Check if URL is a known phishing domain
 */
export function isKnownPhishingDomain(url: string): boolean {
  for (const brandData of Object.values(BRAND_PATTERNS)) {
    if (brandData.domains.some(d => url.toLowerCase().includes(d))) {
      return true;
    }
  }
  return false;
}

/**
 * Get all detected brands in URL
 */
export function getAllDetectedBrands(url: string, pageContent?: string): BrandMatch[] {
  const brands: BrandMatch[] = [];
  const fullText = `${url} ${pageContent || ''}`.toLowerCase();

  for (const [brandName, brandData] of Object.entries(BRAND_PATTERNS)) {
    let confidence = 0;
    const indicators: string[] = [];

    const keywordMatches = brandData.keywords.filter(kw => fullText.includes(kw.toLowerCase()));
    if (keywordMatches.length > 0) {
      confidence += 0.3;
      indicators.push(`Contains brand keywords: ${keywordMatches.join(', ')}`);
    }

    const domainMatches = brandData.domains.filter(d => url.toLowerCase().includes(d));
    if (domainMatches.length > 0) {
      confidence += 0.4;
      indicators.push(`Matches known phishing domain: ${domainMatches.join(', ')}`);
    }

    const patternMatches = brandData.patterns.filter(p => p.test(url));
    if (patternMatches.length > 0) {
      confidence += 0.3;
      indicators.push(`URL structure matches ${brandName} phishing pattern`);
    }

    if (url.includes('.shop')) {
      confidence += 0.1;
      indicators.push('Uses suspicious .shop TLD (common for phishing)');
    }

    confidence = Math.min(confidence, 1);

    if (confidence > 0.3 && indicators.length > 0) {
      brands.push({
        brand: brandName.toUpperCase(),
        confidence,
        indicators,
        explanation: generateBrandExplanation(brandName, brandData, indicators),
        riskBoost: brandData.riskBoost,
      });
    }
  }

  return brands.sort((a, b) => b.confidence - a.confidence);
}
