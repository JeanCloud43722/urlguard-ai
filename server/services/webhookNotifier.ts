/**
 * Webhook Notification Service
 * Sends POST requests to registered webhooks when campaign size exceeds threshold
 */

import axios from 'axios';
import { getDb } from '../db';
import { webhooks, phishingClusters } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

export interface WebhookPayload {
  event: 'campaign_detected' | 'dangerous_url_detected';
  timestamp: string;
  data: {
    campaignId?: number;
    campaignSize?: number;
    memberUrls?: string[];
    url?: string;
    riskScore?: number;
    riskLevel?: string;
  };
}

/**
 * Send notifications to all registered webhooks for a given event
 */
export async function notifyWebhooks(event: 'campaign_detected' | 'dangerous_url_detected', payload: any) {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[Webhook] Database connection failed');
      return;
    }

    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.eventType, event), eq(webhooks.isActive, 1)));

    console.log(`[Webhook] Found ${activeWebhooks.length} active webhooks for event: ${event}`);

    for (const webhook of activeWebhooks) {
      try {
        const response = await axios.post(
          webhook.url,
          {
            event,
            timestamp: new Date().toISOString(),
            data: payload,
          },
          {
            headers: webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {},
            timeout: 5000,
          }
        );

        console.log(`[Webhook] Sent ${event} to ${webhook.url} - Status: ${response.status}`);
      } catch (error) {
        console.error(`[Webhook] Failed to send to ${webhook.url}:`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error('[Webhook] Error in notifyWebhooks:', error);
  }
}

/**
 * Check if a campaign has reached the notification threshold and send webhook if needed
 */
export async function checkCampaignThreshold(clusterId: number, memberCount: number, threshold = 5) {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[Webhook] Database connection failed');
      return;
    }

    console.log(`[Webhook] Checking campaign ${clusterId} with ${memberCount} members against threshold ${threshold}`);

    if (memberCount >= threshold) {
      const cluster = await db
        .select()
        .from(phishingClusters)
        .where(eq(phishingClusters.id, clusterId))
        .limit(1);

      if (cluster.length === 0) {
        console.warn(`[Webhook] Cluster ${clusterId} not found`);
        return;
      }

      const clusterData = cluster[0];

      // Send webhook notification
      await notifyWebhooks('campaign_detected', {
        campaignId: clusterId,
        campaignSize: memberCount,
        campaignName: clusterData.clusterName,
        domStructureHash: clusterData.domStructureHash,
        similarity: clusterData.similarity,
      });

      console.log(`[Webhook] Campaign ${clusterId} notification sent`);
    }
  } catch (error) {
    console.error('[Webhook] Error in checkCampaignThreshold:', error);
  }
}

/**
 * Send dangerous URL notification
 */
export async function notifyDangerousUrl(url: string, riskScore: number, riskLevel: string) {
  try {
    await notifyWebhooks('dangerous_url_detected', {
      url,
      riskScore,
      riskLevel,
    });
  } catch (error) {
    console.error('[Webhook] Error in notifyDangerousUrl:', error);
  }
}
