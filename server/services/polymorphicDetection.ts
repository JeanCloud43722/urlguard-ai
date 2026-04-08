/**
 * Polymorphic Detection & Clustering Service
 * Identifies structurally similar phishing pages and clusters them into campaigns
 */

import crypto from 'crypto';

export interface DOMStructureFeatures {
  formCount: number;
  inputTypes: string[];
  externalScripts: string[];
  cssClassPatterns: string[];
  iframeCount: number;
  imageCount: number;
  linkCount: number;
  domStructureHash: string;
}

export interface ClusterInfo {
  clusterId: string;
  clusterName: string;
  memberCount: number;
  similarity: number;
  domStructureHash: string;
  formCount?: number;
  inputTypes?: string[];
  externalScripts?: string[];
}

export class PolymorphicDetectionService {
  /**
   * Extract DOM structure features from HTML
   */
  extractDOMFeatures(html: string, url: string): DOMStructureFeatures {
    try {
      // Parse HTML using regex (lightweight approach)
      const formMatches = html.match(/<form[\s>]/gi) || [];
      const formCount = formMatches.length;

      // Extract input types
      const inputMatches = html.match(/<input[^>]*type=["']([^"']+)["']/gi) || [];
      const inputTypes = Array.from(new Set(
        inputMatches.map((m) => {
          const match = m.match(/type=["']([^"']+)["']/i);
          return match ? match[1].toLowerCase() : 'text';
        })
      ));

      // Extract external script domains
      const scriptMatches = html.match(/<script[^>]*src=["']([^"']+)["']/gi) || [];
      const externalScripts = Array.from(
        new Set(
          scriptMatches
            .map((m) => {
              const match = m.match(/src=["']([^"']+)["']/i);
              if (!match) return '';
              try {
                return new URL(match[1], url).hostname || '';
              } catch {
                return '';
              }
            })
            .filter(Boolean)
        )
      );

      // Extract CSS class patterns
      const classMatches = html.match(/class=["']([^"']+)["']/gi) || [];
      const cssClassPatterns = Array.from(
        new Set(
          classMatches.map((m) => {
            const match = m.match(/class=["']([^"']+)["']/i);
            return match ? match[1].split(/\s+/)[0] : ''; // Get first class
          }).filter(Boolean)
        )
      ).slice(0, 10); // Limit to 10 patterns

      // Count other elements
      const iframeCount = (html.match(/<iframe[\s>]/gi) || []).length;
      const imageCount = (html.match(/<img[\s>]/gi) || []).length;
      const linkCount = (html.match(/<a[\s>]/gi) || []).length;

      // Generate DOM structure hash
      const structureKey = `${formCount}|${inputTypes.join(',')}|${externalScripts.join(',')}|${iframeCount}|${imageCount}`;
      const domStructureHash = crypto
        .createHash('sha256')
        .update(structureKey)
        .digest('hex')
        .substring(0, 16);

      return {
        formCount,
        inputTypes,
        externalScripts,
        cssClassPatterns,
        iframeCount,
        imageCount,
        linkCount,
        domStructureHash,
      };
    } catch (error) {
      console.error('[PolymorphicDetection] Feature extraction failed:', error);
      return {
        formCount: 0,
        inputTypes: [],
        externalScripts: [],
        cssClassPatterns: [],
        iframeCount: 0,
        imageCount: 0,
        linkCount: 0,
        domStructureHash: '',
      };
    }
  }

  /**
   * Calculate similarity between two DOM structures (0-100)
   */
  calculateSimilarity(features1: DOMStructureFeatures, features2: DOMStructureFeatures): number {
    let similarity = 0;
    let maxScore = 0;

    // Form count similarity (weight: 20)
    const formDiff = Math.abs(features1.formCount - features2.formCount);
    const formScore = Math.max(0, 20 - formDiff * 2);
    similarity += formScore;
    maxScore += 20;

    // Input types similarity (weight: 25)
    const set1 = new Set(features1.inputTypes);
    const set2 = new Set(features2.inputTypes);
    const intersection = new Set(Array.from(set1).filter((x) => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);
    const inputSimilarity = union.size > 0 ? (intersection.size / union.size) * 25 : 0;
    similarity += inputSimilarity;
    maxScore += 25;

    // External scripts similarity (weight: 30)
    const scriptSet1 = new Set(features1.externalScripts);
    const scriptSet2 = new Set(features2.externalScripts);
    const scriptIntersection = new Set(Array.from(scriptSet1).filter((x) => scriptSet2.has(x)));
    const scriptUnion = new Set([...Array.from(scriptSet1), ...Array.from(scriptSet2)]);
    const scriptSimilarity = scriptUnion.size > 0 ? (scriptIntersection.size / scriptUnion.size) * 30 : 0;
    similarity += scriptSimilarity;
    maxScore += 30;

    // CSS class patterns similarity (weight: 15)
    const classSet1 = new Set(features1.cssClassPatterns);
    const classSet2 = new Set(features2.cssClassPatterns);
    const classIntersection = new Set(Array.from(classSet1).filter((x) => classSet2.has(x)));
    const classUnion = new Set([...Array.from(classSet1), ...Array.from(classSet2)]);
    const classSimilarity = classUnion.size > 0 ? (classIntersection.size / classUnion.size) * 15 : 0;
    similarity += classSimilarity;
    maxScore += 15;

    // Element count similarity (weight: 10)
    const elemDiff = Math.abs(features1.imageCount - features2.imageCount) + Math.abs(features1.linkCount - features2.linkCount);
    const elemScore = Math.max(0, 10 - elemDiff);
    similarity += elemScore;
    maxScore += 10;

    return maxScore > 0 ? Math.round((similarity / maxScore) * 100) : 0;
  }

  /**
   * Generate cluster ID from DOM structure hash
   */
  generateClusterId(domStructureHash: string): string {
    return `cluster_${domStructureHash}`;
  }

  /**
   * Detect if a URL is part of a known phishing campaign
   */
  async detectCampaign(
    features: DOMStructureFeatures,
    existingClusters: Array<{ domStructureHash: string; clusterId: string; formCount: number }>
  ): Promise<{
    clusterId: string | null;
    similarity: number;
    isNewCluster: boolean;
  }> {
    if (existingClusters.length === 0) {
      return {
        clusterId: this.generateClusterId(features.domStructureHash),
        similarity: 100,
        isNewCluster: true,
      };
    }

    // Find best matching cluster
    let bestMatch = null;
    let bestSimilarity = 0;
    const SIMILARITY_THRESHOLD = 70; // 70% similarity threshold for clustering

    for (const cluster of existingClusters) {
      const clusterFeatures: DOMStructureFeatures = {
        formCount: cluster.formCount,
        inputTypes: [],
        externalScripts: [],
        cssClassPatterns: [],
        iframeCount: 0,
        imageCount: 0,
        linkCount: 0,
        domStructureHash: cluster.domStructureHash,
      };

      const similarity = this.calculateSimilarity(features, clusterFeatures);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = cluster;
      }
    }

    if (bestSimilarity >= SIMILARITY_THRESHOLD) {
      return {
        clusterId: bestMatch!.clusterId,
        similarity: bestSimilarity,
        isNewCluster: false,
      };
    }

    // Create new cluster if no good match found
    return {
      clusterId: this.generateClusterId(features.domStructureHash),
      similarity: 0,
      isNewCluster: true,
    };
  }

  /**
   * Generate human-readable cluster name based on features
   */
  generateClusterName(features: DOMStructureFeatures, clusterId: string): string {
    const keywords: string[] = [];

    // Add keywords based on features
    if (features.formCount > 2) {
      keywords.push('MultiForm');
    }
    if (features.externalScripts.length > 5) {
      keywords.push('ScriptHeavy');
    }
    if (features.inputTypes.includes('password')) {
      keywords.push('CredentialTheft');
    }
    if (features.iframeCount > 0) {
      keywords.push('FrameInjection');
    }

    const name = keywords.length > 0 ? keywords.join('_') : 'Generic_Phishing';
    return `${name}_${clusterId.substring(0, 8)}`;
  }
}

export function getPolymorphicDetectionService(): PolymorphicDetectionService {
  return new PolymorphicDetectionService();
}
