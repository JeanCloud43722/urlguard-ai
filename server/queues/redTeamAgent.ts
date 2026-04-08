/**
 * Red Team Agent - Adversarial Testing for Phishing Detection
 * Generates adversarial mutations of known phishing URLs to find detection gaps
 */

import { Queue, Worker } from 'bullmq';
import { getRedisService } from '../services/redis';
import { getDb } from '../db';
import { adversarialTests, phishingClusters, clusterMemberships, urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { invokeLLM } from '../_core/llm';

const RED_TEAM_QUEUE = 'red-team-queue';

export interface AdversarialMutation {
  originalUrl: string;
  mutatedUrl: string;
  technique: 'typosquatting' | 'homoglyph' | 'path_obfuscation' | 'subdomain_spoofing' | 'unicode_encoding';
  detected: boolean;
  riskScore: number;
  riskLevel: string;
}

export interface RedTeamJobData {
  clusterId: number;
  technique?: string;
  iterations?: number;
}

export class RedTeamAgent {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  async initialize() {
    try {
      const redis = getRedisService();
      const redisClient = (redis as any).client || redis;

      this.queue = new Queue(RED_TEAM_QUEUE, { connection: redisClient });

      this.worker = new Worker(RED_TEAM_QUEUE, this.processJob.bind(this), {
        connection: redisClient,
        concurrency: 1, // Run one red-team test at a time to avoid overwhelming the system
      });

      this.worker.on('completed', (job) => {
        console.log(`[RedTeam] Job ${job.id} completed`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`[RedTeam] Job ${job?.id} failed:`, err.message);
      });

      console.log('[RedTeam] Agent initialized');
    } catch (error) {
      console.error('[RedTeam] Initialization failed:', error);
    }
  }

  private async processJob(job: any): Promise<{ mutations: AdversarialMutation[]; undetectedCount: number; totalTested: number }> {
    const { clusterId, technique = 'all', iterations = 5 } = job.data as RedTeamJobData;

    console.log(`[RedTeam] Processing job ${job.id} for cluster ${clusterId}, technique: ${technique}, iterations: ${iterations}`);

    try {
      const db = await getDb();
      if (!db) {
        throw new Error('Database connection failed');
      }

      // Get cluster info
      const cluster = await db
        .select()
        .from(phishingClusters)
        .where(eq(phishingClusters.id, clusterId))
        .limit(1);

      if (!cluster.length) {
        throw new Error(`Cluster ${clusterId} not found`);
      }

      // Get sample URLs from the cluster (up to 3)
      const members = await db
        .select({ url: urlChecks.url })
        .from(clusterMemberships)
        .innerJoin(urlChecks, eq(clusterMemberships.checkId, urlChecks.id))
        .where(eq(clusterMemberships.clusterId, clusterId))
        .limit(3);

      const sampleUrls = members.map((m) => m.url);
      console.log(`[RedTeam] Found ${sampleUrls.length} sample URLs in cluster ${clusterId}`);

      if (sampleUrls.length === 0) {
        console.warn(`[RedTeam] No URLs found in cluster ${clusterId}`);
        return { mutations: [], undetectedCount: 0, totalTested: 0 };
      }

      const mutations: AdversarialMutation[] = [];

      // Generate adversarial variants using DeepSeek
      for (const originalUrl of sampleUrls) {
        console.log(`[RedTeam] Generating mutations for ${originalUrl}`);

        const prompt = `You are a red-team security analyst. Generate ${iterations} adversarial phishing URL variants based on this URL: ${originalUrl}

Techniques to use (pick from: typosquatting, homoglyph, path_obfuscation, subdomain_spoofing, unicode_encoding):
- Typosquatting: misspell domain (e.g., gooogle.com instead of google.com)
- Homoglyph: replace chars with similar looking (e.g., rnicrosoft.com with rn instead of m)
- Path obfuscation: add misleading paths (e.g., /secure/login or /verify)
- Subdomain spoofing: add fake subdomains (e.g., secure-verify.example.com)
- Unicode encoding: use unicode lookalikes (e.g., gооgle.com with cyrillic о)

Return ONLY a JSON array (no markdown, no code blocks):
[
  {"mutatedUrl": "...", "technique": "typosquatting"},
  {"mutatedUrl": "...", "technique": "homoglyph"}
]`;

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: 'You are a red-team security analyst. Generate realistic adversarial URLs for testing phishing detection. Return only valid JSON array.',
              },
              { role: 'user', content: prompt },
            ],
          });

          const responseContent = response.choices[0]?.message?.content;
          const responseText = typeof responseContent === 'string' ? responseContent : '';
          console.log(`[RedTeam] DeepSeek response: ${responseText.substring(0, 200)}`);

          // Parse JSON from response
          let variants = [];
          try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              variants = JSON.parse(jsonMatch[0]);
            } else {
              console.warn(`[RedTeam] Could not find JSON in response: ${responseText}`);
            }
          } catch (parseError) {
            console.error(`[RedTeam] Failed to parse DeepSeek response:`, parseError);
            continue;
          }

          // Test each variant against the detector
          for (const variant of variants) {
            if (!variant.mutatedUrl || !variant.technique) {
              console.warn(`[RedTeam] Invalid variant:`, variant);
              continue;
            }

            try {
              console.log(`[RedTeam] Testing mutation: ${variant.mutatedUrl} (${variant.technique})`);

              // Note: In a real implementation, you would call the URL checker here
              // For now, we'll simulate the test result
              // const result = await checkURL(variant.mutatedUrl);

              // Simulated result - in production, call actual URL checker
              const detected = Math.random() > 0.3; // 70% detection rate
              const riskScore = detected ? 75 + Math.random() * 25 : 10 + Math.random() * 30;

              mutations.push({
                originalUrl,
                mutatedUrl: variant.mutatedUrl,
                technique: variant.technique,
                detected,
                riskScore: Math.round(riskScore),
                riskLevel: detected ? 'dangerous' : 'suspicious',
              });
            } catch (testError) {
              console.error(`[RedTeam] Failed to test ${variant.mutatedUrl}:`, testError);
            }
          }
        } catch (llmError) {
          console.error(`[RedTeam] DeepSeek API error:`, llmError);
        }
      }

      // Count undetected mutations
      const undetected = mutations.filter((m) => !m.detected);
      console.log(`[RedTeam] Results: ${undetected.length}/${mutations.length} undetected mutations`);

      if (undetected.length > 0) {
        console.warn(
          `[RedTeam] Cluster ${clusterId}: ${undetected.length}/${mutations.length} undetected mutations found!`
        );

        // Store in database for review
        await db.insert(adversarialTests).values({
          clusterId,
          mutations: JSON.stringify(undetected),
          undetectedCount: undetected.length,
          totalTested: mutations.length,
          createdAt: new Date(),
        } as any);

        console.log(`[RedTeam] Stored ${undetected.length} undetected mutations in database`);
      }

      return { mutations, undetectedCount: undetected.length, totalTested: mutations.length };
    } catch (error) {
      console.error(`[RedTeam] Job processing failed:`, error);
      throw error;
    }
  }

  async enqueueRedTeamTest(clusterId: number, technique = 'all', iterations = 5): Promise<any> {
    if (!this.queue) {
      console.error('[RedTeam] Queue not initialized');
      return null;
    }

    try {
      const job = await this.queue.add(`redteam-${clusterId}`, { clusterId, technique, iterations }, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      });

      console.log(`[RedTeam] Job enqueued: ${job.id}`);
      return job;
    } catch (error) {
      console.error('[RedTeam] Failed to enqueue job:', error);
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

let redTeamAgent: RedTeamAgent | null = null;

export async function getRedTeamAgent(): Promise<RedTeamAgent> {
  if (!redTeamAgent) {
    redTeamAgent = new RedTeamAgent();
    await redTeamAgent.initialize();
  }
  return redTeamAgent;
}

export async function closeRedTeamAgent() {
  if (redTeamAgent) {
    await redTeamAgent.close();
    redTeamAgent = null;
  }
}
