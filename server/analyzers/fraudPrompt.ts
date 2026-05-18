export const FRAUD_SYSTEM_PROMPT = `You are a fraud detection AI. Analyze the URL and return ONLY valid JSON. No extra text, no markdown.`;

export function buildFraudPrompt(url: string, indicators: string[]): string {
  const topIndicators = indicators.slice(0, 3).join(", ") || "none";
  return `URL: ${url}
Indicators: ${topIndicators}
Respond with ONLY this JSON format:
{
  "fraud_score": <0-100>,
  "risk_level": "<safe|suspicious|dangerous>",
  "reasons": ["reason1", "reason2"],
  "confidence": <0-1>
}`;
}
