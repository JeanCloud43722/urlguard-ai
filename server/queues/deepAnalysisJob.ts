/**
 * Deep Analysis Job Queue
 * Processes structured data extraction, XML parsing, and optional DeepSeek re-analysis
 */

import { Queue, Worker } from 'bullmq';
import { getRedisService } from '../services/redis';
import { extractStructuredData, extractXmlData } from '../services/structuredData';
import { getDb } from '../db';
import { urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const DEEP_ANALYSIS_QUEUE = 'deep-analysis-queue';

export interface DeepAnalysisJobData {
  urlCheckId: number;
  url: string;
  html: string;
  runDeepReanalysis?: boolean;
  ocrText?: string;
}

export class DeepAnalysisProcessor {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  async initialize() {
    try {
      const redis = getRedisService();
      const redisClient = (redis as any).client || redis;

      this.queue = new Queue(DEEP_ANALYSIS_QUEUE, { connection: redisClient });

      this.worker = new Worker(DEEP_ANALYSIS_QUEUE, this.processJob.bind(this), {
        connection: redisClient,
        concurrency: 2,
      });

      this.worker.on('completed', (job) => {
        console.log(`[DeepAnalysis] Job ${job.id} completed`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`[DeepAnalysis] Job ${job?.id} failed:`, err.message);
      });

      console.log('[DeepAnalysis] Processor initialized');
    } catch (error) {
      console.error('[DeepAnalysis] Initialization failed:', error);
    }
  }

  private async processJob(job: any): Promise<{ success: boolean; metadata?: any; xmlData?: any }> {
    const { urlCheckId, url, html, runDeepReanalysis, ocrText } = job.data as DeepAnalysisJobData;

    console.log(`[DeepAnalysis] Processing job ${job.id} for URL: ${url}`);

    try {
      const db = await getDb();
      if (!db) {
        throw new Error('Database connection failed');
      }

      // Extract structured metadata from HTML
      const metadata = await extractStructuredData(html, url);
      console.log(`[DeepAnalysis] Extracted metadata for ${url}`);

      // Extract XML data (sitemap, RSS)
      let xmlData = null;
      try {
        xmlData = await extractXmlData(url);
        console.log(`[DeepAnalysis] Extracted XML data for ${url}`);
      } catch (xmlError) {
        console.error(`[DeepAnalysis] XML extraction failed for ${url}:`, xmlError);
      }

      // Update database with extracted data
      await db
        .update(urlChecks)
        .set({
          structuredMetadata: JSON.stringify(metadata),
          xmlData: JSON.stringify(xmlData),
          metadataProcessedAt: new Date(),
          xmlProcessedAt: new Date(),
        })
        .where(eq(urlChecks.id, urlCheckId));

      console.log(`[DeepAnalysis] Updated database for check ${urlCheckId}`);

      // Optional: Re-analyze with DeepSeek using enriched context
      if (runDeepReanalysis) {
        console.log(`[DeepAnalysis] Re-analyzing with DeepSeek for ${url}`);
        // This would call DeepSeek with enriched context
        // For now, we just log it
      }

      return { success: true, metadata, xmlData };
    } catch (error) {
      console.error(`[DeepAnalysis] Job processing failed:`, error);
      throw error;
    }
  }

  async enqueueDeepAnalysis(data: DeepAnalysisJobData): Promise<any> {
    if (!this.queue) {
      console.error('[DeepAnalysis] Queue not initialized');
      return null;
    }

    try {
      const job = await this.queue.add(`deep-${data.urlCheckId}`, data, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      });

      console.log(`[DeepAnalysis] Job enqueued: ${job.id}`);
      return job;
    } catch (error) {
      console.error('[DeepAnalysis] Failed to enqueue job:', error);
      return null;
    }
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}

let deepAnalysisProcessor: DeepAnalysisProcessor | null = null;

export async function getDeepAnalysisProcessor(): Promise<DeepAnalysisProcessor> {
  if (!deepAnalysisProcessor) {
    deepAnalysisProcessor = new DeepAnalysisProcessor();
    await deepAnalysisProcessor.initialize();
  }
  return deepAnalysisProcessor;
}

export async function closeDeepAnalysisProcessor() {
  if (deepAnalysisProcessor) {
    await deepAnalysisProcessor.close();
    deepAnalysisProcessor = null;
  }
}
