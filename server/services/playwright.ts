/**
 * Playwright Screenshot Service
 * Captures screenshots of URLs with browser lifecycle management
 */

import { chromium, Browser, Page } from 'playwright';
import { ENV } from '../_core/env';

export interface ScreenshotOptions {
  url: string;
  timeout?: number; // milliseconds
  fullPage?: boolean;
  waitForNavigation?: boolean;
}

export interface ScreenshotResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  timestamp: number;
}

class PlaywrightService {
  private browser: Browser | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize browser (lazy loading)
   * Called once per worker instance
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Prevent multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[Playwright] Initializing browser...');
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--disable-dev-shm-usage', // Reduce memory usage
            '--disable-gpu', // Disable GPU
            '--no-sandbox', // For Docker
            '--disable-setuid-sandbox',
          ],
        });
        this.isInitialized = true;
        console.log('[Playwright] Browser initialized successfully');
      } catch (error) {
        console.error('[Playwright] Failed to initialize browser:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Capture screenshot of URL
   */
  async captureScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const {
      url,
      timeout = 30000, // 30 seconds default
      fullPage = true,
      waitForNavigation = true,
    } = options;

    let page: Page | null = null;

    try {
      console.log(`[Playwright] Capturing screenshot for: ${url}`);

      // Create new page
      page = await this.browser.newPage();

      // Set viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Navigate to URL with timeout
      const navigationPromise = page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      if (waitForNavigation) {
        await navigationPromise;
      }

      // Wait for page to settle
      await page.waitForTimeout(1000);

      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage,
        type: 'png',
      });

      // Get page dimensions
      const dimensions = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));

      console.log(`[Playwright] Screenshot captured successfully: ${screenshotBuffer.length} bytes`);

      return {
        buffer: screenshotBuffer as Buffer,
        mimeType: 'image/png',
        width: dimensions.width,
        height: dimensions.height,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Playwright] Screenshot capture failed for ${url}:`, error);
      throw new Error(`Screenshot capture failed: ${(error as Error).message}`);
    } finally {
      // Close page but keep browser alive
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.warn('[Playwright] Error closing page:', err);
        }
      }
    }
  }

  /**
   * Check if URL is reachable
   */
  async isUrlReachable(url: string, timeout: number = 5000): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.browser) {
      return false;
    }

    let page: Page | null = null;

    try {
      page = await this.browser.newPage();
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
      return response?.ok() ?? false;
    } catch (error) {
      console.warn(`[Playwright] URL not reachable: ${url}`, error);
      return false;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.warn('[Playwright] Error closing page:', err);
        }
      }
    }
  }

  /**
   * Gracefully shutdown browser
   */
  async shutdown(): Promise<void> {
    if (this.browser) {
      try {
        console.log('[Playwright] Shutting down browser...');
        await this.browser.close();
        this.browser = null;
        this.isInitialized = false;
        console.log('[Playwright] Browser shut down successfully');
      } catch (error) {
        console.error('[Playwright] Error during shutdown:', error);
      }
    }
  }

  /**
   * Get browser status
   */
  getStatus(): {
    isInitialized: boolean;
    isConnected: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.browser?.isConnected() ?? false,
    };
  }
}

// Singleton instance per worker
let playwrightService: PlaywrightService | null = null;

export function getPlaywrightService(): PlaywrightService {
  if (!playwrightService) {
    playwrightService = new PlaywrightService();
  }
  return playwrightService;
}

export default PlaywrightService;
