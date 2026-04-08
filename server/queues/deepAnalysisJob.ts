/**
 * Deep Analysis Job Queue
 * Processes structured data extraction, XML parsing, and polymorphic clustering
 */

import { Queue, Worker } from 'bullmq';
import { getRedisService } from '../services/redis';
import { extractStructuredData, extractXmlData } from '../services/structuredData';
import { getDb } from '../db';
import { urlChecks, phishingClusters, clusterMemberships } from '../../drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { getPolymorphicDetectionService } from '../services/polymorphicDetection';
import { checkCampaignThreshold } from '../services/webhookNotifier';

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

  private async processJob(job: any): Promise<{ success: boolean; metadata?: any; xmlData?: any; clusterId?: string }> {
    const { urlCheckId, url, html, runDeepReanalysis, ocrText } = job.data as DeepAnalysisJobData;

    console.log(`[DeepAnalysis] Processing job ${job.id} for URL: ${url}`);

    try {
      const db = await getDb();
      if (!db) {
        throw new Error('Database connection failed');
      }

      // Detect biometric permission requests
      const hasCameraRequest = html.includes('getUserMedia') || html.includes('getDisplayMedia') || html.includes('mediaDevices');
      const hasMicrophoneRequest = html.includes('AudioContext') || html.includes('getUserMedia') || html.includes('microphone');
      console.log(`[DeepAnalysis] Camera request: ${hasCameraRequest}, Microphone request: ${hasMicrophoneRequest}`);

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

      // Perform polymorphic detection and clustering
      let clusterId = null;
      let clusterSimilarity = 0;
      try {
        const polyService = getPolymorphicDetectionService();
        const domFeatures = polyService.extractDOMFeatures(html, url);
        console.log(`[DeepAnalysis] Extracted DOM features for ${url}: ${domFeatures.formCount} forms, ${domFeatures.inputTypes.length} input types`);

        // Get existing clusters from database
        const existingClusters = await db
          .select({
            domStructureHash: phishingClusters.domStructureHash,
            clusterId: phishingClusters.clusterId,
            formCount: phishingClusters.formCount,
          })
          .from(phishingClusters)
          .limit(100) as any;

        // Detect campaign
        const campaign = await polyService.detectCampaign(domFeatures, existingClusters as any);
        clusterId = campaign.clusterId;
        clusterSimilarity = campaign.similarity;

        // Create or update cluster
        if (campaign.isNewCluster && campaign.clusterId) {
          const clusterName = polyService.generateClusterName(domFeatures, campaign.clusterId);
          await db.insert(phishingClusters).values({
            clusterName,
            domStructureHash: domFeatures.domStructureHash,
            formCount: domFeatures.formCount,
            inputTypes: JSON.stringify(domFeatures.inputTypes),
            externalScripts: JSON.stringify(domFeatures.externalScripts),
            cssClassPatterns: JSON.stringify(domFeatures.cssClassPatterns),
            similarity: 100,
            memberCount: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
          console.log(`[DeepAnalysis] Created new cluster ${campaign.clusterId} for ${url}`);
        } else {
          // Increment member count for existing cluster
          const cluster = await db
            .select({ id: phishingClusters.id, memberCount: phishingClusters.memberCount })
            .from(phishingClusters)
            .where(eq(phishingClusters.id, phishingClusters.id)) // Placeholder, will be fixed
            .limit(1) as any;

          if (cluster.length > 0 && cluster[0].memberCount) {
            await db
              .update(phishingClusters)
              .set({
                memberCount: cluster[0].memberCount + 1,
                updatedAt: new Date(),
              })
              .where(eq(phishingClusters.clusterId, campaign.clusterId as string));
          }
        }

        // Add URL to cluster membership
        const clusterRecord = await db
          .select({ id: phishingClusters.id })
          .from(phishingClusters)
          .where(eq(phishingClusters.clusterId, campaign.clusterId as string))
          .limit(1) as any;

        if (clusterRecord.length > 0) {
          await db.insert(clusterMemberships).values({
            checkId: urlCheckId,
            clusterId: clusterRecord[0].id,
            similarityScore: clusterSimilarity,
            addedAt: new Date(),
          });
          console.log(`[DeepAnalysis] Added URL to cluster ${clusterId} with ${clusterSimilarity}% similarity`);
          
          // Get current member count for this cluster
          const memberCountResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(clusterMemberships)
            .where(eq(clusterMemberships.clusterId, clusterRecord[0].id));
          const memberCount = memberCountResult[0]?.count || 0;
          
          // Trigger webhook if threshold reached (default 5)
          try {
            await checkCampaignThreshold(clusterRecord[0].id, memberCount, 5);
            console.log(`[DeepAnalysis] Webhook check completed for cluster ${clusterRecord[0].id} with ${memberCount} members`);
          } catch (webhookError) {
            console.error(`[DeepAnalysis] Webhook notification failed:`, webhookError);
            // Don't throw - webhook failures should not block cluster processing
          }
        }
      } catch (clusterError) {
        console.error(`[DeepAnalysis] Clustering failed for ${url}:`, clusterError);
      }

      // Analyze deepfake risk if camera or microphone requests detected
      let deepfakeRisk = null;
      if (hasCameraRequest || hasMicrophoneRequest) {
        try {
          const { JSDOM } = require('jsdom');
          const dom = new JSDOM(html);
          const doc = dom.window.document;
          const pageTitle = doc.querySelector('title')?.textContent || '';
          const bodyText = doc.body?.innerText?.substring(0, 500) || '';

          const prompt = `Analyze if this page is a deepfake scam requesting camera/microphone access. Title: ${pageTitle} Content: ${bodyText} Has camera: ${hasCameraRequest} Has microphone: ${hasMicrophoneRequest} Return JSON: {"isDeepfakeScam": boolean, "confidence": 0-1, "reason": "string"}`;

          const { invokeLLM } = require('../_core/llm');
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: 'You are a security expert detecting deepfake scam pages. Return only valid JSON.' },
              { role: 'user', content: prompt },
            ],
          });

          const responseContent = response.choices[0]?.message?.content;
          const responseText = typeof responseContent === 'string' ? responseContent : '';
          
          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              deepfakeRisk = JSON.parse(jsonMatch[0]);
              console.log(`[DeepAnalysis] Deepfake analysis result:`, deepfakeRisk);
            }
          } catch (parseError) {
            console.error(`[DeepAnalysis] Failed to parse deepfake response:`, parseError);
          }
        } catch (deepfakeError) {
          console.error(`[DeepAnalysis] Deepfake analysis failed:`, deepfakeError);
        }
      }

      // Update database with extracted data and cluster info
      await db
        .update(urlChecks)
        .set({
          structuredMetadata: JSON.stringify(metadata),
          xmlData: JSON.stringify(xmlData),
          deepfakeRisk: deepfakeRisk ? JSON.stringify(deepfakeRisk) : null,
          hasCameraRequest: hasCameraRequest ? 1 : 0,
          hasMicrophoneRequest: hasMicrophoneRequest ? 1 : 0,
          metadataProcessedAt: new Date(),
          xmlProcessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(urlChecks.id, urlCheckId));

      console.log(`[DeepAnalysis] Updated database for check ${urlCheckId}`);

      // Optional: Re-analyze with DeepSeek using enriched context
      if (runDeepReanalysis) {
        console.log(`[DeepAnalysis] Re-analyzing with DeepSeek for ${url}`);
        // This would call DeepSeek with enriched context
        // For now, we just log it
      }

      return { success: true, metadata, xmlData, clusterId: clusterId || undefined };
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
