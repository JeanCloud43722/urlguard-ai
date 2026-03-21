/**
 * VirusTotal Service
 * Integrates with VirusTotal API v3 for URL threat intelligence
 */

import axios, { AxiosError } from "axios";
import { ENV } from "../_core/env";

export interface VirusTotalStats {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout?: number;
}

export interface VirusTotalResult {
  category: string;
  engine_name: string;
  result: string;
}

export interface VirusTotalReport {
  id: string;
  type: string;
  attributes: {
    last_analysis_date: number;
    last_analysis_stats: VirusTotalStats;
    last_analysis_results: Record<string, VirusTotalResult>;
    url: string;
    title?: string;
    description?: string;
  };
}

/**
 * Generate VirusTotal URL identifier (Base64 without padding)
 */
export function generateUrlId(url: string): string {
  return Buffer.from(url).toString("base64").replace(/=/g, "");
}

/**
 * Fetch VirusTotal report for a URL
 * @param url - URL to check
 * @param timeout - Request timeout in milliseconds
 * @returns VirusTotal report or null if not found/error
 */
export async function getVirusTotalReport(url: string, timeout: number = 5000): Promise<VirusTotalReport | null> {
  if (!ENV.virusTotalApiKey) {
    console.warn("[VirusTotal] API key not configured, skipping VT integration");
    return null;
  }

  const urlId = generateUrlId(url);

  try {
    const response = await axios.get<{ data: VirusTotalReport }>(
      `https://www.virustotal.com/api/v3/urls/${urlId}`,
      {
        headers: {
          "x-apikey": ENV.virusTotalApiKey,
        },
        timeout,
      }
    );

    return response.data.data;
  } catch (error) {
    const axiosError = error as AxiosError;

    if (axiosError.response?.status === 404) {
      console.log(`[VirusTotal] No report found for URL: ${url}`);
      return null;
    }

    if (axiosError.response?.status === 401) {
      console.error("[VirusTotal] Invalid API key");
      return null;
    }

    if (axiosError.response?.status === 429) {
      console.warn("[VirusTotal] Rate limit exceeded");
      return null;
    }

    console.error(`[VirusTotal] API error: ${axiosError.message}`);
    return null;
  }
}

/**
 * Extract malicious vendors from VirusTotal report
 */
export function extractMaliciousVendors(report: VirusTotalReport): string[] {
  if (!report.attributes?.last_analysis_results) {
    return [];
  }

  return Object.entries(report.attributes.last_analysis_results)
    .filter(([, result]) => result.category === "malicious")
    .map(([vendor]) => vendor);
}

/**
 * Calculate risk score from VirusTotal stats
 * Returns 0-100 score based on malicious detections
 */
export function calculateVTRiskScore(stats: VirusTotalStats): number {
  const total = stats.malicious + stats.suspicious + stats.undetected + stats.harmless;

  if (total === 0) {
    return 0;
  }

  // Malicious: 100%, Suspicious: 50%, Undetected: 10%
  const riskPoints = stats.malicious * 100 + stats.suspicious * 50 + stats.undetected * 10;
  const maxPoints = total * 100;

  return Math.min(100, Math.round((riskPoints / maxPoints) * 100));
}

/**
 * Format VirusTotal report for display
 */
export function formatVTReport(report: VirusTotalReport): string {
  const stats = report.attributes.last_analysis_stats;
  const maliciousVendors = extractMaliciousVendors(report);
  const scanDate = new Date(report.attributes.last_analysis_date * 1000).toISOString();

  const lines: string[] = [
    `Scan Date: ${scanDate}`,
    `Malicious: ${stats.malicious}`,
    `Suspicious: ${stats.suspicious}`,
    `Undetected: ${stats.undetected}`,
    `Harmless: ${stats.harmless}`,
  ];

  if (maliciousVendors.length > 0) {
    lines.push(`Flagged by: ${maliciousVendors.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Check if URL is flagged as malicious on VirusTotal
 */
export function isVirusTotalMalicious(report: VirusTotalReport): boolean {
  return report.attributes.last_analysis_stats.malicious > 0;
}

/**
 * Check if URL is flagged as suspicious on VirusTotal
 */
export function isVirusTotalSuspicious(report: VirusTotalReport): boolean {
  return report.attributes.last_analysis_stats.suspicious > 0;
}

/**
 * Get VirusTotal risk level based on stats
 */
export function getVirusTotalRiskLevel(stats: VirusTotalStats): "safe" | "suspicious" | "dangerous" {
  if (stats.malicious > 0) {
    return "dangerous";
  }
  if (stats.suspicious > 0 || stats.malicious > 0) {
    return "suspicious";
  }
  return "safe";
}
