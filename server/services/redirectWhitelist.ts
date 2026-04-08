/**
 * Redirect Whitelist Service
 * Checks if redirect chains match trusted patterns
 */

import { getDb } from '../db';
import { redirectWhitelist, trustedRedirectPairs } from '../../drizzle/schema';
import { eq, and, like } from 'drizzle-orm';

export interface WhitelistCheckResult {
  isWhitelisted: boolean;
  reason?: string;
  matchedRule?: string;
}

/**
 * Check if a redirect chain matches trusted patterns
 */
export async function checkRedirectWhitelist(
  originalUrl: string,
  finalUrl: string,
  hopCount: number
): Promise<WhitelistCheckResult> {
  try {
    const db = await getDb();
    if (!db) return { isWhitelisted: false };

    // Extract domains
    let originalDomain = '';
    let finalDomain = '';
    try {
      originalDomain = new URL(originalUrl).hostname || '';
      finalDomain = new URL(finalUrl).hostname || '';
    } catch (e) {
      console.error('[Whitelist] URL parsing error:', e);
      return { isWhitelisted: false };
    }

    // Check source pattern whitelist (e.g., bit.ly, tinyurl.com)
    const sourceMatches = await db
      .select()
      .from(redirectWhitelist)
      .where(and(eq(redirectWhitelist.isActive, 1)));

    for (const rule of sourceMatches) {
      if (!rule.sourcePattern) continue;

      // Check if original domain matches pattern
      const sourceRegex = new RegExp(rule.sourcePattern.replace(/\*/g, '.*'), 'i');
      if (sourceRegex.test(originalDomain)) {
        // Check hop count limit
        if (rule.allowedHopCount && hopCount > rule.allowedHopCount) {
          continue;
        }

        // If target pattern specified, check it too
        if (rule.targetPattern) {
          const targetRegex = new RegExp(rule.targetPattern.replace(/\*/g, '.*'), 'i');
          if (!targetRegex.test(finalDomain)) {
            continue;
          }
        }

        return {
          isWhitelisted: true,
          reason: rule.reason || 'Trusted redirect pattern',
          matchedRule: `${rule.sourcePattern} → ${rule.targetPattern || '*'}`,
        };
      }
    }

    // Check trusted domain pairs (e.g., google.com → accounts.google.com)
    const pairMatches = await db
      .select()
      .from(trustedRedirectPairs)
      .where(
        and(
          eq(trustedRedirectPairs.fromDomain, originalDomain),
          eq(trustedRedirectPairs.toDomain, finalDomain),
          eq(trustedRedirectPairs.isActive, 1)
        )
      )
      .limit(1);

    if (pairMatches.length > 0) {
      return {
        isWhitelisted: true,
        reason: 'Trusted domain pair',
        matchedRule: `${originalDomain} → ${finalDomain}`,
      };
    }

    return { isWhitelisted: false };
  } catch (error) {
    console.error('[Whitelist] Check failed:', error);
    return { isWhitelisted: false };
  }
}

/**
 * Add a new whitelist rule
 */
export async function addWhitelistRule(
  sourcePattern: string,
  targetPattern: string | null,
  allowedHopCount: number,
  reason: string,
  createdBy: string
) {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    const result = await db.insert(redirectWhitelist).values({
      sourcePattern,
      targetPattern,
      allowedHopCount,
      reason,
      isActive: 1,
      createdBy,
      createdAt: new Date(),
    });

    console.log('[Whitelist] Rule added:', sourcePattern);
    return result;
  } catch (error) {
    console.error('[Whitelist] Failed to add rule:', error);
    throw error;
  }
}

/**
 * Add a trusted domain pair
 */
export async function addTrustedPair(fromDomain: string, toDomain: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    const result = await db.insert(trustedRedirectPairs).values({
      fromDomain,
      toDomain,
      isActive: 1,
      createdAt: new Date(),
    });

    console.log('[Whitelist] Trusted pair added:', `${fromDomain} → ${toDomain}`);
    return result;
  } catch (error) {
    console.error('[Whitelist] Failed to add trusted pair:', error);
    throw error;
  }
}

/**
 * Get all active whitelist rules
 */
export async function getWhitelistRules() {
  try {
    const db = await getDb();
    if (!db) return [];

    const rules = await db
      .select()
      .from(redirectWhitelist)
      .where(eq(redirectWhitelist.isActive, 1));

    return rules;
  } catch (error) {
    console.error('[Whitelist] Failed to fetch rules:', error);
    return [];
  }
}

/**
 * Get all trusted domain pairs
 */
export async function getTrustedPairs() {
  try {
    const db = await getDb();
    if (!db) return [];

    const pairs = await db
      .select()
      .from(trustedRedirectPairs)
      .where(eq(trustedRedirectPairs.isActive, 1));

    return pairs;
  } catch (error) {
    console.error('[Whitelist] Failed to fetch trusted pairs:', error);
    return [];
  }
}
