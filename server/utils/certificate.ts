/**
 * SSL Certificate Fetching Utility
 * Retrieves certificate information from HTTPS URLs for security analysis
 */

import * as tls from "tls";

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
  return new Promise((resolve) => {
    let resolved = false;

    const socket = tls.connect(
      {
        host: hostname,
        port,
        rejectUnauthorized: false, // Allow self-signed certificates
        servername: hostname, // SNI support
      },
      () => {
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

          resolve(certInfo);
        } catch (error) {
          socket.end();
          resolve({
            error: `Failed to parse certificate: ${(error as Error).message}`,
          });
        }
      }
    );

    socket.on("error", (error) => {
      if (resolved) return;
      resolved = true;

      resolve({
        error: `Certificate fetch error: ${error.message}`,
      });
    });

    socket.on("timeout", () => {
      if (resolved) return;
      resolved = true;

      socket.destroy();
      resolve({
        error: "Certificate fetch timeout",
      });
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

/**
 * Format certificate info for display
 * @param certInfo - Certificate information
 * @returns Formatted string representation
 */
export function formatCertificateInfo(certInfo: CertificateInfo): string {
  if (certInfo.error) {
    return `Certificate Error: ${certInfo.error}`;
  }

  const lines: string[] = [];

  if (certInfo.subject) {
    lines.push(`Subject: ${JSON.stringify(certInfo.subject)}`);
  }
  if (certInfo.issuer) {
    lines.push(`Issuer: ${JSON.stringify(certInfo.issuer)}`);
  }
  if (certInfo.valid_from) {
    lines.push(`Valid From: ${certInfo.valid_from}`);
  }
  if (certInfo.valid_to) {
    lines.push(`Valid To: ${certInfo.valid_to}`);
  }
  if (certInfo.fingerprint) {
    lines.push(`Fingerprint: ${certInfo.fingerprint}`);
  }

  return lines.join("\n");
}
