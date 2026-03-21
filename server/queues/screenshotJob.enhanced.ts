/**
 * ENHANCED VERSION: BullMQ Screenshot Job with Idempotency & Metrics
 * 
 * This file shows the enhanced processScreenshotJob method with:
 * 1. Idempotency check (skip if screenshot already exists)
 * 2. Prometheus metrics integration
 * 
 * Apply these changes to server/queues/screenshotJob.ts
 */

import { getScreenshotMetrics } from '../metrics/screenshotMetrics';
import { getDb } from '../db';
import { urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * REPLACE the existing processScreenshotJob method with this enhanced version
 */
export async function processScreenshotJobEnhanced(
  this: any, // ScreenshotJobProcessor context
  job: any // Job<ScreenshotJobData>
): Promise<any> {
  const { urlCheckId, userId, url, riskLevel, timestamp } = job.data;
  const startTime = Date.now();
  const metrics = getScreenshotMetrics();

  console.log(`[ScreenshotJob] Processing job ${job.id}: ${url}`);

  try {
    // 1. Only capture screenshots for dangerous URLs
    if (riskLevel !== 'dangerous') {
      console.log(`[ScreenshotJob] Skipping non-dangerous URL: ${url}`);
      metrics.recordSkipped();
      return {
        urlCheckId,
        screenshotUrl: '',
        screenshotKey: '',
        size: 0,
        capturedAt: timestamp,
        success: false,
      };
    }

    // 2. IDEMPOTENCY CHECK: Skip if screenshot already exists
    const db = await getDb();
    if (db) {
      const existing = await db
        .select()
        .from(urlChecks)
        .where(eq(urlChecks.id, urlCheckId))
        .limit(1);

      if (existing[0]?.screenshotUrl) {
        console.log(
          `[ScreenshotJob] Screenshot already exists for URL check ${urlCheckId}, skipping capture (idempotent)`
        );
        metrics.recordSkipped();
        return {
          urlCheckId,
          screenshotUrl: existing[0].screenshotUrl,
          screenshotKey: existing[0].screenshotKey || '',
          size: 0,
          capturedAt: timestamp,
          success: true, // Mark as success (idempotent)
        };
      }
    }

    // 3. Check if URL is reachable
    const isReachable = await this.playwrightService.isUrlReachable(url, 10000);
    if (!isReachable) {
      console.warn(`[ScreenshotJob] URL not reachable: ${url}`);
      throw new Error(`URL not reachable: ${url}`);
    }

    // 4. Capture screenshot
    const screenshotResult = await this.playwrightService.captureScreenshot({
      url,
      timeout: 30000,
      fullPage: true,
      waitForNavigation: true,
    });

    // 5. Generate URL hash for S3 key
    const { createHash } = require('crypto');
    const urlHash = createHash('sha256').update(url).digest('hex').substring(0, 16);

    // 6. Upload to S3
    const s3Result = await this.s3Service.uploadScreenshot(
      screenshotResult.buffer,
      userId,
      urlHash,
      3 // retries
    );

    // 7. Update database with screenshot URL
    if (db) {
      const { screenshots } = require('../../drizzle/schema');

      await db
        .update(urlChecks)
        .set({
          screenshotUrl: s3Result.url,
          screenshotKey: s3Result.key,
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

    // 8. Record success metric
    const durationSeconds = (Date.now() - startTime) / 1000;
    metrics.recordSuccess(durationSeconds);

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
    // 9. Record failure metric
    const durationSeconds = (Date.now() - startTime) / 1000;
    metrics.recordFailure(durationSeconds);

    console.error(`[ScreenshotJob] Job failed: ${error}`);
    throw error; // BullMQ will handle retry
  }
}

/**
 * ALSO ADD THIS METHOD to ScreenshotJobProcessor class:
 * 
 * Call this periodically (e.g., every 10 seconds) to update queue length metric
 */
export async function updateQueueMetrics(this: any): Promise<void> {
  try {
    const stats = await this.queue.getJobCounts();
    const metrics = getScreenshotMetrics();
    
    const totalPending = (stats.waiting || 0) + (stats.delayed || 0);
    metrics.setQueueLength(totalPending);
    
    console.log(`[ScreenshotJob] Queue metrics updated: ${totalPending} pending jobs`);
  } catch (error) {
    console.error('[ScreenshotJob] Error updating queue metrics:', error);
  }
}

/**
 * INTEGRATION INSTRUCTIONS:
 * 
 * 1. In ScreenshotJobProcessor.initialize():
 *    - Call updateQueueMetrics every 10 seconds
 *    - Example:
 *      setInterval(() => this.updateQueueMetrics(), 10000);
 * 
 * 2. Replace processScreenshotJob method with processScreenshotJobEnhanced
 * 
 * 3. Add imports at top of screenshotJob.ts:
 *    import { getScreenshotMetrics } from '../metrics/screenshotMetrics';
 * 
 * 4. The metrics will be automatically collected by prom-client
 *    and exposed via the existing /metrics endpoint
 */
