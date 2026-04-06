import { Queue, Worker } from 'bullmq';
import { extractTextFromImage, normalizeOCRText } from '../_core/ocr';
import { detectPhishingIndicators, generateOCRSummary } from '../_core/ocrAnalyzer';
import * as db from '../db';

/**
 * OCR Job Queue
 * Handles asynchronous OCR processing for screenshots
 */

export interface OCRJobData {
  checkId: number;
  userId: number;
  screenshotBuffer: Buffer;
  domain: string;
}

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// Create OCR queue
export const ocrQueue = new Queue<OCRJobData>('ocr', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Queue OCR job for processing
 */
export async function queueOCRAnalysis(data: OCRJobData): Promise<void> {
  try {
    await ocrQueue.add('analyze', data, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });
    console.log(`OCR job queued for check ${data.checkId}`);
  } catch (error) {
    console.error('Failed to queue OCR job:', error);
    throw error;
  }
}

/**
 * OCR job worker - processes screenshots and extracts text
 */
const ocrWorker = new Worker<OCRJobData>(
  'ocr',
  async (job) => {
    const { checkId, userId, screenshotBuffer, domain } = job.data;

    try {
      console.log(`Processing OCR for check ${checkId}`);

      // Extract text from screenshot
      const ocrResult = await extractTextFromImage({
        imageBuffer: screenshotBuffer,
        timeout: 15000,
      });

      console.log(
        `OCR extraction completed: ${ocrResult.text.length} chars, ${ocrResult.confidence * 100}% confidence`
      );

      // Normalize text
      const normalizedText = normalizeOCRText(ocrResult.text);

      // Detect phishing indicators
      const indicators = detectPhishingIndicators(normalizedText, domain);
      const { summary, riskIncrease } = generateOCRSummary(indicators);

      console.log(
        `Detected ${indicators.length} phishing indicators, risk increase: +${riskIncrease}`
      );

      // Store OCR results in database
      await db.createOCRAnalysis({
        checkId,
        userId,
        extractedText: normalizedText,
        detectedIndicators: JSON.stringify(indicators),
        confidence: Math.round(ocrResult.confidence * 100),
        language: ocrResult.language,
        processingTime: ocrResult.processingTime,
      });

      // Update URL check with OCR data
      await db.updateCheck(checkId, {
        phishingReasons: JSON.stringify({
          text: normalizedText,
          indicators,
          confidence: ocrResult.confidence,
          riskIncrease,
          summary,
        }),
      });

      console.log(`OCR analysis completed for check ${checkId}`);

      return {
        success: true,
        checkId,
        indicatorCount: indicators.length,
        riskIncrease,
        textLength: normalizedText.length,
        processingTime: ocrResult.processingTime,
      };
    } catch (error) {
      console.error(`OCR job failed for check ${checkId}:`, error);

      // Store error in database
      try {
        await db.updateCheck(checkId, {
          phishingReasons: JSON.stringify({
            error: 'OCR processing failed',
            message: (error as Error).message,
          }),
        });
      } catch (dbError) {
        console.error('Failed to update check with OCR error:', dbError);
      }

      throw error;
    }
  },
  {
    connection: redisConfig,
    concurrency: 2, // Process max 2 OCR jobs concurrently
  }
);

// Worker event handlers
ocrWorker.on('completed', (job) => {
  console.log(`✓ OCR job completed: ${job.id}`);
});

ocrWorker.on('failed', (job, err) => {
  console.error(`✗ OCR job failed: ${job?.id} - ${err.message}`);
});

ocrWorker.on('error', (err) => {
  console.error('OCR worker error:', err);
});

/**
 * Get OCR job status
 */
export async function getOCRJobStatus(jobId: string) {
  try {
    const job = await ocrQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      state: await job.getState(),
      progress: typeof job.progress === 'function' ? job.progress() : 0,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  } catch (error) {
    console.error('Failed to get OCR job status:', error);
    return null;
  }
}

/**
 * Clean up OCR queue
 */
export async function cleanOCRQueue(): Promise<void> {
  try {
    await ocrQueue.clean(3600000, 1000); // Clean jobs older than 1 hour
    console.log('OCR queue cleaned');
  } catch (error) {
    console.error('Failed to clean OCR queue:', error);
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownOCRQueue(): Promise<void> {
  try {
    await ocrWorker.close();
    await ocrQueue.close();
    console.log('OCR queue and worker shut down gracefully');
  } catch (error) {
    console.error('Error during OCR queue shutdown:', error);
  }
}

export { ocrWorker };
