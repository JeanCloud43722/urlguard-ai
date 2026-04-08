/**
 * Browser Fingerprinting Service
 * Detects bot evasion by analyzing browser fingerprint signals
 */

import { Page } from 'playwright';
import crypto from 'crypto';

export interface BrowserFingerprintData {
  userAgent: string;
  platform: string;
  languages: string[];
  webGLVendor: string;
  webGLRenderer: string;
  canvasFingerprint: string;
  screenResolution: string;
  timezone: string;
  plugins: string[];
  isBotLikely: boolean;
  botIndicators: string[];
  botScore: number; // 0-100
}

export class BrowserFingerprintService {
  /**
   * Collect browser fingerprint from a page
   */
  async collectFingerprint(page: Page): Promise<BrowserFingerprintData> {
    try {
      const fingerprint = await page.evaluate(() => {
        // Get basic navigator properties
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        const languages = Array.from(navigator.languages || []);

        // Get WebGL info
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') as any || canvas.getContext('experimental-webgl') as any;
        const webGLVendor = gl?.getParameter?.(gl.VENDOR) || '';
        const webGLRenderer = gl?.getParameter?.(gl.RENDERER) || '';

        // Get canvas fingerprint
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#f60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('Browser Fingerprint 🖥️', 2, 15);
          ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
          ctx.fillText('Browser Fingerprint 🖥️', 4, 17);
        }
        const canvasFingerprint = canvas.toDataURL();

        // Get screen resolution
        const screenResolution = `${window.screen.width}x${window.screen.height}`;

        // Get timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Get plugins
        const plugins = Array.from(navigator.plugins || []).map((p) => p.name);

        return {
          userAgent,
          platform,
          languages,
          webGLVendor,
          webGLRenderer,
          canvasFingerprint,
          screenResolution,
          timezone,
          plugins,
        };
      });

      // Analyze for bot signals
      const botIndicators: string[] = [];
      let botScore = 0;

      // Check for headless browser indicators
      if (fingerprint.userAgent.includes('HeadlessChrome')) {
        botIndicators.push('HeadlessChrome detected');
        botScore += 25;
      }
      if (fingerprint.userAgent.includes('Playwright')) {
        botIndicators.push('Playwright detected');
        botScore += 30;
      }
      if (fingerprint.userAgent.includes('Puppeteer')) {
        botIndicators.push('Puppeteer detected');
        botScore += 30;
      }
      if (fingerprint.userAgent.includes('Selenium')) {
        botIndicators.push('Selenium detected');
        botScore += 30;
      }

      // Check for missing plugins (bots often have empty plugin list)
      if (fingerprint.plugins.length === 0) {
        botIndicators.push('No plugins detected');
        botScore += 15;
      }

      // Check for suspicious WebGL values
      if (fingerprint.webGLVendor === '' || fingerprint.webGLRenderer === '') {
        botIndicators.push('Missing WebGL info');
        botScore += 10;
      }

      // Check for generic platform
      if (fingerprint.platform === 'Linux' && fingerprint.userAgent.includes('X11')) {
        botIndicators.push('Generic Linux platform');
        botScore += 10;
      }

      // Check for missing timezone
      if (!fingerprint.timezone || fingerprint.timezone === 'UTC') {
        botIndicators.push('Generic timezone');
        botScore += 5;
      }

      // Check for single language (bots often have only one)
      if (fingerprint.languages.length <= 1) {
        botIndicators.push('Single language only');
        botScore += 5;
      }

      const isBotLikely = botScore >= 30;

      return {
        ...fingerprint,
        isBotLikely,
        botIndicators,
        botScore: Math.min(100, botScore),
      };
    } catch (error) {
      console.error('[BrowserFingerprint] Collection failed:', error);
      return {
        userAgent: '',
        platform: '',
        languages: [],
        webGLVendor: '',
        webGLRenderer: '',
        canvasFingerprint: '',
        screenResolution: '',
        timezone: '',
        plugins: [],
        isBotLikely: false,
        botIndicators: ['Fingerprint collection failed'],
        botScore: 0,
      };
    }
  }

  /**
   * Generate a hash of the fingerprint for comparison
   */
  generateFingerprintHash(fingerprint: BrowserFingerprintData): string {
    const key = `${fingerprint.userAgent}|${fingerprint.platform}|${fingerprint.webGLVendor}|${fingerprint.webGLRenderer}|${fingerprint.screenResolution}`;
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  /**
   * Detect polymorphic behavior (different content for bots vs real browsers)
   */
  async detectPolymorphicBehavior(page: Page, url: string): Promise<{
    isPolymorphic: boolean;
    indicators: string[];
    confidence: number;
  }> {
    try {
      const behavior = await page.evaluate(() => {
        // Check for common bot detection techniques
        const detectionTechniques: string[] = [];
        let confidence = 0;

        // Check for navigator.webdriver
        if ((navigator as any).webdriver) {
          detectionTechniques.push('navigator.webdriver detected');
          confidence += 30;
        }

        // Check for chrome.runtime
        if ((window as any).chrome?.runtime) {
          detectionTechniques.push('chrome.runtime present');
          confidence -= 10; // Less likely to be bot detection
        }

        // Check for eval restrictions
        try {
          eval('1+1');
        } catch (e) {
          detectionTechniques.push('eval() restricted');
          confidence += 15;
        }

        // Check for suspicious script modifications
        const originalFetch = (window as any).__originalFetch;
        if (originalFetch && originalFetch !== window.fetch) {
          detectionTechniques.push('fetch() intercepted');
          confidence += 20;
        }

        // Check for document modifications
        const docProto = Object.getOwnPropertyNames(Document.prototype);
        if (docProto.includes('__proto__')) {
          detectionTechniques.push('Document prototype modified');
          confidence += 15;
        }

        return {
          detectionTechniques,
          confidence: Math.max(0, Math.min(100, confidence)),
        };
      });

      return {
        isPolymorphic: behavior.confidence > 40,
        indicators: behavior.detectionTechniques,
        confidence: behavior.confidence,
      };
    } catch (error) {
      console.error('[BrowserFingerprint] Polymorphic detection failed:', error);
      return {
        isPolymorphic: false,
        indicators: ['Detection failed'],
        confidence: 0,
      };
    }
  }
}

export function getBrowserFingerprintService(): BrowserFingerprintService {
  return new BrowserFingerprintService();
}
