import { URL } from "url";

export interface AffiliateInfo {
  originalUrl: string;
  targetUrl: string;
  affiliateParams: Record<string, string>;
  isAffiliate: boolean;
}

export interface URLValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  domain: string;
  hostname: string;
  protocol: string;
  error?: string;
}

/**
 * Validate and normalize URL
 */
export function validateAndNormalizeURL(urlString: string): URLValidationResult {
  try {
    let url = urlString.trim();
    if (!url.match(/^https?:\/\//i)) {
      url = "https://" + url;
    }

    const parsed = new URL(url);

    return {
      isValid: true,
      normalizedUrl: parsed.toString(),
      domain: parsed.hostname || "",
      hostname: parsed.hostname || "",
      protocol: parsed.protocol,
    };
  } catch (error) {
    return {
      isValid: false,
      normalizedUrl: "",
      domain: "",
      hostname: "",
      protocol: "",
      error: `Invalid URL: ${(error as Error).message}`,
    };
  }
}

/**
 * Detect and extract affiliate information from URL
 */
export function extractAffiliateInfo(urlString: string): AffiliateInfo {
  const validation = validateAndNormalizeURL(urlString);

  if (!validation.isValid) {
    return {
      originalUrl: urlString,
      targetUrl: urlString,
      affiliateParams: {},
      isAffiliate: false,
    };
  }

  const parsed = new URL(validation.normalizedUrl);
  const affiliateParams: Record<string, string> = {};
  const commonAffiliateParams = [
    "tag",
    "mkcid",
    "ref",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "affiliate_id",
    "partner",
    "ref_src",
    "aff",
    "code",
  ];

  let isAffiliate = false;

  parsed.searchParams.forEach((value, key) => {
    if (commonAffiliateParams.includes(key.toLowerCase())) {
      affiliateParams[key] = value;
      isAffiliate = true;
    }
  })

  return {
    originalUrl: urlString,
    targetUrl: validation.normalizedUrl,
    affiliateParams,
    isAffiliate,
  };
}

/**
 * Check for common phishing indicators in URL
 */
export function checkPhishingIndicators(urlString: string): string[] {
  const indicators: string[] = [];
  const validation = validateAndNormalizeURL(urlString);

  if (!validation.isValid) {
    indicators.push("Invalid URL format");
    return indicators;
  }

  const parsed = new URL(validation.normalizedUrl);
  const hostname = parsed.hostname || "";
  const pathname = parsed.pathname || "";

  // Check for suspicious subdomains
  if (hostname.includes("paypal") && !hostname.endsWith("paypal.com")) {
    indicators.push("Suspicious PayPal subdomain");
  }
  if (hostname.includes("amazon") && !hostname.endsWith("amazon.com") && !hostname.endsWith("amazon.de")) {
    indicators.push("Suspicious Amazon subdomain");
  }
  if (hostname.includes("apple") && !hostname.endsWith("apple.com")) {
    indicators.push("Suspicious Apple subdomain");
  }

  // Check for IP addresses
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    indicators.push("URL uses IP address instead of domain");
  }

  // Check for suspicious TLDs
  const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf"];
  if (suspiciousTLDs.some((tld) => hostname.endsWith(tld))) {
    indicators.push("Suspicious top-level domain");
  }

  // Check for excessive subdomains
  const subdomainCount = hostname.split(".").length - 2;
  if (subdomainCount > 3) {
    indicators.push("Excessive number of subdomains");
  }

  // Check for homoglyph attacks
  if (/[0O][0O]|[1l!I]|[5S]/.test(hostname)) {
    indicators.push("Potential homoglyph attack");
  }

  // Check for suspicious path patterns
  if (pathname.includes("login") || pathname.includes("signin") || pathname.includes("verify")) {
    indicators.push("URL contains login/verification keywords");
  }

  // Check for encoded characters
  if (pathname.includes("%") || hostname.includes("%")) {
    indicators.push("URL contains encoded characters");
  }

  return indicators;
}

/**
 * Extract domain parts for comparison
 */
export function extractDomainParts(hostname: string): { subdomain: string; domain: string; tld: string } {
  const parts = hostname.split(".");

  if (parts.length < 2) {
    return { subdomain: "", domain: hostname, tld: "" };
  }

  if (parts.length === 2) {
    return { subdomain: "", domain: parts[0], tld: parts[1] };
  }

  const tld = parts[parts.length - 1];
  const domain = parts[parts.length - 2];
  const subdomain = parts.slice(0, -2).join(".");

  return { subdomain, domain, tld };
}

/**
 * Calculate similarity between two domains
 */
export function calculateDomainSimilarity(domain1: string, domain2: string): number {
  const s1 = domain1.toLowerCase();
  const s2 = domain2.toLowerCase();

  if (s1 === s2) return 1;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  const editDistance = getLevenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function getLevenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}
