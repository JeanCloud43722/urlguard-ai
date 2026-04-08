/**
 * SSL Certificate Fetching Utility
 * Retrieves certificate information from HTTPS URLs for security analysis
 */

import * as tls from "tls";
import { getRedisService } from "../services/redis";

export interface CertificateInfo {
  subject?: any;
  issuer?: any;
  valid_from?: string;
  valid_to?: string;
  fingerprint?: string;
  serialNumber?: string;
  error?: string;
}

/**
 * Fetch SSL certificate from a hostname
 * @param hostname - Domain name to fetch certificate from
 * @param port - Port number (default 443)
 * @param timeout - Timeout in milliseconds (default 5000)
 * @returns Certificate information object
 */
export async function fetchCertificate(
  hostname: string,
  port: number = 443,
  timeout: number = 5000
): Promise<CertificateInfo> {
  // Check Redis cache first
  try {
    const redis = getRedisService();
    const cached = await redis.getCertificateCache(hostname);
    if (cached) {
      console.log(`[Cache] Certificate HIT for ${hostname}`);
      return cached;
    }
  } catch (err) {
    console.warn(`[Cache] Certificate cache check failed: ${err}`);
  }

  return new Promise((resolve) => {
    let resolved = false;

    const socket = tls.connect(
      {
        host: hostname,
        port,
        rejectUnauthorized: false, // Allow self-signed certificates
        servername: hostname, // SNI support
      },
      async () => {
        if (resolved) return;
        resolved = true;

        try {
          const cert = socket.getPeerCertificate();
          socket.end();

          const certInfo: CertificateInfo = {
            subject: cert.subject,
            issuer: cert.issuer,
            valid_from: cert.valid_from,
            valid_to: cert.valid_to,
            fingerprint: cert.fingerprint,
            serialNumber: cert.serialNumber,
          };

          // Cache for 1 hour
          try {
            const redis = getRedisService();
            await redis.setCertificateCache(hostname, certInfo, 3600);
            console.log(`[Cache] Certificate stored for ${hostname}`);
          } catch (err) {
            console.warn(`[Cache] Certificate cache store failed: ${err}`);
          }

          resolve(certInfo);
        } catch (error) {
          socket.end();
          const certInfo = {
            error: `Failed to parse certificate: ${(error as Error).message}`,
          };
          
          // Cache error for 5 minutes
          try {
            const redis = getRedisService();
            await redis.setCertificateCache(hostname, certInfo, 300);
          } catch (err) {
            console.warn(`[Cache] Certificate error cache failed: ${err}`);
          }
          
          resolve(certInfo);
        }
      }
    );

    socket.on("error", async (error) => {
      if (resolved) return;
      resolved = true;

      const certInfo = {
        error: `Certificate fetch error: ${error.message}`,
      };
      
      // Cache error for 5 minutes
      try {
        const redis = getRedisService();
        await redis.setCertificateCache(hostname, certInfo, 300);
      } catch (err) {
        console.warn(`[Cache] Certificate error cache failed: ${err}`);
      }
      
      resolve(certInfo);
    });

    socket.on("timeout", async () => {
      if (resolved) return;
      resolved = true;

      socket.destroy();
      const certInfo = {
        error: "Certificate fetch timeout",
      };
      
      // Cache error for 5 minutes
      try {
        const redis = getRedisService();
        await redis.setCertificateCache(hostname, certInfo, 300);
      } catch (err) {
        console.warn(`[Cache] Certificate error cache failed: ${err}`);
      }
      
      resolve(certInfo);
    });

    // Set timeout
    socket.setTimeout(timeout, () => {
      socket.destroy();
    });
  });
}

/**
 * Check if certificate is valid (not expired)
 * @param certInfo - Certificate information
 * @returns true if certificate is valid, false otherwise
 */
export function isCertificateValid(certInfo: CertificateInfo): boolean {
  if (!certInfo.valid_to) {
    return false;
  }

  try {
    const expiryDate = new Date(certInfo.valid_to);
    return expiryDate > new Date();
  } catch {
    return false;
  }
}

/**
 * Check if certificate is self-signed
 * @param certInfo - Certificate information
 * @returns true if self-signed, false otherwise
 */
export function isSelfSigned(certInfo: CertificateInfo): boolean {
  if (!certInfo.subject || !certInfo.issuer) {
    return false;
  }

  try {
    return JSON.stringify(certInfo.subject) === JSON.stringify(certInfo.issuer);
  } catch {
    return false;
  }
}

/**
 * Check if certificate is from a trusted issuer
 * @param certInfo - Certificate information
 * @returns true if from known trusted issuer, false otherwise
 */
export function isTrustedIssuer(certInfo: CertificateInfo): boolean {
  if (!certInfo.issuer) {
    return false;
  }

  const trustedIssuers = [
    "Let's Encrypt",
    "DigiCert",
    "GlobalSign",
    "Sectigo",
    "Comodo",
    "GeoTrust",
    "Verisign",
    "Thawte",
    "Entrust",
    "IdenTrust",
  ];

  const issuerString = JSON.stringify(certInfo.issuer).toLowerCase();

  return trustedIssuers.some((issuer) => issuerString.includes(issuer.toLowerCase()));
}

/**
 * Extract certificate risk indicators
 * @param certInfo - Certificate information
 * @returns Array of risk indicators
 */
export function extractCertificateRisks(certInfo: CertificateInfo): string[] {
  const risks: string[] = [];

  if (certInfo.error) {
    risks.push(`Certificate error: ${certInfo.error}`);
    return risks;
  }

  // Check if expired
  if (!isCertificateValid(certInfo)) {
    risks.push("Certificate is expired or invalid");
  }

  // Check if self-signed
  if (isSelfSigned(certInfo)) {
    risks.push("Self-signed certificate (not trusted by browsers)");
  }

  // Check if from trusted issuer
  if (!isTrustedIssuer(certInfo)) {
    risks.push("Certificate from untrusted or unknown issuer");
  }

  // Check certificate age (warn if very new)
  if (certInfo.valid_from) {
    try {
      const issuedDate = new Date(certInfo.valid_from);
      const daysSinceIssue = (Date.now() - issuedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceIssue < 7) {
        risks.push("Certificate was issued very recently (potential phishing indicator)");
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return risks;
}
