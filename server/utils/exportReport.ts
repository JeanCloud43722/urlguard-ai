import { URLCheck } from "../../drizzle/schema";

export interface ReportData {
  url: string;
  normalizedUrl: string;
  riskScore: number;
  riskLevel: string;
  analysis: string;
  indicators: string[];
  confidence: number;
  createdAt: Date;
}

/**
 * Generate JSON report from URL check results
 */
export function generateJSONReport(checks: ReportData[]): string {
  const report = {
    generatedAt: new Date().toISOString(),
    totalChecks: checks.length,
    summary: {
      safe: checks.filter((c) => c.riskLevel === "safe").length,
      suspicious: checks.filter((c) => c.riskLevel === "suspicious").length,
      dangerous: checks.filter((c) => c.riskLevel === "dangerous").length,
    },
    checks: checks.map((check) => ({
      url: check.url,
      normalizedUrl: check.normalizedUrl,
      riskScore: check.riskScore,
      riskLevel: check.riskLevel,
      analysis: check.analysis,
      indicators: check.indicators,
      confidence: check.confidence,
      checkedAt: check.createdAt.toISOString(),
    })),
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Generate CSV report from URL check results
 */
export function generateCSVReport(checks: ReportData[]): string {
  const headers = ["URL", "Risk Score", "Risk Level", "Analysis", "Indicators", "Confidence", "Checked At"];
  const rows = checks.map((check) => [
    `"${check.url.replace(/"/g, '""')}"`,
    check.riskScore,
    check.riskLevel,
    `"${check.analysis.replace(/"/g, '""')}"`,
    `"${check.indicators.join("; ").replace(/"/g, '""')}"`,
    (check.confidence * 100).toFixed(0),
    check.createdAt.toISOString(),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Generate HTML report for browser viewing
 */
export function generateHTMLReport(checks: ReportData[]): string {
  const safe = checks.filter((c) => c.riskLevel === "safe").length;
  const suspicious = checks.filter((c) => c.riskLevel === "suspicious").length;
  const dangerous = checks.filter((c) => c.riskLevel === "dangerous").length;

  const checkRows = checks
    .map(
      (check) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <code style="font-size: 12px; color: #4b5563;">${check.url}</code>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 12px;
          ${
            check.riskLevel === "safe"
              ? "background-color: #dcfce7; color: #166534;"
              : check.riskLevel === "suspicious"
                ? "background-color: #fef3c7; color: #92400e;"
                : "background-color: #fee2e2; color: #991b1b;"
          }
        ">
          ${check.riskScore}%
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
        ${check.analysis}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #9ca3af;">
        ${new Date(check.createdAt).toLocaleDateString()}
      </td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URLGuard AI Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      padding: 30px;
      background-color: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item .value {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .summary-item .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-item.safe .value { color: #16a34a; }
    .summary-item.suspicious .value { color: #ca8a04; }
    .summary-item.dangerous .value { color: #dc2626; }
    .content {
      padding: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 12px;
      background-color: #f3f4f6;
      border-bottom: 2px solid #e5e7eb;
      font-weight: 600;
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer {
      padding: 20px 30px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>URLGuard AI Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
      <div class="summary-item safe">
        <div class="value">${safe}</div>
        <div class="label">Safe</div>
      </div>
      <div class="summary-item suspicious">
        <div class="value">${suspicious}</div>
        <div class="label">Suspicious</div>
      </div>
      <div class="summary-item dangerous">
        <div class="value">${dangerous}</div>
        <div class="label">Dangerous</div>
      </div>
    </div>
    
    <div class="content">
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th style="text-align: center;">Risk Score</th>
            <th>Analysis</th>
            <th style="text-align: right;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${checkRows}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <p>URLGuard AI - Phishing Detection Made Simple</p>
    </div>
  </div>
</body>
</html>
  `;
}
