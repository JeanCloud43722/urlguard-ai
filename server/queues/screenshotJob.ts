/**
 * BullMQ Screenshot Job
 * Captures screenshots of dangerous URLs and uploads to S3
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { getPlaywrightService } from '../services/playwright';
import { getS3ScreenshotService } from '../services/s3Screenshot';
import { getDb } from '../db';
import { screenshots, urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { getDeepAnalysisProcessor } from './deepAnalysisJob';
import { getBrowserFingerprintService } from '../services/browserFingerprint';
import { browserFingerprints } from '../../drizzle/schema';

export interface ScreenshotJobData {
  urlCheckId: number;
  userId: number;
  url: string;
  riskLevel: string;
  timestamp: number;
}

export interface ScreenshotJobResult {
  urlCheckId: number;
  screenshotUrl: string;
  screenshotKey: string;
  size: number;
  capturedAt: number;
  success: boolean;
}

const QUEUE_NAME = 'screenshot-capture';
const QUEUE_OPTIONS = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '0'),
  },
};

class ScreenshotJobProcessor {
  private queue: Queue<ScreenshotJobData>;
  private worker: Worker<ScreenshotJobData, ScreenshotJobResult> | null = null;
  private playwrightService = getPlaywrightService();
  private s3Service = getS3ScreenshotService();
  private fingerprintService = getBrowserFingerprintService();



  constructor() {
    this.queue = new Queue(QUEUE_NAME, QUEUE_OPTIONS);
  }

  /**
   * Initialize worker
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Playwright
      await this.playwrightService.initialize();

      // Create worker
      this.worker = new Worker<ScreenshotJobData, ScreenshotJobResult>(
        QUEUE_NAME,
        this.processScreenshotJob.bind(this),
        {
          ...QUEUE_OPTIONS,
          concurrency: 2, // Max 2 concurrent screenshot jobs
        }
      );

      // Setup event listeners
      this.setupWorkerEvents();

      console.log('[ScreenshotJob] Processor initialized');
    } catch (error) {
      console.error('[ScreenshotJob] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup worker event listeners
   */
  private setupWorkerEvents(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job<ScreenshotJobData, ScreenshotJobResult>) => {
      console.log(`[ScreenshotJob] Job completed: ${job.id}`);
    });

    this.worker.on('failed', (job: Job<ScreenshotJobData> | undefined, err: Error) => {
      console.error(`[ScreenshotJob] Job failed: ${job?.id}`, err);
    });

    this.worker.on('error', (err: Error) => {
      console.error('[ScreenshotJob] Worker error:', err);
    });
  }

  /**
   * Process screenshot job
   */
  private async processScreenshotJob(
    job: Job<ScreenshotJobData>
  ): Promise<ScreenshotJobResult> {
    const { urlCheckId, userId, url, riskLevel, timestamp } = job.data;

    console.log(`[ScreenshotJob] Processing job ${job.id}: ${url}`);

    try {
      // Only capture screenshots for dangerous URLs
      if (riskLevel !== 'dangerous') {
        console.log(`[ScreenshotJob] Skipping non-dangerous URL: ${url}`);
        return {
          urlCheckId,
          screenshotUrl: '',
          screenshotKey: '',
          size: 0,
          capturedAt: timestamp,
          success: false,
        };
      }

      // Check if URL is reachable
      const isReachable = await this.playwrightService.isUrlReachable(url, 10000);
      if (!isReachable) {
        console.warn(`[ScreenshotJob] URL not reachable: ${url}`);
        throw new Error(`URL not reachable: ${url}`);
      }

      // Capture screenshot and collect browser fingerprint
      let fingerprintData = null;
      let page = null;

      try {
        // Get page context for fingerprinting
        const browser = (this.playwrightService as any).browser;
        if (browser) {
          page = await browser.newPage();
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          
          // Detect JavaScript redirects
          const jsRedirectDetected = await page.evaluate(() => {
            const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
            if (metaRefresh) {
              const content = metaRefresh.getAttribute('content');
              const urlMatch = content?.match(/url=(.+)/i);
              return { type: 'meta-refresh', target: urlMatch?.[1] || null };
            }
            
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
              const content = script.textContent || '';
              if (content.includes('window.location') || content.includes('location.href') || content.includes('location.replace')) {
                const match = content.match(/location\.(href|replace)\s*=\s*['"]([^'"]+)['"]/);
                if (match) {
                  return { type: 'javascript', target: match[2] };
                }
              }
            }
            
            return null;
          });
          
          if (jsRedirectDetected) {
            console.log(`[ScreenshotJob] JS redirect: ${jsRedirectDetected.type} -> ${jsRedirectDetected.target}`);
          }
          
          fingerprintData = await this.fingerprintService.collectFingerprint(page);
          console.log(`[ScreenshotJob] Browser fingerprint collected for ${url}`);
        }
      } catch (fpError) {
        console.error(`[ScreenshotJob] Fingerprinting failed for ${url}:`, fpError);
      }

      const screenshotResult = await this.playwrightService.captureScreenshot({
        url,
        timeout: 30000,
        fullPage: true,
        waitForNavigation: true,
      });

      if (page) {
        await page.close();
      }

      // Generate URL hash for S3 key
      const urlHash = createHash('sha256').update(url).digest('hex').substring(0, 16);

      // Upload to S3
      const s3Result = await this.s3Service.uploadScreenshot(
        screenshotResult.buffer,
        userId,
        urlHash,
        3 // retries
      );

      // Run OCR on screenshot buffer
      let ocrText: string | null = null;
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const { data } = await worker.recognize(screenshotResult.buffer);
        ocrText = data.text.substring(0, 5000); // Limit to 5000 chars
        await worker.terminate();
        console.log(`[ScreenshotJob] OCR completed for ${url}`);
      } catch (ocrError) {
        console.error(`[ScreenshotJob] OCR failed for ${url}:`, ocrError);
      }

      // Update database with screenshot URL, OCR text, and fingerprint
      const db = await getDb();
      if (db) {
        // Store browser fingerprint if collected
        let fingerprintId = null;
        if (fingerprintData) {
          try {
            const fpResult = await db.insert(browserFingerprints).values({
              checkId: urlCheckId,
              userAgent: fingerprintData.userAgent,
              platform: fingerprintData.platform,
              languages: JSON.stringify(fingerprintData.languages),
              webGLVendor: fingerprintData.webGLVendor,
              webGLRenderer: fingerprintData.webGLRenderer,
              canvasFingerprint: fingerprintData.canvasFingerprint,
              screenResolution: fingerprintData.screenResolution,
              timezone: fingerprintData.timezone,
              plugins: JSON.stringify(fingerprintData.plugins),
              isBotLikely: fingerprintData.isBotLikely ? 1 : 0,
              botIndicators: JSON.stringify(fingerprintData.botIndicators),
              createdAt: new Date(),
            });
            console.log(`[ScreenshotJob] Fingerprint stored for ${url}`);
          } catch (fpDbError) {
            console.error(`[ScreenshotJob] Failed to store fingerprint:`, fpDbError);
          }
        }

        // Note: fingerprintProcessedAt column will be added in next migration

        await db
          .update(urlChecks)
          .set({
            screenshotUrl: s3Result.url,
            screenshotKey: s3Result.key,
            ocrExtractedText: ocrText,
            ocrProcessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(urlChecks.id, urlCheckId));

        // Also create screenshot record
        await db.insert(screenshots).values({
          urlCheckId,
          s3Key: s3Result.key,
          s3Url: s3Result.url,
          captureTime: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        });
      }

      // Fetch HTML and enqueue deep analysis job (async, non-blocking)
      try {
        // Note: For now, we skip HTML fetching to avoid double browser overhead
        // In production, consider using a headless HTTP client instead
        const htmlContent = ''; // Would be fetched here

        if (htmlContent) {
          const deepAnalysisProcessor = await getDeepAnalysisProcessor();
          await deepAnalysisProcessor.enqueueDeepAnalysis({
            urlCheckId,
            url,
            html: htmlContent,
            runDeepReanalysis: false,
            ocrText: ocrText || undefined,
          });
          console.log(`[ScreenshotJob] Deep analysis job enqueued for ${url}`);
        }
      } catch (htmlError) {
        console.error(`[ScreenshotJob] Failed to fetch HTML for ${url}:`, htmlError);
      }

      console.log(`[ScreenshotJob] Job completed successfully: ${s3Result.url}`);

      return {
        urlCheckId,
        screenshotUrl: s3Result.url,
        screenshotKey: s3Result.key,
        size: s3Result.size,
        capturedAt: s3Result.uploadedAt,
        success: true,
      };
    } catch (error) {
      console.error(`[ScreenshotJob] Job failed: ${error}`);
      throw error; // BullMQ will handle retry
    }
  }

  /**
   * Enqueue screenshot job
   */
  async enqueueScreenshot(data: ScreenshotJobData): Promise<string> {
    try {
      const job = await this.queue.add(`screenshot-${data.urlCheckId}`, data, {
        attempts: 3, // Retry 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2s, exponential backoff
        },
        removeOnComplete: true, // Remove job after completion
        removeOnFail: false, // Keep failed jobs for debugging
      });

      console.log(`[ScreenshotJob] Enqueued job: ${job.id}`);
      return job.id || '';
    } catch (error) {
      console.error('[ScreenshotJob] Failed to enqueue:', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    state: string | null;
    progress: number;
    result?: ScreenshotJobResult;
    failedReason?: string;
  } | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = 0; // BullMQ progress tracking

      return {
        state,
        progress: progress as number,
        result: job.returnvalue as ScreenshotJobResult | undefined,
        failedReason: job.failedReason,
      };
    } catch (error) {
      console.error('[ScreenshotJob] Error getting job status:', error);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const counts = await this.queue.getJobCounts();
      return {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      };
    } catch (error) {
      console.error('[ScreenshotJob] Error getting queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Gracefully shutdown
   */
  async shutdown(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.close();
      }
      await this.queue.close();
      await this.playwrightService.shutdown();
      console.log('[ScreenshotJob] Processor shut down successfully');
    } catch (error) {
      console.error('[ScreenshotJob] Error during shutdown:', error);
    }
  }
}

// Singleton instance
let processor: ScreenshotJobProcessor | null = null;

export async function getScreenshotJobProcessor(): Promise<ScreenshotJobProcessor> {
  if (!processor) {
    processor = new ScreenshotJobProcessor();
    await processor.initialize();
  }
  return processor;
}

export default ScreenshotJobProcessor;
