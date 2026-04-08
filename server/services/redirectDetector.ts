/**
 * Redirect Detection Service
 * Tracks HTTP redirects, meta-refresh, and JavaScript redirects
 */

import axios, { AxiosResponse } from 'axios';
import { URL } from 'url';

export interface RedirectHop {
  fromUrl: string;
  toUrl: string;
  statusCode: number;
  responseTimeMs: number;
}

export interface RedirectChain {
  originalUrl: string;
  finalUrl: string;
  hops: RedirectHop[];
  statusCode: number;
  redirectCount: number;
  isLikelyPhishing: boolean;
}

// Suspicious redirect patterns
const SUSPICIOUS_PATTERNS = [
  /bit\.ly|tinyurl|short\.link|rb\.gy|ow\.ly|goo\.gl/i,  // URL shorteners
  /tracking|click|redirect|affiliate|ref=/i,             // Tracking parameters
  /\.tk|\.ml|\.ga|\.cf|\.xyz|\.shop|\.download/i,       // Suspicious TLDs
  /login|verify|secure|account|signin|password/i,        // Sensitive keywords
];

export async function detectRedirectChain(url: string, maxHops = 10): Promise<RedirectChain> {
  const hops: RedirectHop[] = [];
  let currentUrl = url;
  let finalStatusCode = 0;
  
  for (let hopCount = 0; hopCount < maxHops; hopCount++) {
    try {
      const startTime = Date.now();
      const response = await axios.get(currentUrl, {
        maxRedirects: 0,           // Do NOT auto-follow
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 5000,
        headers: {
          'User-Agent': 'URLGuard-Security-Scanner/1.0',
        },
      });
      
      const responseTimeMs = Date.now() - startTime;
      finalStatusCode = response.status;
      const location = response.headers.location;
      
      // No redirect -> end of chain
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }
      
      // Resolve relative redirect URL
      const nextUrl = new URL(location, currentUrl).toString();
      
      hops.push({
        fromUrl: currentUrl,
        toUrl: nextUrl,
        statusCode: response.status,
        responseTimeMs,
      });
      
      currentUrl = nextUrl;
      
    } catch (error) {
      console.error(`[RedirectDetector] Failed at hop ${hopCount} for ${currentUrl}:`, error);
      break;
    }
  }
  
  // Analyze redirect pattern for phishing indicators
  const isLikelyPhishing = analyzeRedirectPattern(url, currentUrl, hops);
  
  return {
    originalUrl: url,
    finalUrl: currentUrl,
    hops,
    statusCode: finalStatusCode,
    redirectCount: hops.length,
    isLikelyPhishing,
  };
}

function analyzeRedirectPattern(originalUrl: string, finalUrl: string, hops: RedirectHop[]): boolean {
  // Multiple redirects are suspicious
  if (hops.length >= 3) return true;
  
  // URL shortener detected
  if (SUSPICIOUS_PATTERNS.some(p => p.test(originalUrl))) return true;
  
  // Domain changes: legitimate.com → phishing.tk
  try {
    const originalDomain = new URL(originalUrl).hostname;
    const finalDomain = new URL(finalUrl).hostname;
    
    if (originalDomain !== finalDomain) {
      // Check if final domain is suspicious
      if (SUSPICIOUS_PATTERNS.some(p => p.test(finalDomain))) return true;
    }
  } catch (e) {
    console.error('[RedirectDetector] URL parsing error:', e);
  }
  
  // Check for tracking/affiliate parameters in any hop
  for (const hop of hops) {
    if (hop.toUrl.includes('utm_') || hop.toUrl.includes('ref=') || hop.toUrl.includes('affiliate')) {
      return true;
    }
  }
  
  return false;
}

// Extract final URL after all redirects (for DeepSeek analysis)
export async function getFinalUrl(url: string, maxRedirects = 5): Promise<string> {
  try {
    const chain = await detectRedirectChain(url, maxRedirects);
    return chain.finalUrl;
  } catch (error) {
    console.error('[RedirectDetector] Error getting final URL:', error);
    return url;
  }
}

// Get singleton instance
let instance: { detectRedirectChain: typeof detectRedirectChain; getFinalUrl: typeof getFinalUrl } | null = null;

export function getRedirectDetectorService() {
  if (!instance) {
    instance = {
      detectRedirectChain,
      getFinalUrl,
    };
  }
  return instance;
}
