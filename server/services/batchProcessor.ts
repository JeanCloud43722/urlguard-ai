/**
 * BullMQ Batch Processor
 * Handles asynchronous batch URL analysis with progress tracking
 */

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { getRedisService } from './redis';
import { getDeepSeekClient } from '../analyzers/deepseekEnhanced';
import { validateAndNormalizeURL, checkPhishingIndicators, extractAffiliateInfo } from '../analyzers/urlAnalyzer';
import { fetchCertificate, extractCertificateRisks } from '../utils/certificate';
import { createURLCheck } from '../db';

export interface BatchJob {
  id: string;
  userId: number;
  urls: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results: any[];
  createdAt: number;
  completedAt?: number;
}

export interface BatchJobData {
  userId: number;
  urls: string[];
  jobId: string;
}

const QUEUE_NAME = 'url-analysis-batch';
const QUEUE_OPTIONS = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
};

class BatchProcessor {
  private queue: Queue<BatchJobData>;
  private worker: Worker<BatchJobData> | null = null;
  private scheduler: any = null;
  private redisService = getRedisService();

  constructor() {
    this.queue = new Queue(QUEUE_NAME, QUEUE_OPTIONS);
    this.setupQueueEvents();
  }

  /**
   * Initialize worker and scheduler
   */
  async initialize(): Promise<void> {
    // Note: QueueScheduler is optional for basic batch processing

    // Create worker with concurrency limit
    this.worker = new Worker<BatchJobData>(QUEUE_NAME, this.processJob.bind(this), {
      ...QUEUE_OPTIONS,
      concurrency: 2, // Process 2 batches concurrently
    });

    this.worker.on('completed', (job: any) => {
      console.log(`[BullMQ] Job completed: ${job.id}`);
    });

    this.worker.on('failed', (job: any, err: Error) => {
      console.error(`[BullMQ] Job failed: ${job?.id}`, err);
    });

    console.log('[BullMQ] Batch processor initialized');
  }

  /**
   * Setup queue event listeners
   */
  private setupQueueEvents(): void {
    this.queue.on('waiting', (job: any) => {
      console.log(`[BullMQ] Job waiting: ${job.id}`);
    });

    // Active event tracking handled by worker

    this.queue.on('progress', (job: any, progress: any) => {
      console.log(`[BullMQ] Job progress: ${job.id} - ${progress}%`);
    });

    this.queue.on('error', (err: Error) => {
      console.error('[BullMQ] Queue error:', err);
    });
  }

  /**
   * Enqueue a batch job
   */
  async enqueueBatch(userId: number, urls: string[]): Promise<string> {
    const jobId = `batch-${userId}-${Date.now()}`;

    try {
      const job = await this.queue.add(
        QUEUE_NAME,
        {
          userId,
          urls,
          jobId,
        },
        {
          jobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Remove completed jobs after 1 hour
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
          },
        }
      );

      console.log(`[BullMQ] Batch enqueued: ${jobId} with ${urls.length} URLs`);

      // Publish job created event
      await this.redisService.publish(`batch:${userId}`, {
        event: 'created',
        jobId,
        totalUrls: urls.length,
        timestamp: Date.now(),
      });

      return jobId;
    } catch (error) {
      console.error('[BullMQ] Failed to enqueue batch:', error);
      throw error;
    }
  }

  /**
   * Process individual batch job
   */
  private async processJob(job: any): Promise<any> {
    const { userId, urls, jobId } = job.data as BatchJobData;
    const results: any[] = [];
    const deepseekClient = getDeepSeekClient();

    console.log(`[BullMQ] Processing batch: ${jobId} (${urls.length} URLs)`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      try {
        // Update progress
        const progress = Math.round((i / urls.length) * 100);
        job.progress(progress);

        // Publish progress event
        await this.redisService.publish(`batch:${userId}`, {
          event: 'progress',
          jobId,
          processed: i + 1,
          total: urls.length,
          progress,
          currentUrl: url,
          timestamp: Date.now(),
        });

        // Analyze URL
        const validation = validateAndNormalizeURL(url);
        if (!validation.isValid) {
          results.push({
            url,
            error: validation.error,
            riskLevel: 'invalid',
          });
          continue;
        }

        // Check cache first
        const urlHash = Buffer.from(validation.normalizedUrl).toString('base64');
        const cached = await this.redisService.getAnalysisCache(urlHash);
        if (cached) {
          results.push(cached);
          continue;
        }

        // Get certificate info
        let certificateInfo: any = {};
        let certificateRisks: string[] = [];
        if (validation.normalizedUrl.startsWith('https://')) {
          try {
            const hostname = new URL(validation.normalizedUrl).hostname;
            if (hostname) {
              const certCached = await this.redisService.getCertificateCache(hostname);
              if (certCached) {
                certificateInfo = certCached;
              } else {
                certificateInfo = await fetchCertificate(hostname);
                await this.redisService.setCertificateCache(hostname, certificateInfo);
              }
              certificateRisks = extractCertificateRisks(certificateInfo);
            }
          } catch (err) {
            console.warn('[BullMQ] Certificate fetch error:', err);
            certificateInfo = { error: 'Failed to retrieve certificate' };
          }
        }

        // Get indicators
        const localIndicators = checkPhishingIndicators(validation.normalizedUrl);
        const affiliateInfo = extractAffiliateInfo(validation.normalizedUrl);

        // Analyze with DeepSeek
        const analysis = await deepseekClient.analyzeWithFullContext(
          validation.normalizedUrl,
          certificateInfo,
          [...localIndicators, ...certificateRisks],
          affiliateInfo
        );

        // Save to database
        await createURLCheck({
          userId,
          url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          phishingReasons: JSON.stringify([...localIndicators, ...certificateRisks, ...analysis.phishingIndicators]),
          deepseekAnalysis: JSON.stringify(analysis),
          affiliateInfo: JSON.stringify(affiliateInfo),
        });

        // Cache result
        const result = {
          url,
          normalizedUrl: validation.normalizedUrl,
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          analysis: analysis.analysis,
          confidence: analysis.confidence,
        };

        await this.redisService.setAnalysisCache(urlHash, result);
        results.push(result);

        // Increment metrics
        await this.redisService.incrementMetric(`batch_urls_processed`);
        await this.redisService.incrementMetric(`batch_${analysis.riskLevel}`);
      } catch (error) {
        console.error(`[BullMQ] Error processing URL ${url}:`, error);
        results.push({
          url,
          error: (error as Error).message,
          riskLevel: 'error',
        });
      }
    }

    // Publish completion event
    await this.redisService.publish(`batch:${userId}`, {
      event: 'completed',
      jobId,
      totalUrls: urls.length,
      results,
      timestamp: Date.now(),
    });

    console.log(`[BullMQ] Batch completed: ${jobId}`);
    return { jobId, results };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progressValue = 0; // BullMQ progress tracking

      return {
        jobId,
        state,
        progress: progressValue,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
      };
    } catch (error) {
      console.error('[BullMQ] Error getting job status:', error);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    try {
      const counts = await this.queue.getJobCounts();
      const waiting = await this.queue.getWaitingCount();
      const active = await this.queue.getActiveCount();
      const completed = await this.queue.getCompletedCount();
      const failed = await this.queue.getFailedCount();

      return {
        waiting,
        active,
        completed,
        failed,
        ...counts,
      };
    } catch (error) {
      console.error('[BullMQ] Error getting queue stats:', error);
      return {};
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.scheduler) {
      await this.scheduler.close();
    }
    await this.queue.close();
    console.log('[BullMQ] Batch processor shut down');
  }
}

// Singleton instance
let batchProcessor: BatchProcessor | null = null;

export async function getBatchProcessor(): Promise<BatchProcessor> {
  if (!batchProcessor) {
    batchProcessor = new BatchProcessor();
    await batchProcessor.initialize();
  }
  return batchProcessor;
}

export default BatchProcessor;
